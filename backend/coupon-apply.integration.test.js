/* End-to-end coupon-apply check.
 *
 * Starts an isolated MongoDB, boots the real API on a free port, seeds real
 * coupon documents, signs in as a customer, and exercises /coupons/validate
 * plus the public active-coupon list.
 *
 * Run with: node coupon-apply.integration.test.js
 */
process.env.NODE_ENV = "test";

const { spawn } = require("child_process");
const net = require("net");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Coupon = require("./models/Coupon");
const Booking = require("./models/Booking");
const User = require("./models/User");

const EMAIL = "coupon-apply@example.com";
const PASSWORD = "CouponPass123";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -> ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (base, method, path, body, token) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Status assertions still catch non-JSON failures.
  }
  return { status: response.status, data };
};

const post = (base, path, body, token) => request(base, "POST", path, body, token);
const get = (base, path, token) => request(base, "GET", path, null, token);

const waitForReady = async (base, child, logs) => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`API exited with code ${child.exitCode}\n${logs.join("")}`);
    }
    try {
      const response = await fetch(`${base}/api/ready`);
      if (response.ok) return;
    } catch {
      // Server not listening yet.
    }
    await wait(250);
  }
  throw new Error(`API did not become ready\n${logs.join("")}`);
};

const stopChild = async (child) => {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
  if (child.exitCode === null) child.kill("SIGKILL");
};

const coupon = (overrides) => ({
  code: "TEST10",
  description: "Integration test coupon",
  discountType: "percent",
  percent: 10,
  minOrder: 0,
  perUserLimit: 1,
  active: true,
  ...overrides,
});

(async () => {
  let mongod = null;
  let child = null;
  const logs = [];
  const now = Date.now();

  try {
    console.log("\n=== COUPON APPLY INTEGRATION ===");

    mongod = await MongoMemoryServer.create({
      instance: { dbName: "cookmitra_coupon_apply" },
    });
    const uri = mongod.getUri("cookmitra_coupon_apply");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

    const customer = await User.create({
      name: "Coupon Apply",
      email: EMAIL,
      password: PASSWORD,
      role: "CUSTOMER",
      status: "active",
    });

    await Coupon.create([
      coupon({
        code: "FESTIVE20",
        discountType: "percent",
        percent: 20,
        maxDiscount: 70,
        minOrder: 499,
      }),
      coupon({
        code: "WELCOME50",
        discountType: "flat",
        percent: null,
        flatAmount: 50,
        minOrder: 349,
        firstBookingOnly: true,
      }),
      coupon({
        code: "REBOOK75",
        discountType: "flat",
        percent: null,
        flatAmount: 75,
        minOrder: 0,
      }),
      coupon({
        code: "SERVICE10",
        applicableServices: ["cook_with_me"],
      }),
      coupon({ code: "USED10", usedBy: [customer._id] }),
      coupon({ code: "LIMITED10", usageLimit: 1, usedCount: 1 }),
      coupon({ code: "INACTIVE10", active: false }),
      coupon({ code: "EXPIRED10", validTo: new Date(now - 60_000) }),
      coupon({ code: "FUTURE10", validFrom: new Date(now + 60 * 60 * 1000) }),
    ]);

    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["server.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        MONGODB_URI: uri,
        JWT_SECRET: "coupon-integration-test-secret",
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASS: "",
        MONGO_RETRY_MS: "100",
        RATE_LIMIT_GENERAL: "1000",
        RATE_LIMIT_AUTH: "1000",
        RATE_LIMIT_STRICT: "1000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
    child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
    await waitForReady(base, child, logs);
    check("isolated API starts against in-memory MongoDB", true, base);

    const unauth = await post(base, "/api/coupons/validate", {
      code: "FESTIVE20",
      amount: 499,
    });
    check("unauthenticated apply is rejected", unauth.status === 401, `status=${unauth.status}`);

    const login = await post(base, "/api/auth/login", { email: EMAIL, password: PASSWORD });
    const token = login.data?.token;
    check(
      "customer signs in",
      login.status === 200 && typeof token === "string",
      `status=${login.status}`,
    );

    const percent = await post(
      base,
      "/api/coupons/validate",
      { code: "  festive-20  ", amount: 499 },
      token,
    );
    check(
      "percent coupon validates with normalized code",
      percent.status === 200 &&
        percent.data?.code === "FESTIVE20" &&
        percent.data?.discount === 70 &&
        percent.data?.payable === 429,
      `status=${percent.status} ${JSON.stringify(percent.data)}`,
    );

    const flat = await post(
      base,
      "/api/coupons/validate",
      { code: "REBOOK75", amount: 649 },
      token,
    );
    check(
      "flat coupon calculates its fixed discount",
      flat.status === 200 && flat.data?.discount === 75 && flat.data?.payable === 574,
      `status=${flat.status} ${JSON.stringify(flat.data)}`,
    );

    const belowMinimum = await post(
      base,
      "/api/coupons/validate",
      { code: "WELCOME50", amount: 300 },
      token,
    );
    check(
      "minimum-order coupon is rejected below its threshold",
      belowMinimum.status === 400 && /minimum order/i.test(belowMinimum.data?.message || ""),
      `status=${belowMinimum.status} ${belowMinimum.data?.message || ""}`,
    );

    const firstBooking = await post(
      base,
      "/api/coupons/validate",
      { code: "WELCOME50", amount: 349 },
      token,
    );
    check(
      "first-booking coupon is accepted before any booking exists",
      firstBooking.status === 200 && firstBooking.data?.payable === 299,
      `status=${firstBooking.status} ${JSON.stringify(firstBooking.data)}`,
    );

    const inactive = await post(
      base,
      "/api/coupons/validate",
      { code: "INACTIVE10", amount: 1000 },
      token,
    );
    check(
      "inactive coupon is rejected",
      inactive.status === 400 && /no longer active/i.test(inactive.data?.message || ""),
      `status=${inactive.status} ${inactive.data?.message || ""}`,
    );

    const expired = await post(
      base,
      "/api/coupons/validate",
      { code: "EXPIRED10", amount: 1000 },
      token,
    );
    check(
      "expired coupon is rejected",
      expired.status === 400 && /expired/i.test(expired.data?.message || ""),
      `status=${expired.status} ${expired.data?.message || ""}`,
    );

    const future = await post(
      base,
      "/api/coupons/validate",
      { code: "FUTURE10", amount: 1000 },
      token,
    );
    check(
      "not-yet-valid coupon is rejected",
      future.status === 400 && /not valid yet/i.test(future.data?.message || ""),
      `status=${future.status} ${future.data?.message || ""}`,
    );

    const used = await post(
      base,
      "/api/coupons/validate",
      { code: "USED10", amount: 1000 },
      token,
    );
    check(
      "per-user limit is enforced",
      used.status === 400 && /already used/i.test(used.data?.message || ""),
      `status=${used.status} ${used.data?.message || ""}`,
    );

    const exhausted = await post(
      base,
      "/api/coupons/validate",
      { code: "LIMITED10", amount: 1000 },
      token,
    );
    check(
      "exhausted global usage limit is enforced",
      exhausted.status === 400 && /usage limit/i.test(exhausted.data?.message || ""),
      `status=${exhausted.status} ${exhausted.data?.message || ""}`,
    );

    const wrongService = await post(
      base,
      "/api/coupons/validate",
      { code: "SERVICE10", amount: 1000, serviceType: "cook_for_me" },
      token,
    );
    check(
      "service-restricted coupon is rejected for another service",
      wrongService.status === 400 && /selected service/i.test(wrongService.data?.message || ""),
      `status=${wrongService.status} ${wrongService.data?.message || ""}`,
    );

    const rightService = await post(
      base,
      "/api/coupons/validate",
      { code: "SERVICE10", amount: 1000, serviceType: "cook_with_me" },
      token,
    );
    check(
      "service-restricted coupon works for its service",
      rightService.status === 200 && rightService.data?.discount === 100,
      `status=${rightService.status} ${JSON.stringify(rightService.data)}`,
    );

    const unknown = await post(
      base,
      "/api/coupons/validate",
      { code: "NOPE123", amount: 1000 },
      token,
    );
    check(
      "unknown code is rejected",
      unknown.status === 400 && /not valid for this booking/i.test(unknown.data?.message || ""),
      `status=${unknown.status} ${unknown.data?.message || ""}`,
    );

    // Validation must not reserve or consume the coupon.
    for (let i = 0; i < 3; i += 1) {
      await post(
        base,
        "/api/coupons/validate",
        { code: "FESTIVE20", amount: 499 },
        token,
      );
    }
    const untouched = await Coupon.findOne({ code: "FESTIVE20" });
    check(
      "repeated validation does not consume the coupon",
      Number(untouched.usedCount) === 0 && (untouched.usedBy || []).length === 0,
      `used=${untouched.usedCount} users=${(untouched.usedBy || []).length}`,
    );

    // Now create a real booking document so first-booking-only is no longer true.
    await Booking.create({
      customer: customer._id,
      serviceType: "cook_for_me",
      date: new Date(now + 24 * 60 * 60 * 1000),
      startTime: "09:00",
      endTime: "11:00",
      address: "Integration test address",
      durationHours: 2,
      guests: 2,
    });
    const afterBooking = await post(
      base,
      "/api/coupons/validate",
      { code: "WELCOME50", amount: 349 },
      token,
    );
    check(
      "first-booking coupon is rejected after a booking exists",
      afterBooking.status === 400 && /first booking/i.test(afterBooking.data?.message || ""),
      `status=${afterBooking.status} ${afterBooking.data?.message || ""}`,
    );

    const active = await get(base, "/api/coupons/active");
    const codes = Array.isArray(active.data) ? active.data.map((c) => c.code) : [];
    check(
      "active list returns usable coupons",
      active.status === 200 && codes.includes("FESTIVE20") && codes.includes("REBOOK75"),
      `status=${active.status} codes=${codes.join(",")}`,
    );
    check(
      "active list excludes inactive, expired, future, and exhausted coupons",
      !codes.includes("INACTIVE10") &&
        !codes.includes("EXPIRED10") &&
        !codes.includes("FUTURE10") &&
        !codes.includes("LIMITED10"),
      codes.join(","),
    );
  } catch (error) {
    failures += 1;
    console.error("TEST ERROR:", error);
    if (logs.length) console.error("SERVER LOG:\n" + logs.join(""));
  } finally {
    await stopChild(child);
    await mongoose.disconnect().catch(() => {});
    if (mongod) await mongod.stop().catch(() => {});
  }

  console.log(
    failures === 0
      ? "\nALL COUPON APPLY INTEGRATION TESTS PASSED"
      : `\n${failures} COUPON APPLY TEST(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
