# API Handoff

Base URL for local demo:

```txt
http://127.0.0.1:4000
```

## Public Map

```txt
GET /api/incidents/map
GET /api/incidents/map?status=open&priority=critical
```

Returns GeoJSON `FeatureCollection` for Leaflet markers.

## Dashboard Stats

```txt
GET /api/dashboard/stats
```

Returns totals, status breakdown, priority breakdown, ward hotspots, and officer workload.

## Submit Report

```txt
POST /api/reports
```

Example body:

```json
{
  "lat": 26.8543,
  "lng": 75.8069,
  "issueType": "overflowing_bin",
  "description": "Overflowing bin near the road",
  "gpsAccuracyMeters": 8,
  "photoUrl": ""
}
```

The backend creates a new incident or merges into a nearby active incident.

## Track Ticket

```txt
GET /api/incidents/ticket/KR-2026-0004/details
POST /api/incidents/inc-4/confirm
```

Returns the incident, public reports, confirmations, status updates, and timeline.

## Admin Workflow

```txt
GET /api/incidents
PATCH /api/admin/incidents/:id/assign
PATCH /api/admin/incidents/:id/status
```

Assignment body:

```json
{
  "officerId": "officer-anita"
}
```

Status body:

```json
{
  "status": "in_progress",
  "actorId": "demo-admin",
  "note": "Field team dispatched"
}
```
