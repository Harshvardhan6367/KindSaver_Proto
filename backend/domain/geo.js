const EARTH_RADIUS_METERS = 6371008.8;

export function toPoint(lng, lat) {
  const longitude = Number(lng);
  const latitude = Number(lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    const error = new Error("Longitude and latitude must be valid numbers.");
    error.status = 400;
    throw error;
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    const error = new Error("Coordinates are outside valid WGS84 bounds.");
    error.status = 400;
    throw error;
  }
  return {
    type: "Point",
    coordinates: [longitude, latitude]
  };
}

export function distanceMeters(pointA, pointB) {
  const [lng1, lat1] = pointA.coordinates.map(toRadians);
  const [lng2, lat2] = pointB.coordinates.map(toRadians);
  const deltaLat = lat2 - lat1;
  const deltaLng = lng2 - lng1;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function pointInPolygon(point, polygon) {
  if (!point?.coordinates || !polygon?.coordinates) return false;
  const coordinates = polygon.type === "Polygon"
    ? polygon.coordinates
    : polygon.coordinates.flat();
  return coordinates.some((ring) => Array.isArray(ring) && isInsideRing(point.coordinates, ring));
}

export function detectWard(point, wards) {
  if (!point || !Array.isArray(wards)) return null;
  return wards.find((ward) => ward?.boundary && pointInPolygon(point, ward.boundary)) || null;
}

export function nearestWard(point, wards) {
  return wards
    .map((ward) => ({
      ward,
      distanceMeters: distanceToGeometryMeters(point, ward.boundary)
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
}

export function distanceToGeometryMeters(point, geometry) {
  const rings = geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
  return Math.min(...rings.flatMap((ring) => distancesToRing(point, ring)));
}

function isInsideRing([lng, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distancesToRing(point, ring) {
  const distances = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    distances.push(distanceToSegmentMeters(point.coordinates, ring[i], ring[i + 1]));
  }
  return distances;
}

function distanceToSegmentMeters(pointCoordinates, startCoordinates, endCoordinates) {
  const [lng, lat] = pointCoordinates;
  const [startLng, startLat] = startCoordinates;
  const [endLng, endLat] = endCoordinates;
  const dx = endLng - startLng;
  const dy = endLat - startLat;

  if (dx === 0 && dy === 0) {
    return distanceMeters(
      { type: "Point", coordinates: pointCoordinates },
      { type: "Point", coordinates: startCoordinates }
    );
  }

  const t = Math.max(0, Math.min(1, ((lng - startLng) * dx + (lat - startLat) * dy) / (dx * dx + dy * dy)));
  const projection = [startLng + t * dx, startLat + t * dy];
  return distanceMeters(
    { type: "Point", coordinates: pointCoordinates },
    { type: "Point", coordinates: projection }
  );
}

function toRadians(value) {
  return value * Math.PI / 180;
}
