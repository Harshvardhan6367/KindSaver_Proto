import dns from "node:dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore if custom DNS not allowed in environment
}
import http from "node:http";
import { resolve } from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { verifyToken } from "./auth/tokens.js";
import { createIncidentService, toPublicIncident } from "./services/incidents.js";
import { createAuthService, toPublicUser } from "./services/auth.js";
import { createMediaService } from "./services/media.js";
import { createMemoryStore } from "./store/memoryStore.js";
import { createStore } from "./store/createStore.js";

const PORT = Number(process.env.PORT || 4000);
const store = createMemoryStore();
const incidents = createIncidentService(store);
const defaultConfig = loadConfig();
const auth = createAuthService(store, defaultConfig);
const media = createMediaService(store, defaultConfig);

// In-memory rate limiting map: key -> timestamps[]
const rateLimits = new Map();

export function resetRateLimits() {
  rateLimits.clear();
}

function checkRateLimit(req, bucket = "general", maxRequests = 20, windowMs = 5 * 60 * 1000, config = defaultConfig) {
  const rawIp = (config?.trustProxy && req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"]
    : (req.socket?.remoteAddress || "127.0.0.1");
  const ip = typeof rawIp === "string" ? rawIp.split(",")[0].trim() : "127.0.0.1";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const timestamps = rateLimits.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    const error = new Error("Too many requests. Please slow down and try again later.");
    error.status = 429;
    throw error;
  }

  validTimestamps.push(now);
  rateLimits.set(key, validTimestamps);

  // Clean stale keys periodically to avoid memory leaks
  if (rateLimits.size > 1000) {
    for (const [k, ts] of rateLimits.entries()) {
      if (!ts.some((t) => now - t < windowMs)) {
        rateLimits.delete(k);
      }
    }
  }
}

export function createHttpServer(incidentService = incidents, dataStore = store, config = defaultConfig) {
  const authService = createAuthService(dataStore, config);
  const mediaService = createMediaService(dataStore, config);
  return http.createServer(async (req, res) => handleRequest(req, res, incidentService, dataStore, authService, mediaService, config));
}

async function handleRequest(req, res, incidentService, dataStore, authService = auth, mediaService = media, config = defaultConfig) {
  try {
    const host = req.headers.host || "127.0.0.1";
    const url = new URL(req.url, `http://${host}`);
    if (req.method === "OPTIONS") return send(res, 204, null, config);

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, {
        ok: true,
        service: "kindreport-backend",
        storage: dataStore.storageName || "unknown",
        timestamp: new Date().toISOString()
      }, config);
    }

    // AUTHENTICATION ROUTES
    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      checkRateLimit(req, "auth:login", 30, 5 * 60 * 1000, config);
      return send(res, 200, await authService.login(await readJson(req)), config);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      checkRateLimit(req, "auth:register", 25, 5 * 60 * 1000, config);
      return send(res, 201, await authService.register(await readJson(req)), config);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/forgot-password") {
      checkRateLimit(req, "auth:forgot-password", 15, 5 * 60 * 1000, config);
      return send(res, 200, await authService.requestPasswordReset(await readJson(req)), config);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/reset-password") {
      checkRateLimit(req, "auth:reset-password", 15, 5 * 60 * 1000, config);
      return send(res, 200, await authService.resetPassword(await readJson(req)), config);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = authToken(req);
      if (token) await authService.logout(token);
      return send(res, 200, { ok: true, message: "Logged out successfully." }, config);
    }

    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const actor = requireUser(req, config, [], dataStore);
      const user = await dataStore.getUserById(actor.sub);
      if (!user) {
        const error = new Error("User account no longer exists.");
        error.status = 401;
        throw error;
      }
      return send(res, 200, { user: toPublicUser(user) }, config);
    }

    if (req.method === "PATCH" && url.pathname === "/api/auth/profile") {
      const actor = requireUser(req, config, [], dataStore);
      const updated = await authService.updateProfile(actor.sub, await readJson(req));
      return send(res, 200, { user: updated }, config);
    }

    // STRICT CITIZEN ACCOUNT ISOLATION
    // Citizens can ONLY view their own private reports. Never allow userId override from query param.
    if (req.method === "GET" && url.pathname === "/api/citizen/my-reports") {
      const actor = requireUser(req, config, ["citizen", "admin", "ward_officer"], dataStore);
      const citizenReports = await incidentService.listCitizenReports(actor.sub);
      return send(res, 200, { incidents: citizenReports }, config);
    }

    // MEDIA UPLOADS
    if (req.method === "POST" && url.pathname === "/api/media/upload") {
      checkRateLimit(req, "media", 30, 5 * 60 * 1000);
      return send(res, 201, await mediaService.upload(await readJson(req), optionalUser(req, config, dataStore)), config);
    }

    const mediaMatch = match(url.pathname, /^\/api\/media\/([^/]+)$/);
    if (req.method === "GET" && mediaMatch) {
      const result = await mediaService.read(mediaMatch[1]);
      if (!result) return send(res, 404, { error: "Media not found." }, config);
      res.writeHead(200, {
        "Access-Control-Allow-Origin": config.corsOrigin || "*",
        "Content-Type": result.asset.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff"
      });
      return res.end(result.bytes);
    }

    // PUBLIC DATA ENDPOINTS
    if (req.method === "GET" && url.pathname === "/api/incidents/map") {
      return send(res, 200, await incidentService.getMapIncidents(Object.fromEntries(url.searchParams)), config);
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard/stats") {
      return send(res, 200, await incidentService.getDashboardStats(Object.fromEntries(url.searchParams)), config);
    }

    // Public incident list: Sanitize to prevent leaking private reporter phone/email
    if (req.method === "GET" && url.pathname === "/api/incidents") {
      const rawIncidents = await dataStore.listIncidents(Object.fromEntries(url.searchParams));
      return send(res, 200, { incidents: rawIncidents.map(toPublicIncident) }, config);
    }

    const ticketMatch = match(url.pathname, /^\/api\/incidents\/ticket\/([^/]+)$/);
    if (req.method === "GET" && ticketMatch) {
      const incident = await incidentService.getIncident(safeDecodeURIComponent(ticketMatch[1]));
      return incident ? send(res, 200, { incident: toPublicIncident(incident) }, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    const ticketDetailMatch = match(url.pathname, /^\/api\/incidents\/ticket\/([^/]+)\/details$/);
    if (req.method === "GET" && ticketDetailMatch) {
      const detail = await incidentService.getIncidentDetail(safeDecodeURIComponent(ticketDetailMatch[1]));
      return detail ? send(res, 200, detail, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    const detailMatch = match(url.pathname, /^\/api\/incidents\/([^/]+)\/details$/);
    if (req.method === "GET" && detailMatch) {
      const detail = await incidentService.getIncidentDetail(safeDecodeURIComponent(detailMatch[1]));
      return detail ? send(res, 200, detail, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    // REPORT SUBMISSION: Supports both authenticated residents and low-friction guest reports
    if (req.method === "POST" && url.pathname === "/api/reports") {
      checkRateLimit(req, "reports", 30, 60 * 60 * 1000);
      const actor = optionalUser(req, config, dataStore);
      return send(res, 201, await incidentService.submitReport(await readJson(req), actor), config);
    }

    // CITIZEN CONFIRMATION ("I saw this too")
    const confirmMatch = match(url.pathname, /^\/api\/incidents\/([^/]+)\/confirm$/);
    if (req.method === "POST" && confirmMatch) {
      checkRateLimit(req, "confirm", 40, 5 * 60 * 1000, config);
      const actor = optionalUser(req, config, dataStore);
      const result = await incidentService.confirmIncident(safeDecodeURIComponent(confirmMatch[1]), await readJson(req), actor);
      return result ? send(res, 200, result, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    // PROTECTED ADMINISTRATIVE WORKSPACE ENDPOINTS (Strictly requires admin or ward_officer)
    if (req.method === "GET" && url.pathname === "/api/admin/incidents") {
      requireUser(req, config, ["admin", "ward_officer"], dataStore);
      const incidents = await dataStore.listIncidents(Object.fromEntries(url.searchParams));
      return send(res, 200, { incidents }, config);
    }

    if (req.method === "GET" && url.pathname === "/api/admin/users") {
      requireUser(req, config, ["admin"], dataStore);
      const allUsers = typeof dataStore.listUsers === "function" ? await dataStore.listUsers() : [];
      return send(res, 200, { users: allUsers.map(toPublicUser) }, config);
    }

    if (req.method === "GET" && url.pathname === "/api/admin/audit-logs") {
      requireUser(req, config, ["admin", "ward_officer"], dataStore);
      const snapshot = await dataStore.snapshot();
      return send(res, 200, { auditLogs: snapshot.statusUpdates || [] }, config);
    }

    const statusMatch = match(url.pathname, /^\/api\/admin\/incidents\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      const actor = requireUser(req, config, ["admin", "ward_officer"], dataStore);
      const incident = await incidentService.updateStatus(safeDecodeURIComponent(statusMatch[1]), await readJson(req), actor);
      return incident ? send(res, 200, { incident }, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    const assignMatch = match(url.pathname, /^\/api\/admin\/incidents\/([^/]+)\/assign$/);
    if (req.method === "PATCH" && assignMatch) {
      const actor = requireUser(req, config, ["admin", "ward_officer"], dataStore);
      const incident = await incidentService.assignIncident(safeDecodeURIComponent(assignMatch[1]), await readJson(req), actor);
      return incident ? send(res, 200, { incident }, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    const deptMatch = match(url.pathname, /^\/api\/admin\/incidents\/([^/]+)\/department$/);
    if (req.method === "PATCH" && deptMatch) {
      const actor = requireUser(req, config, ["admin", "ward_officer"], dataStore);
      const incident = await incidentService.assignIncident(safeDecodeURIComponent(deptMatch[1]), await readJson(req), actor);
      return incident ? send(res, 200, { incident }, config) : send(res, 404, { error: "Incident not found." }, config);
    }

    // WARDS & OFFICIAL JURISDICTION ENDPOINTS
    if (req.method === "GET" && url.pathname === "/api/wards/detect") {
      const latParam = url.searchParams.get("lat");
      const lngParam = url.searchParams.get("lng");
      if (latParam === null || lngParam === null || latParam === "" || lngParam === "") {
        const error = new Error("lat and lng query parameters are required.");
        error.status = 400;
        throw error;
      }
      const ward = await incidentService.detectWard(latParam, lngParam);
      return ward ? send(res, 200, { ward }, config) : send(res, 404, { error: "No ward found for this point." }, config);
    }

    if (req.method === "GET" && url.pathname === "/api/wards") {
      return send(res, 200, { wards: await incidentService.listWards() }, config);
    }

    if (req.method === "GET" && url.pathname === "/api/wards.geojson") {
      return send(res, 200, wardsToFeatureCollection(await incidentService.listWards()), config);
    }

    if (req.method === "GET" && url.pathname === "/api/wards/ranking") {
      return send(res, 200, { wards: await incidentService.getWardRanking() }, config);
    }

    if (req.method === "GET" && url.pathname === "/api/officers") {
      return send(res, 200, { officers: await incidentService.listOfficers() }, config);
    }

    if (req.method === "POST" && url.pathname === "/api/dev/reset") {
      if (process.env.NODE_ENV === "production") {
        return send(res, 403, { error: "Reset is disabled in production." }, config);
      }
      return send(res, 200, await incidentService.reset(), config);
    }

    return send(res, 404, { error: "Route not found." }, config);
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError || error instanceof URIError ? 400 : 500);
    return send(res, status, {
      error: status === 500 ? "Internal server error." : error.message,
      detail: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, config);
  }
}

function safeDecodeURIComponent(component) {
  try {
    return decodeURIComponent(component);
  } catch {
    const error = new Error("Malformed URI component in URL path.");
    error.status = 400;
    throw error;
  }
}

const isMain = Boolean(process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
));

if (isMain) {
  const config = loadConfig();
  const configuredStore = await createStore(config);
  const configuredService = createIncidentService(configuredStore);
  createHttpServer(configuredService, configuredStore, config).listen(config.port || PORT, () => {
    console.log(`KindSaver backend running at http://127.0.0.1:${config.port || PORT}`);
    console.log(`Storage driver: ${config.storageDriver}`);
  });
}

function send(res, status, body, config = defaultConfig) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": config.corsOrigin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  res.end(body === null ? "" : JSON.stringify(body, null, 2));
}

function match(pathname, regex) {
  return pathname.match(regex);
}

function wardsToFeatureCollection(wards) {
  return {
    type: "FeatureCollection",
    features: wards.map((ward) => ({
      type: "Feature",
      id: ward.id,
      geometry: ward.boundary,
      properties: {
        id: ward.id,
        wardNumber: ward.wardNumber,
        wardName: ward.wardName,
        zone: ward.zone,
        municipalBody: ward.municipalBody,
        officerId: ward.officerId
      }
    }))
  };
}

async function readJson(req, maxBytes = 10 * 1024 * 1024) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("Request payload too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Malformed JSON request payload.");
    error.status = 400;
    throw error;
  }
}

function optionalUser(req, config, dataStore = null) {
  const token = authToken(req);
  if (!token) return null;
  if (dataStore && typeof dataStore.isTokenRevoked === "function" && dataStore.isTokenRevoked(token) === true) {
    return null;
  }
  const actor = verifyToken(token, config.jwtSecret);
  if (!actor) return null;
  if (dataStore && typeof dataStore.isUserRevoked === "function" && dataStore.isUserRevoked(actor.sub, actor.iat, actor.iatMs) === true) {
    return null;
  }
  return actor;
}

function requireUser(req, config, allowedRoles = [], dataStore = null) {
  const token = authToken(req);
  if (!token) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  if (dataStore && typeof dataStore.isTokenRevoked === "function" && dataStore.isTokenRevoked(token) === true) {
    const error = new Error("Session has been terminated or expired. Please sign in again.");
    error.status = 401;
    throw error;
  }
  const actor = verifyToken(token, config.jwtSecret);
  if (!actor) {
    const error = new Error("Authentication token is invalid or has expired.");
    error.status = 401;
    throw error;
  }
  if (dataStore && typeof dataStore.isUserRevoked === "function" && dataStore.isUserRevoked(actor.sub, actor.iat, actor.iatMs) === true) {
    const error = new Error("Session has been terminated or expired. Please sign in again.");
    error.status = 401;
    throw error;
  }
  if (allowedRoles.length && !allowedRoles.includes(actor.role)) {
    const error = new Error("You do not have permission to perform this action.");
    error.status = 403;
    throw error;
  }
  return actor;
}

function authToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}
