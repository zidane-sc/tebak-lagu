// Assert-based self-check for the admin guard. Run: node scripts/check-admin-guard.js
process.env.ADMIN_PASSCODE = "test-pass";
const assert = require("assert");

const { isPasscodeValid, adminSessionToken, isAdminCookieValid, isAdminRequest } = require("../src/lib/admin-guard.ts");

// passcode comparison
assert.strictEqual(isPasscodeValid("test-pass"), true, "correct passcode must pass");
assert.strictEqual(isPasscodeValid("wrong"), false, "wrong passcode must fail");
assert.strictEqual(isPasscodeValid(""), false, "empty passcode must fail");

// session token is derived, not the passcode itself
const token = adminSessionToken();
assert.ok(token && token.length === 64, "session token must be a sha256 hex digest");
assert.notStrictEqual(token, "test-pass", "session token must not equal the passcode");

// cookie validation
assert.strictEqual(isAdminCookieValid(token), true, "valid token must pass");
assert.strictEqual(isAdminCookieValid("test-pass"), false, "raw passcode as cookie must fail");
assert.strictEqual(isAdminCookieValid(undefined), false, "missing cookie must fail");
assert.strictEqual(isAdminCookieValid("deadbeef"), false, "short garbage cookie must fail");
assert.strictEqual(isAdminCookieValid(token + "0"), false, "extended token must fail");

// request-level check
const ok = new Request("https://x/api/admin/settings", { headers: { cookie: `tl_admin=${token}` } });
assert.strictEqual(isAdminRequest(ok), true, "request with valid cookie must pass");
const bare = new Request("https://x/api/admin/settings");
assert.strictEqual(isAdminRequest(bare), false, "request without cookie must fail");

// fail closed when the passcode env is unset
delete process.env.ADMIN_PASSCODE;
assert.strictEqual(isPasscodeValid("test-pass"), false, "unset env must reject every passcode");
assert.strictEqual(adminSessionToken(), null, "unset env must yield no session token");
assert.strictEqual(isAdminCookieValid(token), false, "unset env must reject previously valid cookie");

console.log("admin-guard: all 14 assertions passed");
