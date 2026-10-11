# Backend Phase Roadmap

## Phase 1 - Core Reporting API

Done in the current backend:

- Health check.
- Submit waste report.
- Merge duplicate reports into nearby incidents.
- Generate public ticket ID.
- Detect ward from GPS.
- List incidents as GeoJSON for map UI.
- Assign officer and update status.
- MongoDB store and geospatial index scaffold.

## Phase 2 - Trackable Product Workflow

Build next:

- Incident detail API with report history, confirmations, and status timeline.
- Public ticket tracking endpoint.
- Admin status audit trail.
- Stronger validation for coordinates, accuracy, title, and photo metadata.
- API docs for frontend integration.

## Phase 3 - Jaipur Accuracy Layer

Requires real data:

- Import Jaipur ward GeoJSON.
- Validate sample GPS points across Jaipur.
- Add nearest-ward fallback for boundary gaps.
- Add zone and contractor mappings.

## Phase 4 - Operations Dashboard

- Admin filters by ward, status, priority, zone, date, and officer.
- SLA queues and overdue detection.
- Officer workload summary.
- Export-ready CSV or JSON reports.

## Phase 5 - Authentication and Production Hardening

- Citizen anonymous device identity.
- Admin login and role based access.
- Rate limiting.
- Media upload pipeline.
- Notification queue.
- Deployment and environment setup.
