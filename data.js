/* ==========================================================================
   RGE Project Tracker — Seed Dataset, 4 Service Columns & 5 Status Columns
   Service Columns (Tab 1):
     1. Supply & Delivery
     2. Supply only
     3. Supply & Install
     4. Install/Services
   Project Status Columns (Tab 2 & Tab 3 Analytics):
     1. Survey
     2. Project awarded
     3. On-going project
     4. Project completed
     5. Hold
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

  /* 20 Seeded Realistic RGE Projects spanning all 4 Service Columns & all 5 Status Columns */
  const INITIAL_PROJECTS = [
    /* ===================== SUPPLY & DELIVERY ===================== */
    {
      id: "RGE-TRK-001",
      po: "PO-2026-4410",
      name: "QC District 4 144-Core ADSS Fiber Drums & Closures",
      client: "Quezon City Engineering Office",
      column: "supply-delivery",
      status: "On-going project",
      priority: "High",
      location: "Kamuning & District 4, Quezon City",
      pm: "Engr. Rafael Mendoza",
      value: 14800000,
      billed: 11100000,
      progress: 80,
      dueDate: "2026-12-08",
      notes: "28 reels of 144-core ADSS optical fiber + 96 dome splice closures staged at QC warehouse; Batch 2 flatbed delivery scheduled.",
      tasks: [
        { text: "Factory OTDR reel test certificates verified", done: true },
        { text: "Batch 1 (16 reels) delivered & signed DR", done: true },
        { text: "Batch 2 staging & LGU site gate pass", done: true },
        { text: "Final delivery receipt & acceptance sign-off", done: false }
      ]
    },
    {
      id: "RGE-TRK-002",
      po: "PO-2026-4482",
      name: "Clark Substation Ruggedized Industrial Switches",
      client: "Clark Telecom Infrastructure Corp.",
      column: "supply-delivery",
      status: "On-going project",
      priority: "High",
      location: "Clark Freeport Zone, Pampanga",
      pm: "Engr. Jerome Castillo",
      value: 9450000,
      billed: 4725000,
      progress: 55,
      dueDate: "2026-12-22",
      notes: "48 DIN-rail Layer-3 industrial PoE++ switches with SFP+ 10G optical modules and redundant DC power supplies.",
      tasks: [
        { text: "PO confirmation & distributor allocation", done: true },
        { text: "Customs clearance & Kamuning staging QA", done: true },
        { text: "Direct logistics dispatch to Clark depot", done: false },
        { text: "Client inventory inspection & warranty issuance", done: false }
      ]
    },
    {
      id: "RGE-TRK-003",
      po: "PO-2026-4190",
      name: "Visayas Hospital Campus 4K IP CCTV & NVR Arrays",
      client: "Iloilo Provincial Health Network",
      column: "supply-delivery",
      status: "Project completed",
      priority: "Normal",
      location: "Iloilo City, Western Visayas",
      pm: "Engr. Miguel Dizon",
      value: 7600000,
      billed: 7600000,
      progress: 100,
      dueDate: "2026-10-30",
      notes: "180 vandal-resistant NDAA-compliant IP dome cameras, 6 enterprise 64-ch NVRs, and 480TB surveillance HDDs delivered.",
      tasks: [
        { text: "Serial number & MAC asset manifest", done: true },
        { text: "Sea/air freight crating & insured transit", done: true },
        { text: "Hospital warehouse receiving & QA count", done: true },
        { text: "Signed DR & billing invoice collected", done: true }
      ]
    },
    {
      id: "RGE-TRK-004",
      po: "PO-2026-4519",
      name: "CALABARZON HDPE Sub-Ducts & Precast Handholes",
      client: "SouthLuzon Carrier Exchange",
      column: "supply-delivery",
      status: "Project awarded",
      priority: "Normal",
      location: "Sta. Rosa & Biñan, Laguna",
      pm: "Engr. Danilo Reyes",
      value: 11200000,
      billed: 2240000,
      progress: 25,
      dueDate: "2027-01-25",
      notes: "18km 4-way orange HDPE telecom ducts with pre-lubed inner walls and 42 heavy-duty precast handhole frames.",
      tasks: [
        { text: "Downpayment & manufacturing slot booked", done: true },
        { text: "Plant tensile strength & crush QA test", done: false },
        { text: "Phased site drop-off along Laguna corridor", done: false }
      ]
    },
    {
      id: "RGE-TRK-018",
      po: "PO-2026-4375",
      name: "Subic Logistics Port Solar Smart Light Poles Supply",
      client: "Subic Bay Terminal Operations",
      column: "supply-delivery",
      status: "Hold",
      priority: "Normal",
      location: "Subic Bay Freeport, Zambales",
      pm: "Engr. Clarissa Bautista",
      value: 8300000,
      billed: 1660000,
      progress: 30,
      dueDate: "2027-03-10",
      notes: "Delivery temporarily on hold pending client port expansion berth clearance and customs yard space readiness.",
      tasks: [
        { text: "80 galvanized solar poles inspected", done: true },
        { text: "Port receiving gate schedule confirmation", done: false },
        { text: "Final flatbed convoy dispatch", done: false }
      ]
    },

    /* ===================== SUPPLY ONLY ===================== */
    {
      id: "RGE-TRK-005",
      po: "PO-2026-4455",
      name: "Enterprise NGFW & SD-WAN Appliances (56 Units)",
      client: "Dept. of Local Digital Services",
      column: "supply-only",
      status: "On-going project",
      priority: "High",
      location: "Quezon City Central Warehouse",
      pm: "Engr. Miguel Dizon",
      value: 26400000,
      billed: 13200000,
      progress: 60,
      dueDate: "2026-12-18",
      notes: "Supply-only hardware fulfillment with 3-year unified threat protection licenses and advanced RMA support.",
      tasks: [
        { text: "OEM licensing entitlement keys generated", done: true },
        { text: "Hardware batch 1 & 2 ready for client pick-up", done: true },
        { text: "Final license transfer certificate", done: false }
      ]
    },
    {
      id: "RGE-TRK-006",
      po: "PO-2026-4302",
      name: "Cat6A Shielded Boxes, Patch Panels & OM4 Trunks",
      client: "MetroPrime Financial Holdings",
      column: "supply-only",
      status: "Project completed",
      priority: "Normal",
      location: "BGC, Taguig City",
      pm: "Engr. Paolo Villanueva",
      value: 6850000,
      billed: 6850000,
      progress: 100,
      dueDate: "2026-11-05",
      notes: "220 boxes UL-listed Cat6A LSZH cabling, 64 angled modular patch panels, and pre-terminated OM4 MPO cassettes.",
      tasks: [
        { text: "UL & RoHS compliance docs submitted", done: true },
        { text: "Warehouse QA count with client rep", done: true },
        { text: "Full order released & SI closed", done: true }
      ]
    },
    {
      id: "RGE-TRK-007",
      po: "PO-2026-4530",
      name: "4K Surgical Video Encoders & Broadcast Switchers",
      client: "Cebu Health Sciences Institute",
      column: "supply-only",
      status: "Project awarded",
      priority: "Normal",
      location: "Cebu City (Client Pick-Up)",
      pm: "Engr. Andrea Soriano",
      value: 8900000,
      billed: 2670000,
      progress: 30,
      dueDate: "2027-01-30",
      notes: "Direct AV equipment procurement for medical simulation theater; manufacturer lead time 4 weeks.",
      tasks: [
        { text: "BOM specs signed off by AV consultant", done: true },
        { text: "OEM factory order confirmed", done: false },
        { text: "Warranty registration & warehouse handover", done: false }
      ]
    },
    {
      id: "RGE-TRK-008",
      po: "PO-2026-4568",
      name: "100G QSFP28 Optical Transceivers & ODF Racks",
      client: "Pacific Link Telecom Corp.",
      column: "supply-only",
      status: "Survey",
      priority: "Low",
      location: "Makati CBD",
      pm: "Engr. Jerome Castillo",
      value: 5200000,
      billed: 0,
      progress: 15,
      dueDate: "2027-02-15",
      notes: "Compatibility verification for dual-vendor core routers prior to final PO release for 140 optical modules.",
      tasks: [
        { text: "Router wavelength & DOM compatibility check", done: true },
        { text: "Final BOM quotation approval", done: false },
        { text: "Order fulfillment & release", done: false }
      ]
    },

    /* ===================== SUPPLY & INSTALL ===================== */
    {
      id: "RGE-TRK-009",
      po: "PO-2026-4012",
      name: "Commonwealth Ave. Smart Traffic & AI CCTV Grid",
      client: "Quezon City DPOS",
      column: "supply-install",
      status: "On-going project",
      priority: "High",
      location: "Commonwealth Ave., Quezon City",
      pm: "Engr. Clarissa Bautista",
      value: 54200000,
      billed: 41800000,
      progress: 78,
      dueDate: "2026-12-28",
      notes: "Full turnkey supply & installation of 180 ANPR smart poles, fiber ring splicing, and QC Command Center video integration.",
      tasks: [
        { text: "Site survey & pole foundation civil works", done: true },
        { text: "180 smart poles & cameras mounted", done: true },
        { text: "Backbone optical splicing & OTDR pass", done: true },
        { text: "Command center VMS calibration & UAT", done: false }
      ]
    },
    {
      id: "RGE-TRK-010",
      po: "PO-2026-4118",
      name: "BGC Corporate Tower Core Switching & Wi-Fi 6E",
      client: "Ayala Triangle Enterprise Group",
      column: "supply-install",
      status: "On-going project",
      priority: "High",
      location: "Makati & BGC, Metro Manila",
      pm: "Engr. Jerome Castillo",
      value: 41500000,
      billed: 36500000,
      progress: 90,
      dueDate: "2026-12-12",
      notes: "Turnkey 100GbE spine-leaf core network and 420 Wi-Fi 6E APs across 3 towers; final RF heatmap validation ongoing.",
      tasks: [
        { text: "Hardware staging & pre-configuration", done: true },
        { text: "Core switch cutover & zero-downtime failover", done: true },
        { text: "420 AP ceiling mount & structured drops", done: true },
        { text: "Final Ekahau RF survey & client sign-off", done: false }
      ]
    },
    {
      id: "RGE-TRK-011",
      po: "PO-2026-3890",
      name: "NCR Emergency Ops Center 14m Fine-Pitch LED Wall",
      client: "Metro Manila DRRMO",
      column: "supply-install",
      status: "Project completed",
      priority: "High",
      location: "Quezon City",
      pm: "Engr. Andrea Soriano",
      value: 29400000,
      billed: 29400000,
      progress: 100,
      dueDate: "2026-09-30",
      notes: "1.2mm fine-pitch LED command display, redundant AV-over-IP matrix, acoustic ceiling array, and operator consoles.",
      tasks: [
        { text: "Structural wall truss & power feed prep", done: true },
        { text: "LED cabinet assembly & color calibration", done: true },
        { text: "Operator training & as-built handover", done: true }
      ]
    },
    {
      id: "RGE-TRK-012",
      po: "PO-2026-4501",
      name: "Davao Unified Traffic Command Phase 2 Rollout",
      client: "Davao City Transport Office",
      column: "supply-install",
      status: "Project awarded",
      priority: "High",
      location: "Davao City, Mindanao",
      pm: "Engr. Clarissa Bautista",
      value: 48600000,
      billed: 12150000,
      progress: 22,
      dueDate: "2027-06-15",
      notes: "Turnkey variable message gantries, radar intersection detectors, and fiber backhaul links.",
      tasks: [
        { text: "NTP issued & joint DPWH/LGU staking", done: true },
        { text: "Gantry steel fabrication & hardware order", done: false },
        { text: "Field trenching, erection & commissioning", done: false }
      ]
    },
    {
      id: "RGE-TRK-013",
      po: "PO-2026-4575",
      name: "Batangas Coastal Substation Fiber & HDD Crossing",
      client: "Luzon Grid & Energy Partners",
      column: "supply-install",
      status: "Survey",
      priority: "Normal",
      location: "Batangas City, CALABARZON",
      pm: "Engr. Danilo Reyes",
      value: 36800000,
      billed: 1840000,
      progress: 12,
      dueDate: "2027-07-30",
      notes: "Ocular site survey and soil boring evaluation for directional highway boring and armored fiber deployment.",
      tasks: [
        { text: "Initial GIS route walkout completed", done: true },
        { text: "Soil resistivity & DPWH ROW permit pack", done: false },
        { text: "Final BOQ & construction mobilization", done: false }
      ]
    },
    {
      id: "RGE-TRK-019",
      po: "PO-2026-4288",
      name: "Mindanao Agro-Hub Telecom Towers & Solar Shelters",
      client: "Mindanao Shared Tower Co.",
      column: "supply-install",
      status: "Hold",
      priority: "High",
      location: "Tagum & Davao del Norte",
      pm: "Engr. Danilo Reyes",
      value: 31200000,
      billed: 10920000,
      progress: 35,
      dueDate: "2027-04-20",
      notes: "2 of 6 tower sites placed on hold awaiting barangay resolution & right-of-way clearance for access road.",
      tasks: [
        { text: "Tower steel fabrication & galvanizing done", done: true },
        { text: "Sites 1–4 civil foundation poured", done: true },
        { text: "Sites 5–6 LGU ROW resolution", done: false }
      ]
    },

    /* ===================== INSTALL/SERVICES ===================== */
    {
      id: "RGE-TRK-014",
      po: "PO-2026-4220",
      name: "Ortigas BPO Tower 18-Floor Cat6A Cabling Labor",
      client: "GlobalDesk BPO Solutions",
      column: "install-services",
      status: "On-going project",
      priority: "High",
      location: "Ortigas Center, Pasig City",
      pm: "Engr. Paolo Villanueva",
      value: 14500000,
      billed: 10875000,
      progress: 76,
      dueDate: "2026-12-19",
      notes: "Installation, termination, rack dressing, and Fluke DSX-8000 certification for 3,200 client-supplied workstation nodes.",
      tasks: [
        { text: "Floors 1–12 rough-in & cable pulling done", done: true },
        { text: "MDF/IDF patch panel termination & labeling", done: true },
        { text: "Floors 13–18 Fluke certification reports", done: false }
      ]
    },
    {
      id: "RGE-TRK-015",
      po: "PO-2026-3950",
      name: "Multi-Hospital 24/7 Managed NOC & Helpdesk SLA",
      client: "St. Gabriel Healthcare System",
      column: "install-services",
      status: "On-going project",
      priority: "Normal",
      location: "Quezon City & Metro Manila (5 Sites)",
      pm: "Engr. Katrina Lim",
      value: 19200000,
      billed: 16320000,
      progress: 85,
      dueDate: "2027-01-31",
      notes: "Active 99.95% uptime NOC monitoring, monthly firewall patching, and 2-hour on-site L2 dispatch SLA.",
      tasks: [
        { text: "Q1–Q3 preventive maintenance audits signed", done: true },
        { text: "Redundant failover drill passed (99.96%)", done: true },
        { text: "Q4 executive SLA review & renewal prep", done: false }
      ]
    },
    {
      id: "RGE-TRK-016",
      po: "PO-2026-4104",
      name: "North Luzon Aerial Fiber Splicing & Pole Rehab",
      client: "Converged Luzon Broadband Corp.",
      column: "install-services",
      status: "Project completed",
      priority: "High",
      location: "Pampanga to Tarlac Corridor",
      pm: "Engr. Danilo Reyes",
      value: 22800000,
      billed: 22800000,
      progress: 100,
      dueDate: "2026-11-12",
      notes: "Installation-only services for 410 galvanized poles, 85km ADSS stringing, and 1,152-core fusion splicing.",
      tasks: [
        { text: "Pole tensioning & storm-guy installation", done: true },
        { text: "Bi-directional OTDR traces <0.22 dB/km", done: true },
        { text: "Final COC signed by carrier engineering", done: true }
      ]
    },
    {
      id: "RGE-TRK-017",
      po: "PO-2026-4542",
      name: "Clark Data Center Zero-Downtime Rack Migration",
      client: "Luzon Cloud Colocation Inc.",
      column: "install-services",
      status: "Survey",
      priority: "Normal",
      location: "Clark Global City, Pampanga",
      pm: "Engr. Paolo Villanueva",
      value: 11600000,
      billed: 1160000,
      progress: 15,
      dueDate: "2027-03-20",
      notes: "Thermal audit, dual-feed PDU load survey, and weekend migration engineering plan for 60 live enterprise racks.",
      tasks: [
        { text: "Initial power & rack elevation audit", done: true },
        { text: "Patching matrix & rollback SOP review", done: false },
        { text: "Phased weekend rack cutover execution", done: false }
      ]
    },
    {
      id: "RGE-TRK-020",
      po: "PO-2026-4405",
      name: "Cebu Commercial Complex Access Control Retrofit",
      client: "Cebu Harbour Estates",
      column: "install-services",
      status: "Hold",
      priority: "Low",
      location: "Mandaue City, Cebu",
      pm: "Engr. Katrina Lim",
      value: 6400000,
      billed: 1920000,
      progress: 30,
      dueDate: "2027-04-05",
      notes: "Installation crew paused pending building architect's revised lobby turnstile floor slab cut-out.",
      tasks: [
        { text: "Controller conduit rough-in finished", done: true },
        { text: "Lobby architectural floor slab approval", done: false },
        { text: "Turnstile commissioning & RFID enrollment", done: false }
      ]
    }
  ];

  return { COLUMNS, STATUS_COLUMNS, INITIAL_PROJECTS };
})();
