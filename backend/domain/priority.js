const ISSUE_WEIGHTS = {
  hazardous_waste: 50,
  drain_blocked: 35,
  garbage_dump: 25,
  overflowing_bin: 25,
  construction_debris: 20,
  missed_collection: 18,
  other: 12
};

export function calculatePriority({ issueType, reportCount, createdAt, status }) {
  const base = ISSUE_WEIGHTS[issueType] || ISSUE_WEIGHTS.other;
  const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now();
  const safeTime = Number.isFinite(createdTime) ? createdTime : Date.now();
  const ageHours = Math.max(0, (Date.now() - safeTime) / 36e5);
  const score =
    base +
    Math.max(0, reportCount - 1) * 3 +
    (ageHours >= 72 ? 25 : ageHours >= 24 ? 10 : 0) +
    (status !== "resolved" && status !== "closed" ? 5 : 0);

  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function areCompatibleIssueTypes(a, b) {
  if (a === b) return true;
  const dumpingFamily = new Set(["garbage_dump", "overflowing_bin", "construction_debris"]);
  return dumpingFamily.has(a) && dumpingFamily.has(b);
}
