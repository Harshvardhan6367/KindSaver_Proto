import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { detectWard, nearestWard, toPoint } from "../domain/geo.js";

const wardsPath = process.argv[2] || "data/processed/jaipur_wards.normalized.geojson";
const pointsPath = process.argv[3] || "data/validation/jaipur_sample_points.json";
const outputPath = process.argv[4] || "data/validation/jaipur_sample_points.detected.json";

const wardsGeojson = JSON.parse(await readFile(wardsPath, "utf-8"));
const points = JSON.parse(await readFile(pointsPath, "utf-8"));

const wards = wardsGeojson.features.map((feature) => ({
  id: feature.properties.id || feature.id,
  wardNumber: feature.properties.wardNumber,
  wardName: feature.properties.wardName,
  zone: feature.properties.zone,
  municipalBody: feature.properties.municipalBody,
  boundary: feature.geometry
}));

const results = points.map((sample) => {
  const point = toPoint(sample.lng, sample.lat);
  const ward = detectWard(point, wards);
  const nearest = ward ? null : nearestWard(point, wards);
  return {
    ...sample,
    detected: ward ? {
      wardNumber: ward.wardNumber,
      wardName: ward.wardName,
      zone: ward.zone,
      municipalBody: ward.municipalBody
    } : null,
    nearest: nearest ? {
      wardNumber: nearest.ward.wardNumber,
      wardName: nearest.ward.wardName,
      zone: nearest.ward.zone,
      distanceMeters: Math.round(nearest.distanceMeters)
    } : null,
    ok: Boolean(ward)
  };
});

const report = {
  ok: results.every((result) => result.ok),
  wardsPath,
  pointsPath,
  generatedAt: new Date().toISOString(),
  total: results.length,
  matched: results.filter((result) => result.ok).length,
  unmatched: results.filter((result) => !result.ok).map((result) => result.name),
  results
};

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
