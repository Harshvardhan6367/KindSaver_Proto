export function generateTicketId(date = new Date(), sequence = 1) {
  const year = date.getFullYear();
  return `KR-${year}-${String(sequence).padStart(4, "0")}`;
}

export function nextSequenceFromIncidents(incidents) {
  return incidents.reduce((highest, incident) => {
    const match = /^KR-\d{4}-(\d+)$/.exec(incident.ticketId);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
}
