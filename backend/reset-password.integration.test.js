/* End-to-end reset-password check.
 *
 * Starts an isolated MongoDB, boots the real API on a free port with SMTP
 * disabled and dev reset-token echo enabled, then exercises the full flow:
 * login -> forgot-password -> reset-password -> login again.
 *
 * Run with: node reset-password.integration.test.js
 */
process.env.NODE_ENV = "test";

const { spawn } = require("child_process");
const crypto = require("crypto");
const net = require("net");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("./models/User");

const EMAIL = "reset-integration@example.com";
const OLD_PASSWORD = "OldPass123";
const NEW_PASSWORD = "NewPass456";
const TOKEN_RE = /^[a-f0-9]{64}$/;

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
    // A non-JSON error body is fine; the status assertion still tells the story.
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
    console.log("\n=== PASSWORD RESET INTEGRATION ===");

    mongod = await MongoMemoryServer.create({
      instance: { dbName: "cookmitra_reset_integration" },
    });
    const uri = mongod.getUri("cookmitra_reset_integration");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

    const created = await User.create({
      name: "Reset Integration",
      email: EMAIL,
      password: OLD_PASSWORD,
      role: "CUSTOMER",
      status: "active",
    });
    const userId = created._id;
    const initialTokenVersion = Number(created.tokenVersion) || 0;

    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["server.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        MONGODB_URI: uri,
        JWT_SECRET: "reset-integration-test-secret",
        ALLOW_DEV_TOKENS: "true",
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

    const before = await post(base, "/api/auth/login", {
      email: EMAIL,
      password: OLD_PASSWORD,
    });
    const oldSession = before.data?.token;
    check(
      "old password signs in before reset",
      before.status === 200 && typeof oldSession === "string",
      `status=${before.status}`,
    );
    const meBefore = await get(base, "/api/auth/me", oldSession);
    check("pre-reset session is valid", meBefore.status === 200, `status=${meBefore.status}`);

    const unknown = await post(base, "/api/auth/forgot-password", {
      email: "nobody@example.com",
    });
    check(
      "unknown email returns the generic response without a token",
      unknown.status === 200 &&
        /If an account exists/.test(unknown.data?.message || "") &&
        !unknown.data?.resetToken,
      `status=${unknown.status}`,
    );

    const forgot = await post(base, "/api/auth/forgot-password", {
      email: EMAIL.toUpperCase(),
    });
    const rawToken = forgot.data?.resetToken;
    check(
      "known email mints a 64-char reset token",
      forgot.status === 200 && TOKEN_RE.test(String(rawToken || "")),
      `status=${forgot.status}`,
    );

    const stored = await User.findById(userId).select("+password");
    const expectedHash = crypto.createHash("sha256").update(String(rawToken)).digest("hex");
    check(
      "database stores only the SHA-256 hash",
      stored.resetPasswordToken === expectedHash && stored.resetPasswordToken !== rawToken,
      "raw token is not persisted",
    );
    check(
      "reset token expiry is about one hour ahead",
      stored.resetPasswordExpires instanceof Date &&
        stored.resetPasswordExpires.getTime() > Date.now() + 50 * 60 * 1000,
      stored.resetPasswordExpires?.toISOString(),
    );

    const shortPassword = await post(base, "/api/auth/reset-password", {
      token: rawToken,
      password: "short",
    });
    check(
      "short password is rejected before changing the account",
      shortPassword.status === 400,
      `status=${shortPassword.status}`,
    );

    const reset = await post(base, "/api/auth/reset-password", {
      token: rawToken,
      password: NEW_PASSWORD,
    });
    check("valid reset token changes the password", reset.status === 200, `status=${reset.status}`);

    const after = await User.findById(userId).select("+password");
    check(
      "new password is stored as a bcrypt hash",
      typeof after.password === "string" &&
        after.password !== NEW_PASSWORD &&
        /^\$2[aby]\$/.test(after.password),
      "hashed",
    );
    check(
      "new password verifies against the stored hash",
      await bcrypt.compare(NEW_PASSWORD, after.password),
      "bcrypt compare",
    );
    check(
      "old password no longer verifies",
      !(await bcrypt.compare(OLD_PASSWORD, after.password)),
      "bcrypt compare",
    );
    check(
      "reset token fields are cleared",
      after.resetPasswordToken === "" && after.resetPasswordExpires === null,
      "cleared",
    );
    check(
      "token version is bumped to revoke existing sessions",
      Number(after.tokenVersion) === initialTokenVersion + 1,
      `${initialTokenVersion} -> ${after.tokenVersion}`,
    );

    const reuse = await post(base, "/api/auth/reset-password", {
      token: rawToken,
      password: "AnotherPass789",
    });
    check(
      "the used reset token cannot be reused",
      reuse.status === 400,
      `status=${reuse.status}`,
    );

    const meOld = await get(base, "/api/auth/me", oldSession);
    check(
      "the pre-reset JWT is rejected",
      meOld.status === 401,
      `status=${meOld.status}`,
    );

    const oldLogin = await post(base, "/api/auth/login", {
      email: EMAIL,
      password: OLD_PASSWORD,
    });
    check("old password no longer signs in", oldLogin.status === 401, `status=${oldLogin.status}`);

    const newLogin = await post(base, "/api/auth/login", {
      email: EMAIL.toUpperCase(),
      password: NEW_PASSWORD,
    });
    check(
      "new password signs in",
      newLogin.status === 200 && typeof newLogin.data?.token === "string",
      `status=${newLogin.status}`,
    );
    const meNew = await get(base, "/api/auth/me", newLogin.data?.token);
    check("new session is valid", meNew.status === 200, `status=${meNew.status}`);
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
      ? "\nALL PASSWORD RESET INTEGRATION TESTS PASSED"
      : `\n${failures} PASSWORD RESET TEST(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
