/* ==========================================================================
   RGE Project Tracker — 5 Clean Sample Projects
   Covers all 4 Service Columns & all 5 Project Status Columns:
     Service Tracks:  Supply & Delivery | Supply only | Supply & Install | Install/Services
     Project Status:  Survey | Project awarded | On-going project | Project completed | Hold
   ========================================================================== */

window.RGE_TRACKER_DATA = (() => {
  const COLUMNS = [
    {
      id: "supply-delivery",
      label: "Supply & Delivery",
      accent: "#2573BA",
      description: "Equipment & materials procurement with scheduled on-site logistics & delivery.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`
    },
    {
      id: "supply-only",
      label: "Supply only",
      accent: "#5B46A8",
      description: "Hardware, optical fiber, switches, firewalls & passive BOM supply / warehouse release.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`
    },
    {
      id: "supply-install",
      label: "Supply & Install",
      accent: "#1C305C",
      description: "Full turnkey delivery covering supply, civil/OSP works, cabling, testing & commissioning.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
    },
    {
      id: "install-services",
      label: "Install/Services",
      accent: "#0F766E",
      description: "Specialized installation labor, fiber splicing, configuration, migration & managed SLA.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
    }
  ];

  const STATUS_COLUMNS = [
    {
      id: "Survey",
      label: "Survey",
      shortLabel: "Survey",
      accent: "#0284C7",
      softBg: "#E0F2FE",
      badgeClass: "st-Survey",
      description: "Site ocular inspection, route validation, RF survey & BOQ engineering.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
    },
    {
      id: "Project awarded",
      label: "Project awarded",
      shortLabel: "Awarded",
      accent: "#D97706",
      softBg: "#FEF3C7",
      badgeClass: "st-Awarded",
      description: "PO / NTP issued; materials procurement, permits & crew mobilization.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`
    },
    {
      id: "On-going project",
      label: "On-going project",
      shortLabel: "On-going",
      accent: "#2573BA",
      softBg: "#DBEAFE",
      badgeClass: "st-Ongoing",
      description: "Active supply dispatch, civil/OSP rollout, cabling & systems integration.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
    },
    {
      id: "Project completed",
      label: "Project completed",
      shortLabel: "Completed",
      accent: "#15803D",
      softBg: "#DCFCE7",
      badgeClass: "st-Completed",
      description: "100% delivered/installed, QA tested, UAT signed & formally turned over.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    },
    {
      id: "Hold",
      label: "Hold",
      shortLabel: "Hold",
      accent: "#DC2626",
      softBg: "#FEE2E2",
      badgeClass: "st-Hold",
      description: "Paused pending right-of-way permits, client site readiness, or variation order.",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`
    }
  ];

  /* 5 Clean Sample Projects (1 per status, covering all 4 Service Tracks) */
  const INITIAL_PROJECTS = [
    {
      id: "RGE-TRK-001",
      po: "PO-2026-1001",
      poDate: "2026-11-21",
      proposalNo: "PROP-2026-001",
      proposalDate: "2026-11-10",
      name: "Supply & installation of CCTV Cameras (24units)",
      client: "ABC Company",
      endUser: "Jaguar",
      column: "supply-install",
      status: "On-going project",
      executionStatus: "On-going",
      turnoverStatus: "Pending",
      priority: "High",
      location: "Makati",
      pm: "Engr. Clarissa Bautista",
      value: 100000,
      workingBudget: 68500,
      billed: 70000,
      progress: 70,
      mobilizationDate: "2026-11-22",
      implementationDate: "2026-11-24",
      dueDate: "2026-12-18",
      actualCompletionDate: "",
      notes: "Turnkey supply & installation of 24 IP CCTV cameras, NVR rack mounting, and Cat6 cabling in Makati.",
      tasks: [
        { text: "Site ocular & camera placement layout", done: true },
        { text: "50% Down Payment & hardware staging", done: true },
        { text: "Cabling, mounting & PB1 milestone", done: true },
        { text: "NVR commissioning & client UAT handover", done: false }
      ]
    },
    {
      id: "RGE-TRK-002",
      po: "PO-2026-4410",
      poDate: "2026-10-15",
      proposalNo: "PROP-2026-044",
      proposalDate: "2026-09-28",
      name: "QC District 4 144-Core ADSS Fiber Drums & Closures",
      client: "Quezon City Engineering Office",
      endUser: "QC IT Development Office",
      column: "supply-delivery",
      status: "Project awarded",
      executionStatus: "Pending Mobilization / TBA",
      turnoverStatus: "Pending",
      priority: "High",
      location: "Kamuning, Quezon City",
      pm: "Engr. Rafael Mendoza",
      value: 14800000,
      workingBudget: 10900000,
      billed: 7400000,
      progress: 30,
      mobilizationDate: "2026-12-01",
      implementationDate: "",
      dueDate: "2027-01-25",
      actualCompletionDate: "",
      notes: "28 reels of 144-core ADSS optical fiber and 96 dome splice closures for phased delivery to Quezon City.",
      tasks: [
        { text: "P.O & Notice to Proceed received", done: true },
        { text: "Factory OTDR reel test certificates", done: false },
        { text: "Scheduled flatbed delivery & signed DR", done: false }
      ]
    },
    {
      id: "RGE-TRK-003",
      po: "PO-2026-4302",
      poDate: "2026-07-01",
      proposalNo: "PROP-2026-030",
      proposalDate: "2026-06-12",
      name: "Cat6A Shielded Boxes, Patch Panels & OM4 Trunks",
      client: "MetroPrime Financial Holdings",
      endUser: "MetroPrime BGC Tower",
      column: "supply-only",
      status: "Project completed",
      executionStatus: "Completed",
      turnoverStatus: "COC Issued",
      priority: "Normal",
      location: "BGC, Taguig City",
      pm: "Engr. Paolo Villanueva",
      value: 6850000,
      workingBudget: 5120000,
      billed: 6850000,
      progress: 100,
      mobilizationDate: "2026-07-10",
      implementationDate: "2026-07-15",
      dueDate: "2026-11-05",
      actualCompletionDate: "2026-11-02",
      notes: "220 boxes UL-listed Cat6A LSZH cabling, 64 modular patch panels, and pre-terminated OM4 MPO cassettes.",
      tasks: [
        { text: "UL & RoHS compliance documents submitted", done: true },
        { text: "Warehouse QA count with client rep", done: true },
        { text: "Full release & final invoice settled", done: true }
      ]
    },
    {
      id: "RGE-TRK-004",
      po: "PO-2026-4542",
      poDate: "",
      proposalNo: "PROP-2026-054",
      proposalDate: "2026-11-05",
      name: "Clark Data Center Zero-Downtime Rack Migration",
      client: "Luzon Cloud Colocation Inc.",
      endUser: "Luzon Cloud Operations",
      column: "install-services",
      status: "Survey",
      executionStatus: "Pending Mobilization / TBA",
      turnoverStatus: "Pending",
      priority: "Normal",
      location: "Clark Global City, Pampanga",
      pm: "Engr. Jerome Castillo",
      value: 11600000,
      workingBudget: 8100000,
      billed: 0,
      progress: 15,
      mobilizationDate: "",
      implementationDate: "",
      dueDate: "2027-03-20",
      actualCompletionDate: "",
      notes: "Thermal audit, dual-feed PDU load survey, and weekend migration engineering plan for 60 live enterprise racks.",
      tasks: [
        { text: "Initial power & rack elevation audit", done: true },
        { text: "Patching matrix & rollback SOP review", done: false },
        { text: "Phased weekend rack cutover execution", done: false }
      ]
    },
    {
      id: "RGE-TRK-005",
      po: "PO-2026-4288",
      poDate: "2026-06-20",
      proposalNo: "PROP-2026-028",
      proposalDate: "2026-05-30",
      name: "Mindanao Agro-Hub Telecom Towers & Solar Shelters",
      client: "Mindanao Shared Tower Co.",
      endUser: "Regional Carrier Consortium",
      column: "supply-install",
      status: "Hold",
      executionStatus: "On Hold",
      turnoverStatus: "Pending",
      priority: "High",
      location: "Davao del Norte",
      pm: "Engr. Danilo Reyes",
      value: 31200000,
      workingBudget: 22400000,
      billed: 10920000,
      progress: 35,
      mobilizationDate: "2026-07-05",
      implementationDate: "2026-07-20",
      dueDate: "2027-04-20",
      actualCompletionDate: "",
      notes: "2 of 6 tower sites placed on hold awaiting barangay resolution & right-of-way access clearance.",
      tasks: [
        { text: "Tower steel fabrication & galvanizing done", done: true },
        { text: "Sites 1–4 civil foundation poured", done: true },
        { text: "Sites 5–6 LGU right-of-way resolution", done: false }
      ]
    }
  ];

  return { COLUMNS, STATUS_COLUMNS, INITIAL_PROJECTS };
})();
