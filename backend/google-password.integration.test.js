/* Google-account password setup integration check.
 *
 * Starts an isolated MongoDB and the real API, then verifies that:
 *   - Google-only accounts get an actionable login error code;
 *   - the authenticated account can create a password without a current one;
 *   - creating the password does not kill the current session;
 *   - email + password sign-in works afterwards;
 *   - a second create-password call is rejected.
 *
 * Run with: node google-password.integration.test.js
 */
process.env.NODE_ENV = "test";

const { spawn } = require("child_process");
const net = require("net");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("./models/User");

const EMAIL = "google-only@example.com";
const RESET_EMAIL = "google-reset@example.com";
const PASSWORD = "NewPass123";
const RESET_PASSWORD = "ResetPass123";
const JWT_SECRET = "google-password-integration-secret";

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

(async () => {
  let mongod = null;
  let child = null;
  const logs = [];

  try {
    console.log("\n=== GOOGLE PASSWORD SETUP INTEGRATION ===");

    mongod = await MongoMemoryServer.create({
      instance: { dbName: "cookmitra_google_password" },
    });
    const uri = mongod.getUri("cookmitra_google_password");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

    const user = await User.create({
      name: "Google Only",
      email: EMAIL,
      googleId: "google-sub-123",
      authProvider: "google",
      role: "CUSTOMER",
      status: "active",
      emailVerified: true,
    });
    check(
      "google-only account starts without a password",
      !user.password && user.authProvider === "google",
      `provider=${user.authProvider}`,
    );

    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["server.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        MONGODB_URI: uri,
        JWT_SECRET,
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASS: "",
        ALLOW_DEV_TOKENS: "true",
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

    const passwordLogin = await post(base, "/api/auth/login", {
      email: EMAIL,
      password: "anything123",
    });
    check(
      "google-only password login returns an actionable code",
      passwordLogin.status === 401 &&
        passwordLogin.data?.code === "GOOGLE_SIGN_IN_REQUIRED" &&
        /forgot password/i.test(passwordLogin.data?.message || ""),
      `status=${passwordLogin.status} ${JSON.stringify(passwordLogin.data)}`,
    );

    const token = jwt.sign(
      { id: String(user._id), role: "CUSTOMER", tv: 0 },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const before = await get(base, "/api/auth/me", token);
    check(
      "existing Google session reports no password",
      before.status === 200 &&
        before.data?.hasPassword === false &&
        before.data?.authProvider === "google",
      `status=${before.status} ${JSON.stringify(before.data)}`,
    );

    const unauthenticated = await post(base, "/api/auth/set-password", {
      newPassword: PASSWORD,
    });
    check(
      "set-password requires authentication",
      unauthenticated.status === 401,
      `status=${unauthenticated.status}`,
    );

    const weak = await post(
      base,
      "/api/auth/set-password",
      { newPassword: "short" },
      token,
    );
    check(
      "set-password rejects a weak password",
      weak.status === 400,
      `status=${weak.status}`,
    );

    const hostile = await post(
      base,
      "/api/auth/set-password",
      { newPassword: { nested: "value" } },
      token,
    );
    check(
      "set-password rejects non-string input",
      hostile.status === 400,
      `status=${hostile.status}`,
    );

    const created = await post(
      base,
      "/api/auth/set-password",
      { newPassword: PASSWORD },
      token,
    );
    check(
      "google-only account can create a password",
      created.status === 200 &&
        created.data?.user?.hasPassword === true &&
        created.data?.user?.authProvider === "local+google",
      `status=${created.status} ${JSON.stringify(created.data)}`,
    );

    const after = await get(base, "/api/auth/me", token);
    check(
      "creating a password keeps the current session valid",
      after.status === 200 &&
        after.data?.hasPassword === true &&
        after.data?.authProvider === "local+google",
      `status=${after.status} ${JSON.stringify(after.data)}`,
    );

    const stored = await User.findById(user._id).select("+password googleId authProvider");
    check(
      "stored password is hashed and Google remains linked",
      Boolean(stored.password) &&
        stored.password !== PASSWORD &&
        (await stored.comparePassword(PASSWORD)) &&
        stored.googleId === "google-sub-123" &&
        stored.authProvider === "local+google",
      `provider=${stored.authProvider}`,
    );

    const second = await post(
      base,
      "/api/auth/set-password",
      { newPassword: "AnotherPass123" },
      token,
    );
    check(
      "set-password refuses to overwrite an existing password",
      second.status === 400 && second.data?.code === "PASSWORD_ALREADY_SET",
      `status=${second.status} ${JSON.stringify(second.data)}`,
    );

    const login = await post(base, "/api/auth/login", {
      email: EMAIL,
      password: PASSWORD,
    });
    check(
      "email + password sign-in works after creating the password",
      login.status === 200 &&
        typeof login.data?.token === "string" &&
        login.data?.user?.hasPassword === true,
      `status=${login.status}`,
    );

    const changed = await post(
      base,
      "/api/auth/change-password",
      { currentPassword: PASSWORD, newPassword: "ChangedPass123" },
      login.data?.token,
    );
    check(
      "normal password change works after setup",
      changed.status === 200 && typeof changed.data?.token === "string",
      `status=${changed.status}`,
    );

    // The login error's in-app path sends the user through "Forgot password".
    // Verify that route also turns a Google-only account into a dual-login one.
    const resetUser = await User.create({
      name: "Google Reset",
      email: RESET_EMAIL,
      googleId: "google-sub-reset",
      authProvider: "google",
      role: "CUSTOMER",
      status: "active",
      emailVerified: true,
    });
    const forgot = await post(base, "/api/auth/forgot-password", {
      email: RESET_EMAIL,
    });
    check(
      "forgot-password mints a reset token for a Google-only account",
      forgot.status === 200 && typeof forgot.data?.resetToken === "string",
      `status=${forgot.status}`,
    );

    const reset = await post(base, "/api/auth/reset-password", {
      token: forgot.data?.resetToken,
      password: RESET_PASSWORD,
    });
    check(
      "Google-only account can set its first password through reset",
      reset.status === 200,
      `status=${reset.status} ${JSON.stringify(reset.data)}`,
    );

    const resetStored = await User.findById(resetUser._id).select(
      "+password googleId authProvider",
    );
    check(
      "reset keeps Google linked and hashes the new password",
      resetStored.authProvider === "local+google" &&
        (await resetStored.comparePassword(RESET_PASSWORD)),
      `provider=${resetStored.authProvider}`,
    );

    const resetLogin = await post(base, "/api/auth/login", {
      email: RESET_EMAIL,
      password: RESET_PASSWORD,
    });
    check(
      "email + password sign-in works after the reset path",
      resetLogin.status === 200 && resetLogin.data?.user?.hasPassword === true,
      `status=${resetLogin.status}`,
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
      ? "\nALL GOOGLE PASSWORD TESTS PASSED"
      : `\n${failures} GOOGLE PASSWORD TEST(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
