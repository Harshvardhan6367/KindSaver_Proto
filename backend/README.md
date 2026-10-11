# KindSaver Backend

This is the first backend slice for the Jaipur-first KindSaver product.

It currently runs with native Node.js and in-memory data so we can validate the API, geospatial logic, duplicate detection, and admin lifecycle before connecting MongoDB Atlas.

## Run

```bash
npm run backend:dev
```

Health check:

```bash
GET http://127.0.0.1:4000/health
```

## Test

```bash
npm run backend:test
```

## Current Endpoints

- `GET /health`
- `GET /api/incidents`
- `GET /api/incidents/map`
- `GET /api/dashboard/stats`
- `GET /api/incidents/ticket/:ticketId`
- `GET /api/incidents/ticket/:ticketId/details`
- `GET /api/incidents/:id/details`
- `POST /api/reports`
- `POST /api/incidents/:id/confirm`
- `PATCH /api/admin/incidents/:id/status`
- `PATCH /api/admin/incidents/:id/assign`
- `GET /api/wards/detect?lat=26.8543&lng=75.8069`
- `GET /api/wards/ranking`
- `GET /api/officers`
- `POST /api/dev/reset`

## MongoDB Design

The in-memory documents already use MongoDB-friendly GeoJSON shapes:

```js
location: {
  type: "Point",
  coordinates: [75.8069, 26.8543]
}
```

MongoDB Atlas indexes to add later:

```js
db.incidents.createIndex({ location: "2dsphere" })
db.reports.createIndex({ location: "2dsphere" })
db.wards.createIndex({ boundary: "2dsphere" })
```

MongoDB support is scaffolded in `store/mongoStore.js`.

Use `.env`:

```bash
STORAGE_DRIVER=mongodb
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/
MONGODB_DB=KindSaver_jaipur
```

## Import Real Jaipur Ward Boundaries

After getting the Jaipur ward GeoJSON file:

```bash
npm run backend:import:wards -- path/to/jaipur-wards.geojson
```

The importer accepts GeoJSON `FeatureCollection` files with `Polygon` or `MultiPolygon` geometry.
