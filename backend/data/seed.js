export const officers = [
  {
    id: "officer-deepak",
    name: "Deepak Verma",
    role: "ward_officer",
    phone: "+91-90000-00042",
    email: "deepak.verma@kindreport.local",
    wardNumbers: [42],
    zone: "South",
    organisation: "Green Clean Pvt Ltd"
  },
  {
    id: "officer-priya",
    name: "Priya Gupta",
    role: "ward_officer",
    phone: "+91-90000-00051",
    email: "priya.gupta@kindreport.local",
    wardNumbers: [51],
    zone: "West",
    organisation: "Swachh Jaipur Services"
  },
  {
    id: "officer-anita",
    name: "Anita Joshi",
    role: "ward_officer",
    phone: "+91-90000-00038",
    email: "anita.joshi@kindreport.local",
    wardNumbers: [38],
    zone: "East",
    organisation: "Clean City Corp"
  },
  {
    id: "officer-kavita",
    name: "Kavita Singh",
    role: "ward_officer",
    phone: "+91-90000-00012",
    email: "kavita.singh@kindreport.local",
    wardNumbers: [12, 15],
    zone: "Central",
    organisation: "Civil Clean Services"
  },
  {
    id: "officer-mukesh",
    name: "Mukesh Patel",
    role: "ward_officer",
    phone: "+91-90000-00067",
    email: "mukesh.patel@kindreport.local",
    wardNumbers: [67],
    zone: "South",
    organisation: "Sanganer Clean Corp"
  }
];

export const users = [
  {
    id: "user-admin",
    name: "Jaipur City Admin",
    email: "admin@kindreport.local",
    role: "admin",
    officerId: null,
    devPassword: "Admin@12345",
    createdAt: "2026-10-08T00:00:00.000Z"
  },
  {
    id: "user-admin-official",
    name: "Jaipur Municipal Administrator",
    email: "admin@jaipur.gov.in",
    role: "admin",
    officerId: null,
    devPassword: "Admin@12345",
    createdAt: "2026-10-08T00:00:00.000Z"
  },
  {
    id: "user-officer-anita",
    name: "Anita Joshi",
    email: "anita@kindreport.local",
    role: "ward_officer",
    officerId: "officer-anita",
    devPassword: "Officer@12345",
    createdAt: "2026-10-08T00:00:00.000Z"
  },
  {
    id: "user-officer-priya",
    name: "Priya Gupta",
    email: "priya@kindreport.local",
    role: "ward_officer",
    officerId: "officer-priya",
    devPassword: "Officer@12345",
    createdAt: "2026-10-08T00:00:00.000Z"
  },
  {
    id: "user-citizen-rohit",
    name: "Rohit Sharma",
    email: "rohit@jaipur.citizen",
    phone: "+91-98290-11223",
    role: "citizen",
    wardNumber: 38,
    officerId: null,
    devPassword: "Citizen@12345",
    createdAt: "2026-10-08T00:00:00.000Z"
  },
  {
    id: "user-citizen-meera",
    name: "Meera Verma",
    email: "meera@jaipur.citizen",
    phone: "+91-98290-44556",
    role: "citizen",
    wardNumber: 51,
    officerId: null,
    devPassword: "Citizen@12345",
    createdAt: "2026-10-08T00:00:00.000Z"
  }
];

export const wards = [
  {
    id: "ward-42",
    wardNumber: 42,
    wardName: "Mansarovar Sector 7",
    zone: "South",
    municipalBody: "Jaipur Municipal Corporation",
    officerId: "officer-deepak",
    boundary: rectanglePolygon(75.753, 26.843, 75.770, 26.858)
  },
  {
    id: "ward-51",
    wardNumber: 51,
    wardName: "Vaishali Nagar Main Road",
    zone: "West",
    municipalBody: "Jaipur Municipal Corporation",
    officerId: "officer-priya",
    boundary: rectanglePolygon(75.732, 26.905, 75.754, 26.923)
  },
  {
    id: "ward-38",
    wardNumber: 38,
    wardName: "Malviya Nagar Circle",
    zone: "East",
    municipalBody: "Jaipur Municipal Corporation",
    officerId: "officer-anita",
    boundary: rectanglePolygon(75.795, 26.846, 75.818, 26.864)
  },
  {
    id: "ward-12",
    wardNumber: 12,
    wardName: "Civil Lines",
    zone: "Central",
    municipalBody: "Jaipur Municipal Corporation",
    officerId: "officer-kavita",
    boundary: rectanglePolygon(75.771, 26.900, 75.790, 26.918)
  },
  {
    id: "ward-15",
    wardNumber: 15,
    wardName: "C-Scheme",
    zone: "Central",
    municipalBody: "Jaipur Municipal Corporation",
    officerId: "officer-kavita",
    boundary: rectanglePolygon(75.790, 26.906, 75.806, 26.922)
  },
  {
    id: "ward-67",
    wardNumber: 67,
    wardName: "Sanganer Industrial Area",
    zone: "South",
    municipalBody: "Jaipur Municipal Corporation",
    officerId: "officer-mukesh",
    boundary: rectanglePolygon(75.776, 26.799, 75.802, 26.820)
  }
];

export const incidents = [
  seedIncident({
    id: "inc-1",
    ticketId: "KR-2026-0001",
    wardNumber: 42,
    location: [75.7613, 26.8506],
    issueType: "garbage_dump",
    status: "assigned",
    priority: "critical",
    reportCount: 12,
    title: "Mansarovar Sector 7, near main drain",
    description: "Large plastic waste pile near the main drain. Overflowing for more than 5 days.",
    assignedOfficerId: "officer-deepak",
    minutesAgo: 10
  }),
  seedIncident({
    id: "inc-2",
    ticketId: "KR-2026-0002",
    wardNumber: 51,
    location: [75.7433, 26.9124],
    issueType: "garbage_dump",
    status: "open",
    priority: "high",
    reportCount: 7,
    title: "Vaishali Nagar Main Road, opposite petrol pump",
    description: "Roadside garbage heap not cleared for 3 days near school and petrol pump.",
    assignedOfficerId: null,
    minutesAgo: 32
  }),
  seedIncident({
    id: "inc-3",
    ticketId: "KR-2026-0003",
    wardNumber: 12,
    location: [75.7801, 26.9094],
    issueType: "garbage_dump",
    status: "resolved",
    priority: "medium",
    reportCount: 4,
    title: "Civil Lines Gate No. 2, near bus stop",
    description: "Mixed garbage near bus stop from nearby shops.",
    assignedOfficerId: "officer-kavita",
    minutesAgo: 60
  }),
  seedIncident({
    id: "inc-4",
    ticketId: "KR-2026-0004",
    wardNumber: 38,
    location: [75.8069, 26.8543],
    issueType: "overflowing_bin",
    status: "open",
    priority: "critical",
    reportCount: 19,
    title: "Malviya Nagar Circle, B-Block",
    description: "Large overflowing bin at the circle. Not emptied for 4 days.",
    assignedOfficerId: null,
    minutesAgo: 120
  }),
  seedIncident({
    id: "inc-5",
    ticketId: "KR-2026-0005",
    wardNumber: 15,
    location: [75.7973, 26.9127],
    issueType: "garbage_dump",
    status: "resolved",
    priority: "low",
    reportCount: 3,
    title: "C-Scheme, near HDFC Bank crossing",
    description: "Fresh plastic bottles, packaging, and food waste near the crossing.",
    assignedOfficerId: "officer-kavita",
    minutesAgo: 180
  }),
  seedIncident({
    id: "inc-6",
    ticketId: "KR-2026-0006",
    wardNumber: 67,
    location: [75.7882, 26.8099],
    issueType: "hazardous_waste",
    status: "assigned",
    priority: "critical",
    reportCount: 31,
    title: "Sanganer Industrial Area, Gate 3",
    description: "Chemical waste dumped near nala. Strong smell and visible mixed solid waste.",
    assignedOfficerId: "officer-mukesh",
    minutesAgo: 300
  }),
  seedIncident({
    id: "inc-7",
    ticketId: "KR-2026-0007",
    wardNumber: 42,
    location: [75.7589, 26.8531],
    issueType: "missed_collection",
    status: "in_progress",
    priority: "high",
    reportCount: 16,
    title: "Mansarovar Sector 5, community bin lane",
    description: "Daily collection missed near apartment lane. Waste is blocking pedestrian access.",
    assignedOfficerId: "officer-deepak",
    minutesAgo: 420
  }),
  seedIncident({
    id: "inc-8",
    ticketId: "KR-2026-0008",
    wardNumber: 51,
    location: [75.7505, 26.9186],
    issueType: "construction_debris",
    status: "open",
    priority: "medium",
    reportCount: 9,
    title: "Vaishali Nagar, near nursery circle",
    description: "Construction debris dumped along the service road after renovation work.",
    assignedOfficerId: null,
    minutesAgo: 560
  }),
  seedIncident({
    id: "inc-9",
    ticketId: "KR-2026-0009",
    wardNumber: 38,
    location: [75.8124, 26.8602],
    issueType: "drain_blocked",
    status: "verified",
    priority: "high",
    reportCount: 14,
    title: "Malviya Nagar, Gaurav Tower back lane",
    description: "Drain blocked by mixed waste after market closing hours.",
    assignedOfficerId: "officer-anita",
    minutesAgo: 640
  }),
  seedIncident({
    id: "inc-10",
    ticketId: "KR-2026-0010",
    wardNumber: 12,
    location: [75.7861, 26.9148],
    issueType: "overflowing_bin",
    status: "assigned",
    priority: "medium",
    reportCount: 11,
    title: "Civil Lines, hospital road bin point",
    description: "Overflowing bin near hospital approach road causing smell and traffic slowdown.",
    assignedOfficerId: "officer-kavita",
    minutesAgo: 720
  }),
  seedIncident({
    id: "inc-11",
    ticketId: "KR-2026-0011",
    wardNumber: 15,
    location: [75.8021, 26.9176],
    issueType: "garbage_dump",
    status: "closed",
    priority: "low",
    reportCount: 6,
    title: "C-Scheme, Tilak Marg service cut",
    description: "Small fresh dump reported and cleared by the morning collection team.",
    assignedOfficerId: "officer-kavita",
    minutesAgo: 860
  }),
  seedIncident({
    id: "inc-12",
    ticketId: "KR-2026-0012",
    wardNumber: 67,
    location: [75.7986, 26.8157],
    issueType: "garbage_dump",
    status: "open",
    priority: "critical",
    reportCount: 27,
    title: "Sanganer, textile unit service road",
    description: "Mixed industrial and household waste accumulating near textile unit service road.",
    assignedOfficerId: null,
    minutesAgo: 940
  }),
  seedIncident({
    id: "inc-13",
    ticketId: "KR-2026-0013",
    wardNumber: 42,
    location: [75.7664, 26.8468],
    issueType: "overflowing_bin",
    status: "resolved",
    priority: "medium",
    reportCount: 8,
    title: "Mansarovar, metro pillar approach",
    description: "Bin overflow reported near metro approach and cleared after field verification.",
    assignedOfficerId: "officer-deepak",
    minutesAgo: 1140
  }),
  seedIncident({
    id: "inc-14",
    ticketId: "KR-2026-0014",
    wardNumber: 38,
    location: [75.8009, 26.8504],
    issueType: "hazardous_waste",
    status: "assigned",
    priority: "critical",
    reportCount: 22,
    title: "Malviya Nagar, clinic waste near lane end",
    description: "Suspected clinic waste bags found near the end of a residential lane.",
    assignedOfficerId: "officer-anita",
    minutesAgo: 1280
  }),
  seedIncident({
    id: "inc-15",
    ticketId: "KR-2026-0015",
    wardNumber: 51,
    location: [75.7367, 26.9095],
    issueType: "garbage_dump",
    status: "in_progress",
    priority: "high",
    reportCount: 18,
    title: "Vaishali Nagar, Queens Road corner",
    description: "Large roadside pile near commercial corner. Pickup vehicle marked as dispatched.",
    assignedOfficerId: "officer-priya",
    minutesAgo: 1460
  })
];

export const reports = incidents.map((incident) => ({
  id: `report-${incident.id}`,
  incidentId: incident.id,
  deviceHash: "seed-device",
  issueType: incident.issueType,
  description: incident.description,
  location: incident.location,
  gpsAccuracyMeters: 12,
  photoUrl: null,
  createdAt: incident.createdAt,
  capturedAt: incident.createdAt
}));

export const confirmations = [];
export const statusUpdates = [];
export const mediaAssets = [];

function rectanglePolygon(west, south, east, north) {
  return {
    type: "Polygon",
    coordinates: [[
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south]
    ]]
  };
}

export function inferDepartment(issueType) {
  switch (issueType) {
    case "drain_blocked":
      return "Drainage & Sewerage";
    case "construction_debris":
      return "C&D Debris Management";
    case "hazardous_waste":
      return "Hazardous & Biomedical Waste";
    case "missed_collection":
      return "Door-to-Door Collection & Transport";
    case "overflowing_bin":
    case "garbage_dump":
    default:
      return "Solid Waste Management (SWM)";
  }
}

function seedIncident(input) {
  const ward = wards.find((item) => item.wardNumber === input.wardNumber);
  const createdAt = new Date(Date.now() - input.minutesAgo * 60 * 1000).toISOString();
  const isRohitReport = input.id === "inc-4" || input.id === "inc-1" || input.id === "inc-6";
  return {
    id: input.id,
    ticketId: input.ticketId,
    title: input.title,
    description: input.description,
    issueType: input.issueType,
    department: input.department || inferDepartment(input.issueType),
    status: input.status,
    priority: input.priority,
    reportCount: input.reportCount,
    location: {
      type: "Point",
      coordinates: input.location
    },
    wardNumber: ward.wardNumber,
    wardName: ward.wardName,
    zone: ward.zone,
    assignedOfficerId: input.assignedOfficerId,
    reporterUserId: isRohitReport ? "user-citizen-rohit" : (input.reporterUserId || null),
    reporterName: isRohitReport ? "Rohit Sharma" : (input.reporterName || "Anonymous Citizen"),
    createdAt,
    updatedAt: createdAt,
    resolvedAt: input.status === "resolved" ? createdAt : null,
    closedAt: null
  };
}
