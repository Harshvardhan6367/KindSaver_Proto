# KindReport Jaipur Demo Script

Use this flow for the tomorrow demo.

## 1. Start The Product

Backend:

```bash
npm run backend:dev
```

Frontend:

```bash
npm run frontend:dev
```

Open:

```bash
http://127.0.0.1:5173/
```

## 2. Public Map

Show the Jaipur public issue map.

- Point out the active report count.
- Show severity and status filters.
- Switch from Map to List.
- Select one incident and show ticket, ward, report count, GPS, status, and priority.

## 3. Citizen Report Flow

Go to Report.

- Select an issue type.
- Use the prefilled Jaipur GPS point.
- Submit the report.
- Explain that nearby duplicate reports merge into the same public ticket.

## 4. Ticket Tracking

Go to Track.

- Search `KR-2026-0004`.
- Show the status timeline.
- Show assigned officer if available.
- Click Confirm still exists to increase civic signal.

## 5. Admin Dashboard

Go to Admin.

- Show active incidents, total reports, critical issues, and resolved count.
- Show incident queue.
- Assign an officer.
- Change status from open to in progress or resolved.
- Explain that public ticket tracking updates from the same backend workflow.

## 6. Closing Pitch

Position the prototype as:

- Jaipur-first public cleanliness reporting.
- Ward-level operations dashboard.
- Duplicate-aware issue clustering.
- Transparent citizen ticket tracking.
- MongoDB-ready backend for production expansion.
