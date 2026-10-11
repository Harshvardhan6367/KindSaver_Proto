# KindReport Jaipur — Comprehensive Bug Audit & Remediation Report

**Date of Audit:** October 10, 2026  
**Auditor Roles:** Principal Software Engineer, Senior QA Automation Engineer, Application Security Engineer, Database Engineer, Site Reliability Engineer  
**Target Application:** KindReport Jaipur (Jaipur-first civic reporting and waste management platform)  
**Status:** Audit Complete & Verified

---

## 1. Project Architecture Summary

KindReport Jaipur is a civic technology platform modeled on municipal waste reporting systems, specialized for the Jaipur Municipal Corporation (Jaipur Nagar Nigam Greater & Heritage).

### Architecture Stack
- **Backend Framework:** Native Node.js HTTP service (`node:http`, ESM), zero unnecessary third-party runtime server dependencies.
- **Data Persistence:** Pluggable dual-driver store architecture:
  - `memory`: In-memory data store with Jaipur wards, officers, and incident seed fixtures.
  - `mongodb`: MongoDB driver (`^7.7.0`) with 2dsphere geospatial indexing, unique constraints, and automated seeding.
- **Authentication & Security:**
  - Token-based JWT implementation (`HS256`, HMAC-SHA256) with 12-hour expiration and server-side token revocation tracking.
  - Password hashing via Node.js native `crypto.scrypt` with cryptographic salts and timing-safe equality comparisons (`timingSafeEqual`).
  - Strict Role-Based Access Control (RBAC): Citizens (`citizen`), Ward Officers (`ward_officer`), and Municipal Administrators (`admin`).
- **Geospatial & Ward Attribution:**
  - Ray-casting point-in-polygon algorithm (`pointInPolygon`) and Haversine distance calculation in `backend/domain/geo.js`.
  - Jaipur municipal boundary lock: `[26.62, 75.48]` to `[27.18, 76.12]`.
  - Proximity deduplication window: 20 meters within 72 hours.
- **Frontend Stack:**
  - React 19.2.0, Vite 7.1.9, Leaflet 1.9.4 for GIS mapping, Lucide React 0.545.0 for UI iconography.
  - Custom Vanilla CSS (`styles.css`) design system without framework bloat.
  - Full bilingual localization (`i18n.js` in Hindi and English).

---

## 2. Routes and Features Inspected

### Public & Citizen Endpoints
- `GET /health`: SRE service health check and active storage driver status.
- `GET /api/incidents/map`: GeoJSON FeatureCollection of public waste incidents.
- `GET /api/incidents`: Sanitized public incident feed (personal citizen phone/emails scrubbed).
- `GET /api/incidents/ticket/:id`: Public ticket lookup by reference code (KR-YYYY-XXXX).
- `GET /api/incidents/ticket/:id/details`: Full public timeline, status updates, and resolution proof.
- `POST /api/reports`: Citizen report filing with GPS coordinates and evidence photo upload.
- `POST /api/incidents/:id/confirm`: "I saw this too" community confirmation action.
- `GET /api/wards.geojson`: Municipal ward boundaries as a GeoJSON FeatureCollection.
- `GET /api/wards/detect`: Geospatial ward resolver from latitude and longitude.
- `GET /api/wards/ranking`: Risk ranking and incident density per ward.
- `GET /api/officers`: Official municipal officer directory.
- `POST /api/media/upload`: Base64 photo evidence ingestion with MIME validation.
- `GET /api/media/:id`: Public immutable photo asset stream.

### Authentication Endpoints
- `POST /api/auth/register`: Public citizen account signup (strictly enforced role: `citizen`).
- `POST /api/auth/login`: Account authentication returning JWT.
- `GET /api/auth/me`: Session identity verification.
- `PATCH /api/auth/profile`: Resident profile management.
- `POST /api/auth/forgot-password`: Rate-limited password recovery.
- `POST /api/auth/reset-password`: Single-use reset token verification and password update.
- `POST /api/auth/logout`: Revocation of active session token.

### Protected Administrative Endpoints (RBAC: `admin` & `ward_officer`)
- `GET /api/admin/incidents`: Unsanitized operational triage queue.
- `GET /api/admin/users`: Municipal resident directory (admin-only).
- `GET /api/admin/audit-logs`: Tamper-evident status transition history.
- `PATCH /api/admin/incidents/:id/status`: Transition lifecycle status with audit notes and photo proof.
- `PATCH /api/admin/incidents/:id/assign`: Forward ticket to department and assign ward officer.

---

## 3. Discovered Defects & Detailed Root Cause Analysis

### AUDIT-001 (P0 — Critical): Unverified Client-Side Session on Application Mount
- **Impact:** If a token expired, was revoked by logout, or was tampered with, `App.jsx` rendered the user as logged in or administrator. When actions failed with 401, localStorage was cleared by `api.js`, but React state was not notified, causing a broken UI state.
- **Root Cause:** Missing mount-time verification against `/api/auth/me` and absence of an event bridge between `api.js` and `App.jsx`.
- **Fix:** Implemented `onAuthChange` listener pattern in `api.js` and `validateSession()` in `App.jsx` which queries `/api/auth/me` on mount. Stale sessions are automatically cleared.
- **Files Modified:** `frontend/src/api.js`, `frontend/src/App.jsx`.

### AUDIT-002 (P1 — High): Merged Duplicate Reports Dropped Citizen Identity
- **Impact:** When a resident reported a garbage dump already reported nearby, the report merged into the active incident to elevate priority, but the second resident's user ID was omitted. Consequently, the ticket was invisible in the second resident's "My Reports" dashboard.
- **Root Cause:** `reporterUserId` was omitted from `store.createReport`, and `listCitizenReports(userId)` only checked `incident.reporterUserId === userId`.
- **Fix:** Persisted `reporterUserId` on the report record in `submitReport` and updated `listCitizenReports(userId)` to search both primary incident ownership and linked report contributions.
- **Files Modified:** `backend/services/incidents.js`.
- **Regression Test:** `backend/regression.test.js` (Test 4).

### AUDIT-003 (P1 — High): Uploaded Photo Evidence Missing in Public & Track Screens
- **Impact:** Citizens who submitted photo evidence never saw the photo on MapScreen or TrackScreen because `incident.photoUrl` was undefined.
- **Root Cause:** `photoUrl` was not stored on the `incident` object schema in `incidents.js` and was excluded from `toPublicIncident`.
- **Fix:** Added `photoUrl: payload.photoUrl || null` to incident creation, added photoUrl inheritance upon duplicate merging, included `photoUrl` in `toPublicIncident`, and added fallback resolution in `getIncidentDetail`.
- **Files Modified:** `backend/services/incidents.js`, `frontend/src/components/TrackScreen.jsx`.
- **Regression Test:** `backend/regression.test.js` (Test 5).

### AUDIT-004 (P1 — High): White Blank Screen Crash on MapScreen During Loading
- **Impact:** If `stats` was loading or null, traversing `stats?.totals.reports` threw an unhandled TypeError, crashing the entire UI.
- **Root Cause:** Optional chaining was missing on `totals` (`stats?.totals.reports`).
- **Fix:** Replaced with safe optional chaining (`stats?.totals?.reports ?? 0`).
- **Files Modified:** `frontend/src/components/MapScreen.jsx`.

### AUDIT-005 (P2 — Medium): Malformed JSON Caused HTTP 500 Server Error
- **Impact:** Client sending malformed JSON received HTTP 500 Internal Server Error instead of HTTP 400 Bad Request.
- **Root Cause:** `readJson` called `JSON.parse` directly; syntax errors lack `status` and defaulted to 500 in the global error handler.
- **Fix:** Wrapped `JSON.parse` in try-catch in `readJson` to throw `400 Malformed JSON request payload.`.
- **Files Modified:** `backend/server.js`.
- **Regression Test:** `backend/regression.test.js` (Test 1).

### AUDIT-006 (P2 — Medium): Missing Request Payload Size Limits (DoS Vulnerability)
- **Impact:** An attacker could stream arbitrarily large request bodies, exhausting server heap memory and crashing the process.
- **Root Cause:** `readJson` read streams without tracking total byte size.
- **Fix:** Added accumulator with a 10MB ceiling; requests exceeding the limit throw HTTP 413 Payload Too Large.
- **Files Modified:** `backend/server.js`.
- **Regression Test:** `backend/regression.test.js` (Test 2).

### AUDIT-007 (P2 — Medium): Memory Leak in Rate Limiting Table
- **Impact:** `rateLimits` Map grew indefinitely as new IP addresses connected.
- **Root Cause:** Keys were never pruned after timestamps expired.
- **Fix:** Added automatic garbage collection to prune expired keys whenever the table exceeds 1,000 entries.
- **Files Modified:** `backend/server.js`.

### AUDIT-008 (P2 — Medium): Media Read Threw 500 on Missing Disk Files
- **Impact:** If an uploaded image was removed from disk, `GET /api/media/:id` threw an unhandled ENOENT error (HTTP 500).
- **Root Cause:** `mediaService.read` lacked an ENOENT error handler.
- **Fix:** Caught ENOENT and returned `null`, allowing `server.js` to send a clean 404 response.
- **Files Modified:** `backend/services/media.js`.
- **Regression Test:** `backend/regression.test.js` (Test 6).

### AUDIT-009 (P2 — Medium): Out-of-Bounds Geographic Coordinates Bypassed Validation
- **Impact:** Latitude/longitude outside [-90, 90] and [-180, 180] bypassed payload validation and crashed downstream domain functions with 500 errors.
- **Root Cause:** `validateReportPayload` only checked `Number.isFinite()`.
- **Fix:** Added strict range checks for latitude (-90 to 90) and longitude (-180 to 180) returning HTTP 400.
- **Files Modified:** `backend/domain/validation.js`.
- **Regression Test:** `backend/regression.test.js` (Test 3).

### AUDIT-010 (P2 — Medium): Unhandled SyntaxError in Token Verification
- **Impact:** Malformed base64 JSON token payloads caused `JSON.parse` to throw an unhandled exception in `verifyToken`.
- **Root Cause:** Missing try-catch block around base64 decode and parse in `tokens.js`.
- **Fix:** Wrapped in try-catch and validated payload object structure.
- **Files Modified:** `backend/auth/tokens.js`.
- **Regression Test:** `backend/regression.test.js` (Test 7).

### AUDIT-011 (P2 — Medium): Profile Update Desynchronization
- **Impact:** When a citizen saved their profile in `CitizenDashboard`, `currentUser` in `App.jsx` was not updated until full page reload.
- **Root Cause:** Missing `onUpdateUser` callback from `App.jsx`.
- **Fix:** Wired `onUpdateUser` prop to `CitizenDashboard` and dispatched on profile save.
- **Files Modified:** `frontend/src/App.jsx`, `frontend/src/components/CitizenDashboard.jsx`.

### AUDIT-012 (P2 — Medium): Stale Search Input in `TrackScreen`
- **Impact:** Clicking "Track Ticket" from Map or Landing screen did not update the search input box.
- **Root Cause:** `searchInput` was initialized once with `useState(ticketId)` without a synchronization hook.
- **Fix:** Added `useEffect` syncing `searchInput` whenever `ticketId` prop changes.
- **Files Modified:** `frontend/src/components/TrackScreen.jsx`.

### AUDIT-013 (P2 — Medium): Unsupported Image Types & Object URL Memory Leak
- **Impact:** `PhotoUpload` accepted any MIME type starting with `image/` (e.g., SVG, TIFF) which failed on backend, and leaked object URLs in memory.
- **Root Cause:** Loose MIME check and missing `URL.revokeObjectURL` calls.
- **Fix:** Restricted file selection to JPEG/PNG/WebP, added cleanup on unmount/re-selection, and synced `preview` with `value` prop.
- **Files Modified:** `frontend/src/components/PhotoUpload.jsx`.

### AUDIT-014 (P2 — Medium): Mobile Topbar Navigation Overflow
- **Impact:** On viewport widths under 768px (especially 320px–430px), topbar navigation tabs and portal toggle overflowed horizontally.
- **Root Cause:** Missing responsive layout rules for `.topbar-center-nav` and `.portal-mode-pill-toggle`.
- **Fix:** Added comprehensive responsive CSS media queries for `<768px` and `<480px` supporting scrollable tab bars and stacked portal toggle.
- **Files Modified:** `frontend/src/styles.css`.

### AUDIT-015 (P3 — Low): Brand Logo Element Missing Keyboard Handler
- **Impact:** Keyboard users navigating via Tab could not trigger home navigation using Enter or Space.
- **Root Cause:** `div.brand` had `role="button"` and `tabIndex={0}` but lacked an `onKeyDown` handler.
- **Fix:** Added `onKeyDown` supporting Enter and Space key activation.
- **Files Modified:** `frontend/src/components/Header.jsx`.

### AUDIT-016 (P1 — High): Private Resident Contact Data Leaked on Public Ticket Endpoint
- **Impact:** Any unauthenticated visitor querying `/api/incidents/ticket/:id/details` could inspect the full `reports` array containing private resident contact information (`reporterPhone`, `reporterUserId`, and `reporterName`).
- **Root Cause:** While `/api/incidents` sanitized records with `toPublicIncident`, `getIncidentDetail` returned raw report documents without sanitization.
- **Fix:** Sanitized public incident details via `toPublicIncident(incident)` and ensured private fields are never leaked.
- **Files Modified:** `backend/services/incidents.js`.
- **Regression Test:** `backend/regression.test.js` (Test 8).

### AUDIT-017 (P1 — High): Unchecked Duplicate & Post-Resolution Community Confirmations
- **Impact:** Anyone could submit infinite automated POST requests to `/api/incidents/:id/confirm`, artificially inflating ticket endorsement metrics, and could confirm tickets that had already been resolved or closed.
- **Root Cause:** Missing validation on incident status and absence of device/user confirmation deduplication.
- **Fix:** Enforced status validation (rejecting confirmations on resolved/closed tickets with HTTP 400) and added deduplication tracking via IP/user fingerprints (rejecting duplicate confirmations from the same resident/device with HTTP 409 Conflict).
- **Files Modified:** `backend/services/incidents.js`.
- **Regression Test:** `backend/regression.test.js` (Test 11).

### AUDIT-018 (P2 — Medium): Uncaught URIError on Malformed URL-Encoded Route Parameters
- **Impact:** Requests containing malformed percent-encoded sequences (e.g., `/api/incidents/ticket/%E0%A4%A`) threw an uncaught `URIError` inside `decodeURIComponent`, causing unhandled HTTP 500 server crashes.
- **Root Cause:** Native `decodeURIComponent` throws `URIError` if input contains malformed percent encodings, which was not caught prior to route matching.
- **Fix:** Added `safeDecodeURIComponent` in `server.js` and updated the global catch block to map `URIError` and `SyntaxError` to clean HTTP 400 Bad Request responses.
- **Files Modified:** `backend/server.js`.
- **Regression Test:** `backend/regression.test.js` (Test 9).

### AUDIT-019 (P2 — Medium): Stale Resolution Timestamps Retained on Reopened Incidents
- **Impact:** When an administrator transitioned an incident from `resolved` back to `reopened` or `in_progress`, the original `resolvedAt` and `closedAt` timestamps remained set, corrupting operational SLA reports and resolution analytics.
- **Root Cause:** `updateStatus` in `incidents.js` set `resolvedAt = now` on resolve, but never cleared them when transitioning back to active states.
- **Fix:** Explicitly set `resolvedAt = null` and `closedAt = null` when transitioning to `reopened`, `in_progress`, or `assigned`.
- **Files Modified:** `backend/services/incidents.js`.
- **Regression Test:** `backend/regression.test.js` (Test 12).

### AUDIT-020 (P2 — Medium): N+1 Sequential Query Loop in `listCitizenReports`
- **Impact:** Loading a citizen's reports triggered an O(N) sequential scan over every incident in the database to inspect individual report objects.
- **Root Cause:** Store lacked a targeted index and lookup method for `reporterUserId`.
- **Fix:** Implemented fast-path lookup in `listCitizenReports`, added `listReportsByReporterUserId` to both `memoryStore` and `mongoStore` drivers, and created compound indexes in `mongoCollections.js`.
- **Files Modified:** `backend/services/incidents.js`, `backend/store/memoryStore.js`, `backend/store/mongoStore.js`, `backend/store/mongoCollections.js`.
- **Regression Test:** `backend/regression.test.js` (Test 4).

### AUDIT-021 (P2 — Medium): Official Municipal Administrator Account Mismatch in Seed
- **Impact:** UI placeholders prompted municipal staff to log in with `admin@jaipur.gov.in`, but memory store seeds only contained `admin@kindreport.local`.
- **Root Cause:** Inconsistent seeding between development memory store and production guidelines.
- **Fix:** Seeded both `admin@jaipur.gov.in` and `admin@kindreport.local` with verified password hashes and administrative privileges across all store drivers.
- **Files Modified:** `backend/data/seed.js`.
- **Regression Test:** `backend/regression.test.js` (Test 15).

### AUDIT-022 (P2 — Medium): Silent Failure on Resident Profile & Incident Priority Validation
- **Impact:** Submitting invalid profile names or out-of-range ward numbers was silently ignored without user feedback, and `assignIncident` allowed arbitrary strings for priority.
- **Root Cause:** Missing field validation in `auth.updateProfile` and missing priority enumeration validation in `incidents.assignIncident`.
- **Fix:** Added strict name length (>=2 chars), ward number range (1-250), and priority validation (`critical`, `high`, `medium`, `low`) returning HTTP 400.
- **Files Modified:** `backend/services/auth.js`, `backend/services/incidents.js`, `backend/domain/validation.js`.
- **Regression Test:** `backend/regression.test.js` (Tests 13 & 14).

### AUDIT-023 (P2 — Medium): Over 50 Unstyled CSS Classes Across Citizen Portal & Tracking
- **Impact:** The citizen reports table, guest landing screen, overview cards, profile forms, and tracking states lacked CSS rules, causing layout collapse and mobile horizontal overflow.
- **Root Cause:** Frontend JSX components introduced newer dashboard elements without corresponding CSS rule declarations in `styles.css`.
- **Fix:** Implemented comprehensive, responsive Vanilla CSS rules for `.citizen-tickets-table-container`, `.guest-card-container`, `.empty-tracking-state`, `.spin`, and supporting color tokens.
- **Files Modified:** `frontend/src/styles.css`.
- **Regression Test:** Verified via Vite production build (`npm run frontend:build`).

### AUDIT-024 (P2 — Medium): Report Form State Retention Across Submissions
- **Impact:** After successfully submitting a civic waste report, `reportForm` retained previous GPS coordinates and photo evidence on subsequent reporting attempts.
- **Root Cause:** Missing form state reset upon successful API submission.
- **Fix:** Reset `reportForm` to `DEFAULT_REPORT_FORM` inside `submitReport` upon successful submission in `App.jsx`.
- **Files Modified:** `frontend/src/App.jsx`.

### AUDIT-025 (P2 — Medium): Missing Reopened Status Option in Admin Modal
- **Impact:** Municipal staff could not transition an erroneously closed ticket to `reopened` through the operational UI.
- **Root Cause:** The status select input in `AdminScreen.jsx` omitted the `reopened` status option.
- **Fix:** Added `<option value="reopened">Reopen Investigation</option>` to the status change modal.
- **Files Modified:** `frontend/src/components/AdminScreen.jsx`.

### AUDIT-026 (P1 — High): Swallowed Exception in Frontend Incident Confirmation Flow
- **Impact:** When a user confirmed an incident that was already resolved or that they had previously confirmed from their device, the backend returned HTTP 400 or 409 Conflict. However, `confirmIncident` in `App.jsx` caught the exception, displayed an error alert, but failed to re-throw it. As a result, `TrackScreen.jsx` treated the promise as resolved and displayed a misleading green "Confirmation submitted successfully!" banner.
- **Root Cause:** Missing `throw err;` in the catch block of `confirmIncident` in `App.jsx`.
- **Fix:** Added `throw err;` after setting error state in `App.jsx`, ensuring callers like `TrackScreen.jsx` correctly register the rejection and do not show false success indicators.
- **Files Modified:** `frontend/src/App.jsx`.
- **Verification:** Verified through caller propagation and frontend bundle build.

### AUDIT-027 (P1 — High): Compromised JWT Sessions Retained Access Following Password Reset
- **Impact:** When an account password was reset via `/api/auth/reset-password`, previously issued JWT tokens remained completely valid for the remainder of their 12-hour TTL. If an account was compromised, changing the password did not revoke the attacker's active sessions.
- **Root Cause:** Token verification only checked expiration and explicit single-token logout revocation; it had no mechanism for user-level session revocation upon credential changes.
- **Fix:** Implemented user revocation tracking with millisecond precision (`revokeUser` and `isUserRevoked` in both `memoryStore` and `mongoStore`). Tokens now embed `iatMs`. Upon password reset, `revokeUser(userId)` is invoked, and `requireUser`/`optionalUser` immediately reject any tokens issued prior to the password change with HTTP 401.
- **Files Modified:** `backend/store/memoryStore.js`, `backend/store/mongoStore.js`, `backend/auth/tokens.js`, `backend/services/auth.js`, `backend/server.js`.
- **Regression Test:** `backend/regression.test.js` (Test 17).

### AUDIT-028 (P1 — High): Media Upload Permitted File Masquerading via Unverified MIME Types
- **Impact:** An attacker could upload arbitrary binary payloads or scripts to `/api/media/upload` by merely supplying `contentType: "image/jpeg"`. The backend trusted the client-supplied header without inspecting the binary contents, enabling MIME spoofing and storing non-image content in the media directory.
- **Root Cause:** Absence of binary magic byte validation on decoded image buffers.
- **Fix:** Implemented `matchesMagicBytes(buffer, contentType)` in `backend/services/media.js` verifying the magic byte signatures for JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), and WebP (`RIFF...WEBP`). Mismatched payloads are rejected with HTTP 400.
- **Files Modified:** `backend/services/media.js`.
- **Regression Test:** `backend/regression.test.js` (Test 16).

### AUDIT-029 (P2 — Medium): Incident Mutations Rejected Human-Readable Ticket IDs
- **Impact:** Municipal staff or citizens attempting to confirm, update status, or assign an incident using its public ticket code (e.g. `KR-2026-0001`) received HTTP 404 because `/confirm`, `/status`, and `/assign` only matched internal UUIDs (`getIncidentById`). Additionally, URLs with percent-encoded identifiers lacked safe decoding.
- **Root Cause:** Mutation routes assumed internal IDs and did not support ticket ID lookup fallback, and raw route match params were passed directly without `safeDecodeURIComponent`.
- **Fix:** Updated `confirmIncident`, `updateStatus`, and `assignIncident` in `backend/services/incidents.js` to look up by ticket ID if the identifier starts with `KR-`, canonicalized updates to the underlying UUID, and wrapped route parameters with `safeDecodeURIComponent` in `backend/server.js`.
- **Files Modified:** `backend/services/incidents.js`, `backend/server.js`.
- **Regression Test:** `backend/regression.test.js` (Test 18).

### AUDIT-030 (P2 — Medium): Missing MongoDB Index on Users Collection Causing O(N) Scans
- **Impact:** Every authenticated request to `/api/auth/me`, every password reset, and every user lookup triggered an unindexed collection scan across `collections.users` on `id`, causing database latency degradation at scale.
- **Root Cause:** Index creation script and collection initializer configured indexes for `incidents`, `reports`, and `tokens`, but omitted an index on `{ id: 1 }` for `users`.
- **Fix:** Added `{ id: 1 }, { unique: true }` index definition to `collections.users` in `backend/store/mongoCollections.js`.
- **Files Modified:** `backend/store/mongoCollections.js`.
- **Verification:** Verified via collection index specification and MongoDB dual-store test suite.

### AUDIT-031 (P2 — Medium): Registered Citizen Reports Omitted Contact Phone Numbers
- **Impact:** When a registered citizen submitted a civic report, the incident's `reporterPhone` was recorded as `null` even though the user had provided a verified phone number during registration.
- **Root Cause:** `signToken` in `backend/auth/tokens.js` omitted `phone` and `wardNumber` from the JWT claims payload, leaving `actor.phone` undefined in authenticated request contexts.
- **Fix:** Added `phone` and `wardNumber` to `signToken` JWT claims, and updated `submitReport` to fall back to `payload.phone` if `actor.phone` is absent.
- **Files Modified:** `backend/auth/tokens.js`, `backend/services/incidents.js`.
- **Regression Test:** `backend/regression.test.js` (Test 21).

### AUDIT-032 (P2 — Medium): Priority Calculation Poisoned by NaN Age When CreatedAt Missing
- **Impact:** If an incident record lacked `createdAt` or had an invalid date string, `new Date(createdAt).getTime()` returned `NaN`. Math operations with `NaN` resulted in `score = NaN`, which bypassed all thresholds and caused urgent incidents to default to `"low"` priority.
- **Root Cause:** Unchecked date parsing in `calculatePriority` in `backend/domain/priority.js`.
- **Fix:** Added `Number.isFinite(createdTime)` defensive guard defaulting to `Date.now()`, ensuring valid score calculation regardless of input timestamp state.
- **Files Modified:** `backend/domain/priority.js`.
- **Regression Test:** `backend/regression.test.js` (Test 19).

### AUDIT-033 (P2 — Medium): Rate Limiter Vulnerable to X-Forwarded-For IP Spoofing
- **Impact:** Clients could bypass rate limits on sensitive endpoints (`/api/auth/login`, `/api/reports`) by rotating arbitrary `X-Forwarded-For` header values, even in environments with no trusted reverse proxy.
- **Root Cause:** `checkRateLimit` in `backend/server.js` unconditionally preferred `req.headers["x-forwarded-for"]` over `req.socket.remoteAddress`.
- **Fix:** Added `trustProxy` configuration flag (defaulting to `false`) in `backend/config.js` and updated `checkRateLimit` to only inspect `X-Forwarded-For` when `config.trustProxy === true`.
- **Files Modified:** `backend/config.js`, `backend/server.js`.
- **Regression Test:** `backend/regression.test.js` (Test 20).

### AUDIT-034 (P2 — Medium): Ward Detection Crashed on Malformed Boundary Geometries
- **Impact:** If a ward polygon record contained null, undefined, or empty coordinates (e.g. from a partial GIS import), `pointInPolygon` crashed with an uncaught `TypeError: Cannot read properties of undefined (reading 'length')`.
- **Root Cause:** Missing structural validation on polygon ring coordinate arrays in `backend/domain/geo.js`.
- **Fix:** Added defensive guards verifying `Array.isArray(polygon)` and `polygon.length >= 3` before executing ray-casting in `pointInPolygon`, and validated coordinate presence in `detectWard`.
- **Files Modified:** `backend/domain/geo.js`.
- **Regression Test:** `backend/regression.test.js` (Test 22).

### AUDIT-035 (P3 — Low): CSS Issue Type Badge Classes Mismatched Domain Values
- **Impact:** Incident issue badges in tracking and operational lists rendered with unstyled gray fallbacks because CSS selector class names (`.type-garbage`, `.type-drain_blockage`) did not match domain issue type strings (`type-garbage_dump`, `type-drain_blocked`, `type-construction_debris`, `type-hazardous_waste`).
- **Root Cause:** Styling classes written against legacy naming conventions rather than domain `ISSUE_TYPES` enum.
- **Fix:** Updated `frontend/src/styles.css` to define distinct background and text colors for all valid domain issue types while preserving backward compatibility.
- **Files Modified:** `frontend/src/styles.css`.
- **Verification:** Verified via Vite production build.

### AUDIT-036 (P3 — Low): Admin Screen UI RBAC Leak for Registered Citizens Tab
- **Impact:** The "Registered Citizens" tab button was rendered for users with the `ward_officer` role, but clicking it led to an unhandled 403 Forbidden error because the underlying `/api/admin/users` endpoint is strictly admin-only.
- **Root Cause:** Tab navigation in `AdminScreen.jsx` did not filter citizen directory access based on `currentUser?.role`.
- **Fix:** Added role guard in `AdminScreen.jsx` so the "Registered Citizens" tab is only rendered when `currentUser?.role === 'admin'`.
- **Files Modified:** `frontend/src/components/AdminScreen.jsx`.
- **Verification:** Verified via component JSX audit and Vite production build.

---

## 4. Test Execution & Verification Results

### Complete Test Suite Execution Summary
Executed via `npm run backend:test`:
```txt
> kindreport-jaipur@0.1.0 backend:test
> node --test backend/**/*.test.js

▶ REGRESSION TEST SUITE: Hardened Server, Data Integrity & Civic Lifecycle
  ✔ 1. Malformed JSON payload returns HTTP 400 Bad Request instead of 500 (1.8669ms)
  ✔ 2. Oversized payload returns HTTP 413 Payload Too Large (9.3226ms)
  ✔ 3. Coordinate boundary validation rejects out-of-range latitude/longitude with 400 (1.4285ms)
  ✔ 4. Duplicate report merging retains citizen reporter association in /api/citizen/my-reports (87.9386ms)
  ✔ 5. Photo evidence is persisted on incident and returned in public listings & ticket details (1.5547ms)
  ✔ 6. Requesting non-existent media file returns 404 cleanly without 500 error (0.3111ms)
  ✔ 7. Token verification safely handles malformed JSON payload without unhandled exception (0.2631ms)
  ✔ 8. Incident details sanitizes private citizen data (reporterPhone, reporterUserId) on public endpoint (41.958ms)
  ✔ 9. Malformed URI component returns HTTP 400 Bad Request instead of 500 error (0.8863ms)
  ✔ 10. Ward detect requires valid lat and lng query parameters (0.8502ms)
  ✔ 11. Incident confirmation prevents duplicate submissions and cannot confirm resolved incidents (42.1603ms)
  ✔ 12. Status transition to reopened/in_progress resets resolvedAt and closedAt timestamps (0.6815ms)
  ✔ 13. assignIncident validates priority values and rejects invalid entries with 400 (0.6348ms)
  ✔ 14. Profile update validates full name and ward number (35.7549ms)
  ✔ 15. Both admin@jaipur.gov.in and admin@kindreport.local authenticate successfully (0.3497ms)
  ✔ 16. MIME magic byte verification rejects spoofed image uploads with HTTP 400 (3.6935ms)
  ✔ 17. Password reset immediately invalidates all pre-existing JWT session tokens (104.3285ms)
  ✔ 18. Incident confirmation, status, and assignment accept Ticket ID format (KR-YYYY-XXXX) (0.9108ms)
  ✔ 19. Priority calculation defensively handles missing or invalid createdAt without NaN (0.16ms)
  ✔ 20. Rate limiter does not trust spoofed X-Forwarded-For when trustProxy is false (1.2952ms)
  ✔ 21. Citizen report captures reporterPhone from registration profile (35.1555ms)
  ✔ 22. detectWard defensively handles null, undefined, or empty ward geometries (0.2089ms)
✔ REGRESSION TEST SUITE: Hardened Server, Data Integrity & Civic Lifecycle (378.4473ms)
▶ PHASE 8 SECURITY AUDIT: Complete 12-Point Security Suite
  ✔ TEST 1: Register account defaults to citizen role (42.2961ms)
  ✔ TEST 2: Attempting role=admin during signup is rejected / forced to citizen (47.2271ms)
  ✔ TEST 3 & 4: Normal citizen cannot call admin APIs (403 Forbidden) (1.8802ms)
  ✔ TEST 5: Forged headers or tampered payloads fail token verification (0.4312ms)
  ✔ TEST 6 & 7: Account isolation and IDOR protection on private reports (2.1377ms)
  ✔ TEST 8: Administrator functions work properly (1.7139ms)
  ✔ TEST 9: Logout revokes session token (0.5897ms)
  ✔ TEST 10: Auth /me restores valid session for active token (0.3763ms)
  ✔ TEST 11: Input validation and safe password reset flow (36.7549ms)
  ✔ TEST 12: Public endpoints sanitize private reporter information (0.9865ms)
✔ PHASE 8 SECURITY AUDIT: Complete 12-Point Security Suite (221.797ms)
✔ HTTP API returns map data, detects ward, and merges duplicate report (64.4093ms)
✔ HTTP API handles authentication, media upload, and protected admin endpoints (63.7442ms)
✔ detects Jaipur ward from GPS point (3.3028ms)
✔ merges duplicate report into nearby active incident (2.2138ms)
✔ creates new incident for a non-duplicate report (1.1208ms)
✔ updates incident status (0.6629ms)
✔ builds dashboard stats for active Jaipur operations (0.9767ms)
✔ returns citizen-safe incident detail with timeline (1.3767ms)
✔ computes nearest ward for diagnostics (0.7505ms)
✔ MongoDB store persists and queries geospatial data (10427.4843ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10595.3041
```

### Production Build Validation
Executed via `npm run frontend:build`:
```txt
> kindreport-frontend@0.1.0 build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 1684 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DR1iJRJQ.css  100.56 kB │ gzip:  20.83 kB
dist/assets/index-C7OHzVjK.js   517.31 kB │ gzip: 149.96 kB
✓ built in 6.91s
```
Zero build errors or syntax warnings.

---

## 5. Security & SRE Hardening Checklist

- [x] **Zero Admin Elevation on Registration:** Public signup strictly sets `role: "citizen"` and `officerId: null`.
- [x] **IDOR & Account Isolation:** Citizens can only view their own private reports via `/api/citizen/my-reports`.
- [x] **Sanitization of Public Feeds:** Phone numbers, emails, and exact reporter identity are scrubbed from public incident listings.
- [x] **Cryptographic Security:** Scrypt hashing with high-entropy salts; timing-safe comparisons against timing attacks.
- [x] **Token Invalidation on Logout:** Token revocation on logout tracked both in-memory and in MongoDB `revoked_tokens`.
- [x] **Token Invalidation on Password Reset:** Immediate revocation of all pre-existing session tokens with millisecond-precision cutoff (`isUserRevoked`).
- [x] **Binary Magic Byte Verification:** Photo upload validates binary file signatures (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`) preventing MIME spoofing.
- [x] **Proxy-Aware Rate Limiting:** Rate limiting inspects `X-Forwarded-For` only when `trustProxy` is explicitly enabled; isolated buckets per sensitive endpoint.
- [x] **Payload Size Limits:** Max 10MB request bodies with HTTP 413 protection against heap exhaustion.
- [x] **Geospatial Boundary Hardening:** Leaflet viewports locked strictly to Jaipur district bounds; WGS84 range verification; defensive handling of malformed polygons.
- [x] **Safe Media Access:** Strict MIME checks and error handling preventing 500 crashes on disk read errors.
- [x] **URI Component Protection:** URL-encoded request paths are safely decoded with fallback preventing unhandled `URIError`.
- [x] **Civic Confirmation Deduplication:** Device fingerprint hashing and state validation preventing duplicate submissions or confirmation on closed tickets.
- [x] **Data Integrity on Reopened Tickets:** Lifecycle transitions clear obsolete timestamps (`resolvedAt`, `closedAt`) when reopening cases.
- [x] **Database Indexing:** Unique indexes on `users.id`, `incidents.ticketId`, 2dsphere on `incidents.location`, and compound index on `reports.reporterUserId`.
- [x] **UI Exception Integrity:** Re-throw API rejections in client action handlers to prevent false positive success indicators.

---

## 6. Recommended Next Steps

1. **Production Reverse Proxy:** When deploying to production behind an AWS ALB or Nginx reverse proxy, configure `trust proxy` settings to ensure client IP addresses are accurately retrieved from proxy headers.
2. **Object Storage Integration:** For production scale beyond 100,000 photos, consider attaching an S3/Cloud Storage driver to `createMediaService` while retaining the current local upload driver for zero-dependency local development.
3. **Automated Ward Polygon Refresh:** Schedule `npm run backend:normalize:wards` if Jaipur Nagar Nigam redrawn ward boundaries are published by the state election commission.
