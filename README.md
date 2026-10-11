# KindSaver Jaipur

Backend-first prototype for a Jaipur waste-reporting and civic operations product inspired by NammaKasa-style public issue mapping.

## Current State

- Citizen reports with GPS, issue type, description, and optional photo URL.
- Duplicate merge for nearby active incidents.
- Ward detection from GeoJSON-like boundaries.
- Officer assignment and status workflow.
- MongoDB-ready store with geospatial indexes.
- In-memory mode for local development.
- Separate React frontend in `frontend/`.
- Public map, report flow, ticket tracking, and admin dashboard.

## Run Backend

```bash
npm install
npm run backend:dev
```

Health check:

```bash
http://127.0.0.1:4000/health
```

## Test

```bash
npm run backend:test
```

## Run Frontend

The frontend is intentionally kept in its own folder.

```bash
npm run frontend:dev
```

Open:

```bash
http://127.0.0.1:5173/
```

## Next Real Data Needed

- Jaipur ward boundary GeoJSON.
- MongoDB Atlas connection string.
- Final issue categories and status names from the founder.
- Admin roles: city admin, ward officer, collection vendor, field worker.

## Demo Docs

- `docs/Demo_Delivery_Script.md`
- `docs/API_Handoff.md`
- `docs/Later_Phases_Backlog.md`
