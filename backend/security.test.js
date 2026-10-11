import test from "node:test";
import assert from "node:assert/strict";
import { createHttpServer } from "./server.js";
import { createIncidentService } from "./services/incidents.js";
import { createMemoryStore } from "./store/memoryStore.js";
import { loadConfig } from "./config.js";

function setupApp() {
  const store = createMemoryStore();
  const incidents = createIncidentService(store);
  const config = loadConfig();
  const server = createHttpServer(incidents, store, config);
  return { server, store, config };
}

async function request(server, path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  let bodyBuffer = null;

  if (options.body) {
    bodyBuffer = Buffer.from(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    headers["content-type"] = headers["content-type"] || "application/json";
    headers["content-length"] = bodyBuffer.length;
  }

  return new Promise((resolve) => {
    server.emit("request", {
      method,
      url: path,
      headers,
      [Symbol.asyncIterator]: async function* () {
        if (bodyBuffer) yield bodyBuffer;
      },
      socket: { remoteAddress: "127.0.0.1" }
    }, {
      writeHead(status, resHeaders) {
        this.statusCode = status;
        this.resHeaders = resHeaders;
      },
      end(chunk) {
        const bodyText = chunk ? chunk.toString("utf-8") : "";
        let json = null;
        try {
          json = bodyText ? JSON.parse(bodyText) : null;
        } catch {}
        resolve({
          status: this.statusCode,
          headers: this.resHeaders,
          text: bodyText,
          body: json
        });
      }
    });
  });
}

test("PHASE 8 SECURITY AUDIT: Complete 12-Point Security Suite", async (t) => {
  const { server } = setupApp();

  // TEST 1: Register a new account. Confirm that its role is USER (citizen).
  await t.test("TEST 1: Register account defaults to citizen role", async () => {
    const res = await request(server, "/api/auth/register", {
      method: "POST",
      body: {
        name: "Test Citizen One",
        email: "citizen1@test.jaipur",
        password: "Password@123"
      }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "citizen");
    assert.ok(res.body.token);
  });

  // TEST 2: Attempt to submit role=ADMIN during signup. Confirm administrator privileges are not granted.
  await t.test("TEST 2: Attempting role=admin during signup is rejected / forced to citizen", async () => {
    const res = await request(server, "/api/auth/register", {
      method: "POST",
      body: {
        name: "Malicious Hacker",
        email: "hacker@test.jaipur",
        password: "HackerPassword@123",
        role: "admin", // Malicious injection attempt
        officerId: "officer-anita"
      }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "citizen", "Role MUST NOT be admin; must be citizen");
    assert.equal(res.body.user.officerId, null, "officerId MUST NOT be assigned during registration");
  });

  // Setup accounts for remaining tests
  const user1Auth = await request(server, "/api/auth/register", {
    method: "POST",
    body: { name: "Citizen User 1", email: "user1@jaipur.citizen", password: "Password@123" }
  });
  const user1Token = user1Auth.body.token;
  const user1Id = user1Auth.body.user.id;

  const user2Auth = await request(server, "/api/auth/register", {
    method: "POST",
    body: { name: "Citizen User 2", email: "user2@jaipur.citizen", password: "Password@123" }
  });
  const user2Token = user2Auth.body.token;
  const user2Id = user2Auth.body.user.id;

  const adminAuth = await request(server, "/api/auth/login", {
    method: "POST",
    body: { email: "admin@kindreport.local", password: "Admin@12345" }
  });
  const adminToken = adminAuth.body.token;

  // TEST 3 & 4: Call administrative API as a normal user. Confirm backend rejects with 403.
  await t.test("TEST 3 & 4: Normal citizen cannot call admin APIs (403 Forbidden)", async () => {
    const resIncidents = await request(server, "/api/admin/incidents", {
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.equal(resIncidents.status, 403, "Citizen cannot list admin incidents");

    const resUsers = await request(server, "/api/admin/users", {
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.equal(resUsers.status, 403, "Citizen cannot list users");

    const resAudit = await request(server, "/api/admin/audit-logs", {
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.equal(resAudit.status, 403, "Citizen cannot read audit logs");

    const resStatus = await request(server, "/api/admin/incidents/inc-test/status", {
      method: "PATCH",
      headers: { authorization: `Bearer ${user1Token}` },
      body: { status: "resolved" }
    });
    assert.equal(resStatus.status, 403, "Citizen cannot update status");
  });

  // TEST 5: Change local storage/payloads claiming admin privileges. Confirm access denied.
  await t.test("TEST 5: Forged headers or tampered payloads fail token verification", async () => {
    const forgedToken = user1Token.replace(/\.[^.]+$/, ".invalidsignature");
    const res = await request(server, "/api/admin/incidents", {
      headers: { authorization: `Bearer ${forgedToken}` }
    });
    assert.equal(res.status, 401, "Forged token fails authentication");
  });

  // TEST 6 & 7: Account Isolation & IDOR Prevention: User 1 and User 2 cannot access each other's private reports.
  await t.test("TEST 6 & 7: Account isolation and IDOR protection on private reports", async () => {
    // Submit report as User 1
    const report1 = await request(server, "/api/reports", {
      method: "POST",
      headers: { authorization: `Bearer ${user1Token}` },
      body: {
        issueType: "garbage_dump",
        lat: 26.85,
        lng: 75.80,
        description: "Private waste complaint by user 1"
      }
    });
    assert.equal(report1.status, 201);

    // User 1 requests their reports: sees 1 report
    const user1Reports = await request(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.equal(user1Reports.status, 200);
    assert.ok(user1Reports.body.incidents.length >= 1);

    // User 2 requests their reports: does NOT see User 1's report
    const user2Reports = await request(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${user2Token}` }
    });
    assert.equal(user2Reports.status, 200);
    const hasUser1Report = user2Reports.body.incidents.some((i) => i.reporterUserId === user1Id);
    assert.equal(hasUser1Report, false, "User 2 MUST NOT see User 1's reports");

    // Attempting query parameter override ?userId=<user1Id> while authenticated as User 2
    const idorAttempt = await request(server, `/api/citizen/my-reports?userId=${user1Id}`, {
      headers: { authorization: `Bearer ${user2Token}` }
    });
    assert.equal(idorAttempt.status, 200);
    const leakedUser1 = idorAttempt.body.incidents.some((i) => i.reporterUserId === user1Id);
    assert.equal(leakedUser1, false, "IDOR bypass attempt failed: User 2 still cannot see User 1's reports");

    // Unauthenticated request to /api/citizen/my-reports rejected with 401
    const unauthReports = await request(server, "/api/citizen/my-reports");
    assert.equal(unauthReports.status, 401, "Unauthenticated access rejected");
  });

  // TEST 8: Log in as administrator. Confirm legitimate administrative functions work.
  await t.test("TEST 8: Administrator functions work properly", async () => {
    const adminIncidents = await request(server, "/api/admin/incidents", {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminIncidents.status, 200);
    assert.ok(Array.isArray(adminIncidents.body.incidents));

    const adminUsers = await request(server, "/api/admin/users", {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminUsers.status, 200);
    assert.ok(Array.isArray(adminUsers.body.users));

    const auditLogs = await request(server, "/api/admin/audit-logs", {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(auditLogs.status, 200);
    assert.ok(Array.isArray(auditLogs.body.auditLogs));
  });

  // TEST 9: Log out and confirm session revocation on replay.
  await t.test("TEST 9: Logout revokes session token", async () => {
    const logoutRes = await request(server, "/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.equal(logoutRes.status, 200);

    // Replay request with revoked token
    const replayed = await request(server, "/api/citizen/my-reports", {
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.equal(replayed.status, 401, "Revoked token must be rejected with 401");
  });

  // TEST 10: Auth persistence / me endpoint restores valid session.
  await t.test("TEST 10: Auth /me restores valid session for active token", async () => {
    const meRes = await request(server, "/api/auth/me", {
      headers: { authorization: `Bearer ${user2Token}` }
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.id, user2Id);
    assert.equal(meRes.body.user.role, "citizen");
  });

  // TEST 11: Invalid input, malformed payload, expired password reset token tests.
  await t.test("TEST 11: Input validation and safe password reset flow", async () => {
    // Malformed report
    const badReport = await request(server, "/api/reports", {
      method: "POST",
      body: { issueType: "invalid_type", lat: "not_a_number", lng: 75.8 }
    });
    assert.equal(badReport.status, 400);

    // Request password reset
    const forgotRes = await request(server, "/api/auth/forgot-password", {
      method: "POST",
      body: { email: "user2@jaipur.citizen" }
    });
    assert.equal(forgotRes.status, 200);
    assert.ok(forgotRes.body.ok);
    const token = forgotRes.body.resetToken;
    assert.ok(token);

    // Reset password with valid token
    const resetRes = await request(server, "/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword: "NewSecretPassword@999" }
    });
    assert.equal(resetRes.status, 200);

    // Attempt to reuse the same single-use token: must fail
    const reusedTokenRes = await request(server, "/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword: "AnotherPassword@999" }
    });
    assert.equal(reusedTokenRes.status, 400, "Single-use token cannot be reused");
  });

  // TEST 12: Public report access does NOT expose private reporter phone or private user id.
  await t.test("TEST 12: Public endpoints sanitize private reporter information", async () => {
    const publicIncidents = await request(server, "/api/incidents");
    assert.equal(publicIncidents.status, 200);
    for (const inc of publicIncidents.body.incidents) {
      assert.equal(inc.reporterPhone, undefined, "reporterPhone must never be in public incident");
      assert.equal(inc.reporterUserId, undefined, "reporterUserId must never be in public incident");
    }

    const mapIncidents = await request(server, "/api/incidents/map");
    assert.equal(mapIncidents.status, 200);
    for (const f of mapIncidents.body.features) {
      assert.equal(f.properties.reporterPhone, undefined, "reporterPhone must never be in public map features");
      assert.equal(f.properties.reporterUserId, undefined, "reporterUserId must never be in public map features");
    }
  });
});
