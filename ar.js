/* ==========================================================================
   RGE Project Tracker — Account Receivable (AR) Module
   Implements exact RGE AR Ledger schema:
     - Project Info: Project Title, Client, End User, Project Site, P.O#, P.O Amount, P.O Date
     - Down Payment: DP Amount, % of DP (auto), DP Date, SI#, SI Date
     - Progress Billing 1..10 (PB1–PB10): Amount, % of P.O (auto), Date, SI#, SI Date
     - Final Payment: Amount, % of Final (auto), Date, SI#, SI Date
     - Summary: Total Payment Received (auto), 2307 w/holding tax (manual),
       Total % Paid (auto), Payment Remarks (auto: For Billing / Good as Fully Paid / Fully Paid),
       Account Receivable (auto), Terms, TPC Cost (manual)
   ========================================================================== */

window.RGE_AR_MODULE = (() => {
  const AR_STORAGE_KEY = "rge_project_tracker_ar_prod_v3";
  const PROJECTS_STORAGE_KEY = "rge_project_tracker_prod_v3";
  const PB_COUNT = 10;

  // Purge legacy demo storage keys once on migration
  try {
    localStorage.removeItem("rge_project_tracker_ar_prod_v2");
  } catch (_) {}

  /* Live reader for all stored projects (previous + newly added via + New Project) */
  function getStoredProjectsCatalog() {
    let storedProjects = [];
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) storedProjects = parsed;
      } else if (window.RGE_TRACKER_DATA?.INITIAL_PROJECTS) {
        storedProjects = window.RGE_TRACKER_DATA.INITIAL_PROJECTS;
      }
    } catch (_) {}

    const seen = new Set();
    const catalog = [];

    const hasExistingAR = (title, po) => {
      const tLow = (title || "").trim().toLowerCase();
      const pLow = (po || "").trim().toLowerCase();
      return arState.records.some(
        (r) =>
          (pLow && (r.poNo || "").trim().toLowerCase() === pLow) ||
          (tLow && (r.projectTitle || "").trim().toLowerCase() === tLow)
      );
    };

    // 1. Live projects from main tracker storage (newest added appear first!)
    storedProjects.forEach((p) => {
      const title = (p.name || "").trim();
      if (!title) return;
      const key = `${title.toLowerCase()}|${(p.po || "").trim().toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      catalog.push({
        source: "project",
        projectId: p.id || "",
        projectTitle: title,
        client: p.client || "",
        endUser: p.endUser || "",
        projectSite: p.location || "",
        poNo: p.po || "",
        poAmount: Number(p.value) || 0,
        poDate: p.poDate || "",
        tpcCost: Number(p.workingBudget) || 0,
        hasAR: hasExistingAR(title, p.po)
      });
    });

    // 2. Also include any previous AR-only projects not already in the main tracker
    arState.records.forEach((r) => {
      const title = (r.projectTitle || "").trim();
      if (!title) return;
      const key = `${title.toLowerCase()}|${(r.poNo || "").trim().toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      catalog.push({
        source: "ar",
        projectId: r.id || "",
        projectTitle: title,
        client: r.client || "",
        endUser: r.endUser || "",
        projectSite: r.projectSite || "",
        poNo: r.poNo || "",
        poAmount: Number(r.poAmount) || 0,
        poDate: r.poDate || "",
        tpcCost: Number(r.tpcCost) || 0,
        hasAR: true
      });
    });

    return catalog;
  }

  function makeEmptyPBs(prefill = {}) {
    const pbs = [];
    for (let i = 1; i <= PB_COUNT; i++) {
      const src = prefill[i] || {};
      pbs.push({
        num: i,
        amount: Number(src.amount) || 0,
        date: src.date || "",
        siNo: src.siNo || "",
        siDate: src.siDate || ""
      });
    }
    return pbs;
  }

  /* 9 Sample AR Records aligned 1-to-1 with the 9 Core RGE Projects */
  const INITIAL_AR_RECORDS = [
    {
      id: "AR-2026-001",
      projectTitle: "Fiber Infrastructure",
      client: "MetroLuzon Broadband Corp.",
      endUser: "QC Central Distribution Node",
      projectSite: "Kamuning Road to EDSA, Quezon City",
      poNo: "PO-2026-2001",
      poAmount: 4850000,
      poDate: "2026-09-12",
      dpAmount: 1940000,
      dpDate: "2026-09-16",
      dpSiNo: "SI-2026-1001",
      dpSiDate: "2026-09-15",
      pbs: makeEmptyPBs({
        1: { amount: 1212500, date: "2026-10-28", siNo: "SI-2026-1042", siDate: "2026-10-25" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 48500,
      terms: "40% DP, 50% Progress Billing, 10% Completion",
      tpcCost: 3420000
    },
    {
      id: "AR-2026-002",
      projectTitle: "Structured Cabling",
      client: "Ayala Enterprise Holdings Inc.",
      endUser: "Makati Corporate HQ (Floors 14–16)",
      projectSite: "Ayala Avenue, Makati CBD",
      poNo: "PO-2026-2002",
      poAmount: 1650000,
      poDate: "2026-10-02",
      dpAmount: 825000,
      dpDate: "2026-10-06",
      dpSiNo: "SI-2026-1015",
      dpSiDate: "2026-10-05",
      pbs: makeEmptyPBs({
        1: { amount: 412500, date: "2026-11-10", siNo: "SI-2026-1068", siDate: "2026-11-08" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 16500,
      terms: "50% DP, 40% Progress Billing, 10% Completion",
      tpcCost: 1180000
    },
    {
      id: "AR-2026-003",
      projectTitle: "Network Solutions",
      client: "BGC Financial Towers Corp.",
      endUser: "One High Street Corporate Hub",
      projectSite: "Bonifacio Global City, Taguig",
      poNo: "PO-2026-2003",
      poAmount: 2400000,
      poDate: "2026-11-03",
      dpAmount: 1200000,
      dpDate: "2026-11-09",
      dpSiNo: "SI-2026-1074",
      dpSiDate: "2026-11-07",
      pbs: makeEmptyPBs(),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 12000,
      terms: "50% DP, 50% Upon Full Hardware Delivery",
      tpcCost: 1750000
    },
    {
      id: "AR-2026-004",
      projectTitle: "Network Security",
      client: "Pacific Trust Savings Bank",
      endUser: "Ortigas Main Banking Center",
      projectSite: "Ortigas Center, Pasig City",
      poNo: "PO-2026-2004",
      poAmount: 1950000,
      poDate: "2026-07-15",
      dpAmount: 975000,
      dpDate: "2026-07-20",
      dpSiNo: "SI-2026-0912",
      dpSiDate: "2026-07-18",
      pbs: makeEmptyPBs(),
      finalAmount: 955500,
      finalDate: "2026-10-14",
      finalSiNo: "SI-2026-1028",
      finalSiDate: "2026-10-12",
      ewt2307: 19500,
      terms: "50% DP, 50% Upon License Activation & Delivery",
      tpcCost: 1420000
    },
    {
      id: "AR-2026-005",
      projectTitle: "Civil & Telecom Works",
      client: "NorthGrid Telco Ventures",
      endUser: "Commonwealth Backbone Ductway",
      projectSite: "Commonwealth Avenue, Quezon City",
      poNo: "PO-2026-2005",
      poAmount: 6200000,
      poDate: "2026-08-20",
      dpAmount: 1860000,
      dpDate: "2026-08-26",
      dpSiNo: "SI-2026-0960",
      dpSiDate: "2026-08-24",
      pbs: makeEmptyPBs({
        1: { amount: 620000, date: "2026-10-05", siNo: "SI-2026-1019", siDate: "2026-10-03" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 49600,
      terms: "30% DP, 60% Progress Billing, 10% Retention",
      tpcCost: 4480000
    },
    {
      id: "AR-2026-006",
      projectTitle: "Audio Visual (AV) Systems",
      client: "SouthPoint Commercial Group",
      endUser: "Alabang Executive Boardroom & Auditorium",
      projectSite: "Filinvest City, Alabang, Muntinlupa",
      poNo: "PO-2026-2006",
      poAmount: 1280000,
      poDate: "2026-11-08",
      dpAmount: 640000,
      dpDate: "2026-11-14",
      dpSiNo: "SI-2026-1081",
      dpSiDate: "2026-11-12",
      pbs: makeEmptyPBs(),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 12800,
      terms: "50% DP, 40% Delivery & Installation, 10% Sign-off",
      tpcCost: 910000
    },
    {
      id: "AR-2026-007",
      projectTitle: "Data Center & Server Rooms",
      client: "Laguna Precision Manufacturing Inc.",
      endUser: "Technopark Tier-2 Server Room",
      projectSite: "Laguna Technopark, Santa Rosa, Laguna",
      poNo: "PO-2026-2007",
      poAmount: 8500000,
      poDate: "2026-11-18",
      dpAmount: 0,
      dpDate: "",
      dpSiNo: "",
      dpSiDate: "",
      pbs: makeEmptyPBs(),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 0,
      terms: "40% DP, 50% Progress Billing, 10% Commissioning",
      tpcCost: 6150000
    },
    {
      id: "AR-2026-008",
      projectTitle: "CCTV & Access Control",
      client: "Visayas Logistics & Cold Storage Corp.",
      endUser: "Cebu IT Park Operations & Warehouse",
      projectSite: "Cebu IT Park, Cebu City",
      poNo: "PO-2026-2008",
      poAmount: 980000,
      poDate: "2026-08-04",
      dpAmount: 490000,
      dpDate: "2026-08-08",
      dpSiNo: "SI-2026-0944",
      dpSiDate: "2026-08-07",
      pbs: makeEmptyPBs({
        1: { amount: 294000, date: "2026-09-20", siNo: "SI-2026-0998", siDate: "2026-09-18" }
      }),
      finalAmount: 186200,
      finalDate: "2026-10-29",
      finalSiNo: "SI-2026-1055",
      finalSiDate: "2026-10-27",
      ewt2307: 9800,
      terms: "50% DP, 30% Rough-in & Mounting, 20% COC",
      tpcCost: 685000
    },
    {
      id: "AR-2026-009",
      projectTitle: "Managed IT & Maintenance",
      client: "Clark AeroHub Business Park",
      endUser: "Clark Freeport Zone Shared Campus",
      projectSite: "Clark Freeport Zone, Pampanga",
      poNo: "PO-2026-2009",
      poAmount: 720000,
      poDate: "2026-06-01",
      dpAmount: 180000,
      dpDate: "2026-06-10",
      dpSiNo: "SI-2026-0840",
      dpSiDate: "2026-06-08",
      pbs: makeEmptyPBs({
        1: { amount: 180000, date: "2026-08-12", siNo: "SI-2026-0952", siDate: "2026-08-10" },
        2: { amount: 180000, date: "2026-10-12", siNo: "SI-2026-1031", siDate: "2026-10-10" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 10800,
      terms: "Quarterly SLA Billing (4 Equal Installments)",
      tpcCost: 485000
    }
  ];

  /* ========================================================================
     AUTO-CALCULATION ENGINE (Matches User's Exact Spreadsheet Formulas)
     ======================================================================== */
  function computeMetrics(rec) {
    const po = Number(rec.poAmount) || 0;
    const dp = Number(rec.dpAmount) || 0;
    const pbTotal = (rec.pbs || []).reduce((sum, pb) => sum + (Number(pb.amount) || 0), 0);
    const fin = Number(rec.finalAmount) || 0;
    const ewt = Number(rec.ewt2307) || 0;

    // Total Payment Received = DP + sum(PB1..PB10) + Final Payment
    const totalReceived = dp + pbTotal + fin;
    const totalSettled = totalReceived + ewt;

    const dpPct = po > 0 ? (dp / po) * 100 : 0;
    const finalPct = po > 0 ? (fin / po) * 100 : 0;
    const totalPctPaid = po > 0 ? (totalSettled / po) * 100 : 0;
    const arBalance = Math.max(0, po - totalSettled);

    // Auto-calculated Payment Remarks: Fully Paid / Good as Fully Paid / For Billing
    let remarks = "For Billing";
    let remarksClass = "ar-rem-billing";
    if (po > 0 && (arBalance <= 0.5 || totalPctPaid >= 99.99)) {
      remarks = "Fully Paid";
      remarksClass = "ar-rem-paid";
    } else if (po > 0 && totalPctPaid >= 97.5) {
      remarks = "Good as Fully Paid";
      remarksClass = "ar-rem-good";
    }

    const tpc = Number(rec.tpcCost) || 0;
    const grossMargin = po - tpc;
    const marginPct = po > 0 ? (grossMargin / po) * 100 : 0;

    return {
      po,
      dp,
      dpPct,
      pbTotal,
      fin,
      finalPct,
      ewt,
      totalReceived,
      totalSettled,
      totalPctPaid,
      arBalance,
      remarks,
      remarksClass,
      tpc,
      grossMargin,
      marginPct
    };
  }

  /* ========================================================================
     STATE & PERSISTENCE
     ======================================================================== */
  const arState = {
    records: loadAR(),
    search: "",
    remarksFilter: "all",   // 'all' | 'For Billing' | 'Good as Fully Paid' | 'Fully Paid'
    pbViewMode: "active",   // 'active' (PB1–PB3) | 'all' (PB1–PB10)
    editingId: null,
    activePbTab: 1
  };

  function loadAR() {
    try {
      const saved = localStorage.getItem(AR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((r) => ({
            ...r,
            pbs: Array.isArray(r.pbs) && r.pbs.length === PB_COUNT ? r.pbs : makeEmptyPBs()
          }));
        }
      }
    } catch (_) {}
    return structuredClone(INITIAL_AR_RECORDS);
  }

  function saveAR() {
    try {
      localStorage.setItem(AR_STORAGE_KEY, JSON.stringify(arState.records));
    } catch (_) {}
    if (window.RGE_CLOUD_SYNC) window.RGE_CLOUD_SYNC.scheduleAutoBackup();
  }

  function fmtMoney(val, compact = false) {
    const n = Number(val) || 0;
    if (compact) {
      if (n >= 1e9) return `₱ ${(n / 1e9).toFixed(2)}B`;
      if (n >= 1e6) return `₱ ${(n / 1e6).toFixed(2)}M`;
      if (n >= 1e3) return `₱ ${(n / 1e3).toFixed(1)}K`;
    }
    return `₱ ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtPct(val) {
    return `${(Number(val) || 0).toFixed(1)}%`;
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(msg) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
      t.style.transition = "opacity 0.22s ease, transform 0.22s ease";
      setTimeout(() => t.remove(), 240);
    }, 3000);
  }

  /* ========================================================================
     DOM REFERENCES & RENDERING
     ======================================================================== */
  let dom = {};

  function cacheDOM() {
    dom = {
      kpiPo: document.getElementById("ar-kpi-po"),
      kpiReceived: document.getElementById("ar-kpi-received"),
      kpiReceivedPct: document.getElementById("ar-kpi-received-pct"),
      kpiBalance: document.getElementById("ar-kpi-balance"),
      kpiBalanceSub: document.getElementById("ar-kpi-balance-sub"),
      kpiEwtTpc: document.getElementById("ar-kpi-ewt-tpc"),
      kpiTpcSub: document.getElementById("ar-kpi-tpc-sub"),
      searchInput: document.getElementById("ar-search-input"),
      remarksPills: document.getElementById("ar-remarks-pills"),
      btnPbActive: document.getElementById("ar-btn-pb-active"),
      btnPbAll: document.getElementById("ar-btn-pb-all"),
      btnExportCsv: document.getElementById("ar-btn-export-csv"),
      btnAddRecord: document.getElementById("ar-btn-add"),
      tableEl: document.getElementById("ar-ledger-table"),
      mobileCards: document.getElementById("ar-mobile-cards"),
      emptyState: document.getElementById("ar-empty-state"),
      tabBadge: document.getElementById("tab-badge-ar"),
      // Editor Drawer
      drawerBackdrop: document.getElementById("ar-drawer-backdrop"),
      drawer: document.getElementById("ar-drawer"),
      drawerTitle: document.getElementById("ar-drawer-title"),
      drawerCode: document.getElementById("ar-drawer-code"),
      drawerBody: document.getElementById("ar-drawer-body"),
      btnCloseDrawer: document.getElementById("ar-btn-close-drawer"),
      btnPrintDrawer: document.getElementById("ar-btn-print-drawer"),
      btnSaveDrawer: document.getElementById("ar-btn-save-drawer"),
      btnDeleteDrawer: document.getElementById("ar-btn-delete-drawer"),
      // View Statement Modal
      viewBackdrop: document.getElementById("ar-view-modal-backdrop"),
      viewCode: document.getElementById("ar-view-modal-code"),
      viewTitle: document.getElementById("ar-view-modal-title"),
      viewBody: document.getElementById("ar-view-modal-body"),
      btnCloseView: document.getElementById("ar-view-btn-close"),
      btnEditFromView: document.getElementById("ar-view-btn-edit"),
      btnPrintFromView: document.getElementById("ar-view-btn-print")
    };
  }

  function getFilteredAR() {
    const q = arState.search.trim().toLowerCase();
    return arState.records.filter((r) => {
      const m = computeMetrics(r);
      if (arState.remarksFilter !== "all" && m.remarks !== arState.remarksFilter) return false;
      if (q) {
        const pbSi = (r.pbs || []).map((pb) => pb.siNo).join(" ");
        const hay = `${r.id} ${r.projectTitle} ${r.client} ${r.endUser} ${r.projectSite} ${r.poNo} ${r.dpSiNo} ${r.finalSiNo} ${pbSi} ${r.terms} ${m.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderAR() {
    if (!dom.tableEl) return;
    const list = getFilteredAR();
    const visiblePBCount = arState.pbViewMode === "all" ? 10 : 3;

    if (dom.tabBadge) dom.tabBadge.textContent = `${arState.records.length} AR`;

    // 1. AR Summary KPIs
    let sumPo = 0, sumRec = 0, sumBal = 0, sumEwt = 0, sumTpc = 0;
    let countPaid = 0, countGood = 0, countBilling = 0;
    list.forEach((r) => {
      const m = computeMetrics(r);
      sumPo += m.po;
      sumRec += m.totalReceived;
      sumBal += m.arBalance;
      sumEwt += m.ewt;
      sumTpc += m.tpc;
      if (m.remarks === "Fully Paid") countPaid++;
      else if (m.remarks === "Good as Fully Paid") countGood++;
      else countBilling++;
    });

    const overallPct = sumPo > 0 ? ((sumRec + sumEwt) / sumPo) * 100 : 0;
    dom.kpiPo.textContent = fmtMoney(sumPo, true);
    dom.kpiReceived.textContent = fmtMoney(sumRec, true);
    dom.kpiReceivedPct.textContent = `${overallPct.toFixed(1)}% collected incl. 2307`;
    dom.kpiBalance.textContent = fmtMoney(sumBal, true);
    dom.kpiBalanceSub.textContent = `${countBilling} For Billing • ${countGood} Good as Paid • ${countPaid} Paid`;
    dom.kpiEwtTpc.textContent = fmtMoney(sumEwt, true);
    dom.kpiTpcSub.textContent = `TPC Cost: ${fmtMoney(sumTpc, true)}`;

    if (list.length === 0) {
      dom.tableEl.innerHTML = "";
      dom.mobileCards.innerHTML = "";
      dom.emptyState.hidden = false;
      return;
    }
    dom.emptyState.hidden = true;

    // 2. Color-Coded Ledger Spreadsheet Table (Exact Section Colors from User's Sheet!)
    let pbHeadersTop = "";
    let pbHeadersSub = "";
    for (let i = 1; i <= visiblePBCount; i++) {
      pbHeadersTop += `<th colspan="5" class="ar-grp-pb">Progress Billing ${i} (PB${i})</th>`;
      pbHeadersSub += `
        <th class="ar-sub-pb text-right">PB${i} Amt</th>
        <th class="ar-sub-pb text-right">% of Purchase Order</th>
        <th class="ar-sub-pb">PB${i} Date</th>
        <th class="ar-sub-pb">Sales Invoice #</th>
        <th class="ar-sub-pb">Sales Invoice Date</th>`;
    }

    const theadHTML = `
      <thead>
        <tr class="ar-group-row">
          <th colspan="7" class="ar-grp-navy">Project &amp; Purchase Order Details</th>
          <th colspan="5" class="ar-grp-dp">Down Payment</th>
          ${pbHeadersTop}
          <th colspan="5" class="ar-grp-final">Final Payment</th>
          <th colspan="7" class="ar-grp-summary">Receivables, 2307 Tax &amp; Cost Summary</th>
          <th class="ar-grp-actions ar-sticky-right">Record</th>
        </tr>
        <tr class="ar-col-row">
          <th class="ar-sub-navy ar-sticky-1">Project Title</th>
          <th class="ar-sub-navy ar-sticky-2">Client</th>
          <th class="ar-sub-navy">End User</th>
          <th class="ar-sub-navy">Project Site</th>
          <th class="ar-sub-navy">Purchase Order No.</th>
          <th class="ar-sub-navy text-right">Purchase Order Amount</th>
          <th class="ar-sub-navy">Purchase Order Date</th>

          <th class="ar-sub-dp text-right">Down Payment</th>
          <th class="ar-sub-dp text-right">% of DP</th>
          <th class="ar-sub-dp">DP Date</th>
          <th class="ar-sub-dp">Sales Invoice #</th>
          <th class="ar-sub-dp">Sales Invoice Date</th>

          ${pbHeadersSub}

          <th class="ar-sub-final text-right">Final Payment</th>
          <th class="ar-sub-final text-right">% of Final</th>
          <th class="ar-sub-final">Date</th>
          <th class="ar-sub-final">Sales Invoice #</th>
          <th class="ar-sub-final">Sales Invoice Date</th>

          <th class="ar-sub-cyan text-right">Total Payment Received</th>
          <th class="ar-sub-rose text-right">2307 w/holding tax</th>
          <th class="ar-sub-white text-right">Total % Paid</th>
          <th class="ar-sub-cyan">Payment Remarks</th>
          <th class="ar-sub-cyan text-right">Account Receivable</th>
          <th class="ar-sub-white">Terms</th>
          <th class="ar-sub-white text-right">TPC Cost</th>
          <th class="ar-sub-actions ar-sticky-right">View / Print</th>
        </tr>
      </thead>`;

    const tbodyHTML = list
      .map((r) => {
        const m = computeMetrics(r);
        let pbCells = "";
        for (let i = 0; i < visiblePBCount; i++) {
          const pb = r.pbs[i];
          const pct = m.po > 0 ? (pb.amount / m.po) * 100 : 0;
          pbCells += `
            <td class="text-right mono">${pb.amount ? fmtMoney(pb.amount) : "—"}</td>
            <td class="text-right mono muted">${pb.amount ? fmtPct(pct) : "—"}</td>
            <td class="mono nowrap">${esc(pb.date || "—")}</td>
            <td class="mono nowrap">${esc(pb.siNo || "—")}</td>
            <td class="mono nowrap">${esc(pb.siDate || "—")}</td>`;
        }

        return `
          <tr data-ar-open="${esc(r.id)}" tabindex="0">
            <td class="ar-sticky-1 ar-title-cell">
              <strong>${esc(r.projectTitle)}</strong>
              <span class="ar-edit-hint">Edit PB1–PB10 &rarr;</span>
            </td>
            <td class="ar-sticky-2"><strong>${esc(r.client)}</strong></td>
            <td>${esc(r.endUser || "—")}</td>
            <td class="nowrap">${esc(r.projectSite || "—")}</td>
            <td class="mono nowrap">${esc(r.poNo || "—")}</td>
            <td class="text-right mono strong-navy">${fmtMoney(m.po)}</td>
            <td class="mono nowrap">${esc(r.poDate || "—")}</td>

            <td class="text-right mono">${m.dp ? fmtMoney(m.dp) : "—"}</td>
            <td class="text-right mono muted">${m.dp ? fmtPct(m.dpPct) : "—"}</td>
            <td class="mono nowrap">${esc(r.dpDate || "—")}</td>
            <td class="mono nowrap">${esc(r.dpSiNo || "—")}</td>
            <td class="mono nowrap">${esc(r.dpSiDate || "—")}</td>

            ${pbCells}

            <td class="text-right mono">${m.fin ? fmtMoney(m.fin) : "—"}</td>
            <td class="text-right mono muted">${m.fin ? fmtPct(m.finalPct) : "—"}</td>
            <td class="mono nowrap">${esc(r.finalDate || "—")}</td>
            <td class="mono nowrap">${esc(r.finalSiNo || "—")}</td>
            <td class="mono nowrap">${esc(r.finalSiDate || "—")}</td>

            <td class="text-right mono strong-navy">${fmtMoney(m.totalReceived)}</td>
            <td class="text-right mono text-rose">${m.ewt ? fmtMoney(m.ewt) : "₱ 0.00"}</td>
            <td class="text-right mono strong-pct">${fmtPct(m.totalPctPaid)}</td>
            <td><span class="ar-rem-pill ${m.remarksClass}">${esc(m.remarks)}</span></td>
            <td class="text-right mono strong-ar">${fmtMoney(m.arBalance)}</td>
            <td class="ar-terms-cell">${esc(r.terms || "—")}</td>
            <td class="text-right mono">${m.tpc ? fmtMoney(m.tpc) : "—"}</td>
            <td class="ar-sticky-right ar-actions-cell">
              <div class="ar-row-actions">
                <button type="button" class="ar-row-btn ar-btn-view" data-ar-view="${esc(r.id)}" title="View full AR statement">View</button>
                <button type="button" class="ar-row-btn ar-btn-print" data-ar-print="${esc(r.id)}" title="Print AR statement">Print</button>
              </div>
            </td>
          </tr>`;
      })
      .join("");

    dom.tableEl.innerHTML = `${theadHTML}<tbody>${tbodyHTML}</tbody>`;

    // 3. Mobile-Friendly AR Cards (Clean stacked view on phones < 768px)
    dom.mobileCards.innerHTML = list
      .map((r) => {
        const m = computeMetrics(r);
        const activePbs = r.pbs.filter((pb) => pb.amount > 0).length;
        return `
          <article class="ar-mob-card" data-ar-open="${esc(r.id)}" tabindex="0">
            <div class="ar-mob-top">
              <span class="mono" style="font-size:0.72rem;color:var(--rge-blue);font-weight:700">${esc(r.poNo || r.id)}</span>
              <span class="ar-rem-pill ${m.remarksClass}">${esc(m.remarks)}</span>
            </div>
            <h3 class="ar-mob-title">${esc(r.projectTitle)}</h3>
            <p class="ar-mob-sub"><strong>${esc(r.client)}</strong>${r.endUser ? ` &bull; End User: ${esc(r.endUser)}` : ""} &bull; ${esc(r.projectSite)}</p>

            <div class="ar-mob-metrics">
              <div><span>Purchase Order Amount</span><strong>${fmtMoney(m.po, true)}</strong></div>
              <div><span>Received</span><strong>${fmtMoney(m.totalReceived, true)}</strong></div>
              <div><span>Receivable</span><strong class="strong-ar">${fmtMoney(m.arBalance, true)}</strong></div>
            </div>

            <div>
              <div class="card-progress-meta">
                <span>Total % Paid: ${fmtPct(m.totalPctPaid)}</span>
                <span>DP + ${activePbs} PB${activePbs === 1 ? "" : "s"} &bull; 2307: ${fmtMoney(m.ewt, true)}</span>
              </div>
              <div class="progress-track"><div class="progress-fill ${m.totalPctPaid >= 99.9 ? "is-complete" : ""}" style="width:${Math.min(100, m.totalPctPaid)}%"></div></div>
            </div>

            <div class="ar-mob-footer">
              <span>${esc(r.terms || "Standard Terms")}</span>
              <div class="ar-row-actions">
                <button type="button" class="ar-row-btn ar-btn-view" data-ar-view="${esc(r.id)}">View</button>
                <button type="button" class="ar-row-btn ar-btn-print" data-ar-print="${esc(r.id)}">Print</button>
              </div>
            </div>
          </article>`;
      })
      .join("");
  }

  /* ========================================================================
     SLIDE-OVER AR RECORD EDITOR DRAWER (Full PB1–PB10 Support + Live Formulas)
     ======================================================================== */
  function openARDrawer(recordId = null) {
    arState.editingId = recordId;
    arState.activePbTab = 1;

    const existing = recordId ? arState.records.find((r) => r.id === recordId) : null;
    const draft = existing
      ? structuredClone(existing)
      : {
          id: `AR-2026-${String(arState.records.length + 1).padStart(3, "0")}`,
          projectTitle: "",
          client: "",
          endUser: "",
          projectSite: "",
          poNo: "",
          poAmount: 0,
          poDate: new Date().toISOString().slice(0, 10),
          dpAmount: 0,
          dpDate: "",
          dpSiNo: "",
          dpSiDate: "",
          pbs: makeEmptyPBs(),
          finalAmount: 0,
          finalDate: "",
          finalSiNo: "",
          finalSiDate: "",
          ewt2307: 0,
          terms: "50% DP, 40% Progress Billing, 10% Completion",
          tpcCost: 0
        };

    arState.draft = draft;
    dom.drawerCode.textContent = existing ? `${draft.id} • EDIT ACCOUNT RECEIVABLE` : `${draft.id} • NEW AR RECORD`;
    dom.drawerTitle.textContent = existing ? draft.projectTitle : "Create Account Receivable Record";
    dom.btnDeleteDrawer.hidden = !existing;

    renderARDrawerForm();

    dom.drawerBackdrop.classList.add("is-open");
    dom.drawer.classList.add("is-open");
    dom.drawerBackdrop.setAttribute("aria-hidden", "false");
    dom.drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function renderARDrawerForm() {
    const d = arState.draft;
    const m = computeMetrics(d);

    const pbTabsHTML = d.pbs
      .map((pb) => {
        const hasVal = Number(pb.amount) > 0;
        return `
          <button type="button" class="ar-pb-tab ${arState.activePbTab === pb.num ? "is-active" : ""} ${hasVal ? "has-amount" : ""}" data-pb-tab="${pb.num}">
            PB${pb.num}${hasVal ? " ●" : ""}
          </button>`;
      })
      .join("");

    const activePb = d.pbs[arState.activePbTab - 1];
    const activePbPct = m.po > 0 ? (activePb.amount / m.po) * 100 : 0;

    dom.drawerBody.innerHTML = `
      <!-- Live Auto-Calculated Banner -->
      <div class="ar-live-summary">
        <div class="ar-live-box">
          <span>Total Payment Received</span>
          <strong id="ar-live-received">${fmtMoney(m.totalReceived)}</strong>
        </div>
        <div class="ar-live-box highlight">
          <span>Account Receivable</span>
          <strong id="ar-live-balance">${fmtMoney(m.arBalance)}</strong>
        </div>
        <div class="ar-live-box">
          <span>Total % Paid</span>
          <strong id="ar-live-pct">${fmtPct(m.totalPctPaid)}</strong>
        </div>
        <div class="ar-live-box">
          <span>Payment Remarks</span>
          <div style="margin-top:0.2rem"><span id="ar-live-remarks" class="ar-rem-pill ${m.remarksClass}">${esc(m.remarks)}</span></div>
        </div>
      </div>

      <!-- GROUP 1: PROJECT & PURCHASE ORDER INFO (DEEP NAVY) -->
      <div class="ar-form-section sec-navy">
        <div class="ar-sec-head">
          <h3>1. Project &amp; Purchase Order Details</h3>
          <span class="ar-auto-chip">${getStoredProjectsCatalog().length} Stored Project${getStoredProjectsCatalog().length === 1 ? "" : "s"}</span>
        </div>
        <div class="ar-form-grid">
          <div class="form-field full-span">
            <label for="ar-f-title">Project Title * <span style="font-weight:500;color:var(--text-muted)">(Click to select project &amp; auto-fill details)</span></label>
            <div class="ar-proj-picker-wrap" id="ar-proj-picker-wrap">
              <div class="ar-proj-input-row">
                <input type="text" id="ar-f-title" autocomplete="off" value="${esc(d.projectTitle)}" placeholder="Click to choose from stored &amp; newly added projects..." />
                <button type="button" class="ar-proj-toggle-btn" id="ar-btn-toggle-proj-list" title="Show stored projects list" aria-label="Show stored projects list">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
              <div class="ar-proj-dropdown" id="ar-proj-dropdown" role="listbox" hidden></div>
            </div>
          </div>
          <div class="form-field">
            <label for="ar-f-client">Client *</label>
            <input type="text" id="ar-f-client" value="${esc(d.client)}" placeholder="e.g., ABC Company" />
          </div>
          <div class="form-field">
            <label for="ar-f-enduser">End User *</label>
            <input type="text" id="ar-f-enduser" value="${esc(d.endUser)}" placeholder="e.g., Jaguar" />
          </div>
          <div class="form-field">
            <label for="ar-f-site">Project Site *</label>
            <input type="text" id="ar-f-site" value="${esc(d.projectSite)}" placeholder="e.g., Makati CBD, Metro Manila" />
          </div>
          <div class="form-field">
            <label for="ar-f-pono">Purchase Order No. *</label>
            <input type="text" id="ar-f-pono" value="${esc(d.poNo)}" placeholder="e.g., PO-2026-1001" />
          </div>
          <div class="form-field">
            <label for="ar-f-poamt">Purchase Order Amount (&#8369;) *</label>
            <input type="number" id="ar-f-poamt" step="0.01" min="0" value="${d.poAmount || ""}" placeholder="100000.00" />
          </div>
          <div class="form-field">
            <label for="ar-f-podate">Purchase Order Date *</label>
            <input type="date" id="ar-f-podate" value="${esc(d.poDate)}" />
          </div>
        </div>
      </div>

      <!-- GROUP 2: DOWN PAYMENT (GREEN) -->
      <div class="ar-form-section sec-dp">
        <div class="ar-sec-head">
          <h3>2. Down Payment</h3>
          <span class="ar-auto-chip" id="ar-live-dp-pct">% of DP: ${fmtPct(m.dpPct)} (Auto)</span>
        </div>
        <div class="ar-form-grid">
          <div class="form-field">
            <label for="ar-f-dpamt">Down Payment (&#8369;)</label>
            <input type="number" id="ar-f-dpamt" step="0.01" min="0" value="${d.dpAmount || ""}" placeholder="50000.00" />
          </div>
          <div class="form-field">
            <label for="ar-f-dpdate">DP Date</label>
            <input type="date" id="ar-f-dpdate" value="${esc(d.dpDate)}" />
          </div>
          <div class="form-field">
            <label for="ar-f-dpsino">Sales Invoice #</label>
            <input type="text" id="ar-f-dpsino" value="${esc(d.dpSiNo)}" placeholder="Manual input" />
          </div>
          <div class="form-field">
            <label for="ar-f-dpsidate">Sales Invoice Date</label>
            <input type="date" id="ar-f-dpsidate" value="${esc(d.dpSiDate)}" />
          </div>
        </div>
      </div>

      <!-- GROUP 3: PROGRESS BILLING 1–10 (ORCHID/PURPLE) -->
      <div class="ar-form-section sec-pb">
        <div class="ar-sec-head">
          <h3>3. Progress Billing (PB1 – PB10)</h3>
          <span class="ar-auto-chip" id="ar-live-pb-pct">PB${activePb.num} Share: ${fmtPct(activePbPct)} (Auto)</span>
        </div>
        <div class="ar-pb-tabs" id="ar-pb-tabs">${pbTabsHTML}</div>
        <div class="ar-form-grid" style="margin-top:0.65rem">
          <div class="form-field">
            <label for="ar-f-pbamt">PB${activePb.num} Amount (&#8369;)</label>
            <input type="number" id="ar-f-pbamt" step="0.01" min="0" value="${activePb.amount || ""}" placeholder="20000.00" />
          </div>
          <div class="form-field">
            <label for="ar-f-pbdate">PB${activePb.num} Date</label>
            <input type="date" id="ar-f-pbdate" value="${esc(activePb.date)}" />
          </div>
          <div class="form-field">
            <label for="ar-f-pbsino">PB${activePb.num} Sales Invoice #</label>
            <input type="text" id="ar-f-pbsino" value="${esc(activePb.siNo)}" placeholder="Manual input" />
          </div>
          <div class="form-field">
            <label for="ar-f-pbsidate">PB${activePb.num} Sales Invoice Date</label>
            <input type="date" id="ar-f-pbsidate" value="${esc(activePb.siDate)}" />
          </div>
        </div>
      </div>

      <!-- GROUP 4: FINAL PAYMENT (PEACH/CORAL) -->
      <div class="ar-form-section sec-final">
        <div class="ar-sec-head">
          <h3>4. Final Payment</h3>
          <span class="ar-auto-chip" id="ar-live-final-pct">% of Final: ${fmtPct(m.finalPct)} (Auto)</span>
        </div>
        <div class="ar-form-grid">
          <div class="form-field">
            <label for="ar-f-finamt">Final Payment (&#8369;)</label>
            <input type="number" id="ar-f-finamt" step="0.01" min="0" value="${d.finalAmount || ""}" placeholder="0.00" />
          </div>
          <div class="form-field">
            <label for="ar-f-findate">Final Payment Date</label>
            <input type="date" id="ar-f-findate" value="${esc(d.finalDate)}" />
          </div>
          <div class="form-field">
            <label for="ar-f-finsino">Sales Invoice #</label>
            <input type="text" id="ar-f-finsino" value="${esc(d.finalSiNo)}" placeholder="Manual input" />
          </div>
          <div class="form-field">
            <label for="ar-f-finsidate">Sales Invoice Date</label>
            <input type="date" id="ar-f-finsidate" value="${esc(d.finalSiDate)}" />
          </div>
        </div>
      </div>

      <!-- GROUP 5: 2307 WITHHOLDING TAX, TERMS & TPC COST -->
      <div class="ar-form-section sec-tax">
        <h3>5. 2307 Tax, Payment Terms &amp; TPC Cost</h3>
        <div class="ar-form-grid">
          <div class="form-field full-span">
            <label for="ar-f-ewt">2307 w/holding tax (&#8369;) — Manual Entry (not automatic)</label>
            <div class="ar-ewt-row">
              <input type="number" id="ar-f-ewt" step="0.01" min="0" value="${d.ewt2307 || ""}" placeholder="Enter actual 2307 amount" />
              <button type="button" class="btn btn-outline btn-sm" id="ar-btn-calc-1pct" title="Calculate 1% of Total Payment Received">1% Helper</button>
              <button type="button" class="btn btn-outline btn-sm" id="ar-btn-calc-2pct" title="Calculate 2% of Total Payment Received">2% Helper</button>
            </div>
          </div>
          <div class="form-field full-span">
            <label for="ar-f-terms">Terms</label>
            <input type="text" id="ar-f-terms" value="${esc(d.terms)}" placeholder="e.g., 50% DP, 40% Progress Billing, 10% Completion" />
          </div>
          <div class="form-field">
            <label for="ar-f-tpc">TPC Cost (&#8369;) — Manual Input</label>
            <input type="number" id="ar-f-tpc" step="0.01" min="0" value="${d.tpcCost || ""}" placeholder="Total Project Cost" />
          </div>
          <div class="form-field">
            <label>Est. Gross Margin (Auto)</label>
            <div class="ar-readonly-box" id="ar-live-margin">${fmtMoney(m.grossMargin)} (${fmtPct(m.marginPct)})</div>
          </div>
        </div>
      </div>`;

    bindDrawerInputs();
  }

  function syncDraftFromInputs() {
    const d = arState.draft;
    d.projectTitle = document.getElementById("ar-f-title").value;
    d.client = document.getElementById("ar-f-client").value;
    d.endUser = document.getElementById("ar-f-enduser").value;
    d.projectSite = document.getElementById("ar-f-site").value;
    d.poNo = document.getElementById("ar-f-pono").value;
    d.poAmount = Number(document.getElementById("ar-f-poamt").value) || 0;
    d.poDate = document.getElementById("ar-f-podate").value;

    d.dpAmount = Number(document.getElementById("ar-f-dpamt").value) || 0;
    d.dpDate = document.getElementById("ar-f-dpdate").value;
    d.dpSiNo = document.getElementById("ar-f-dpsino").value;
    d.dpSiDate = document.getElementById("ar-f-dpsidate").value;

    const pb = d.pbs[arState.activePbTab - 1];
    pb.amount = Number(document.getElementById("ar-f-pbamt").value) || 0;
    pb.date = document.getElementById("ar-f-pbdate").value;
    pb.siNo = document.getElementById("ar-f-pbsino").value;
    pb.siDate = document.getElementById("ar-f-pbsidate").value;

    d.finalAmount = Number(document.getElementById("ar-f-finamt").value) || 0;
    d.finalDate = document.getElementById("ar-f-findate").value;
    d.finalSiNo = document.getElementById("ar-f-finsino").value;
    d.finalSiDate = document.getElementById("ar-f-finsidate").value;

    d.ewt2307 = Number(document.getElementById("ar-f-ewt").value) || 0;
    d.terms = document.getElementById("ar-f-terms").value;
    d.tpcCost = Number(document.getElementById("ar-f-tpc").value) || 0;
  }

  function refreshDrawerLiveNumbers() {
    syncDraftFromInputs();
    const d = arState.draft;
    const m = computeMetrics(d);
    const pb = d.pbs[arState.activePbTab - 1];
    const pbPct = m.po > 0 ? (pb.amount / m.po) * 100 : 0;

    document.getElementById("ar-live-received").textContent = fmtMoney(m.totalReceived);
    document.getElementById("ar-live-balance").textContent = fmtMoney(m.arBalance);
    document.getElementById("ar-live-pct").textContent = fmtPct(m.totalPctPaid);
    const remEl = document.getElementById("ar-live-remarks");
    remEl.textContent = m.remarks;
    remEl.className = `ar-rem-pill ${m.remarksClass}`;

    document.getElementById("ar-live-dp-pct").textContent = `% of DP: ${fmtPct(m.dpPct)} (Auto)`;
    document.getElementById("ar-live-pb-pct").textContent = `PB${pb.num} Share: ${fmtPct(pbPct)} (Auto)`;
    document.getElementById("ar-live-final-pct").textContent = `% of Final: ${fmtPct(m.finalPct)} (Auto)`;
    document.getElementById("ar-live-margin").textContent = `${fmtMoney(m.grossMargin)} (${fmtPct(m.marginPct)})`;
  }

  function bindDrawerInputs() {
    dom.drawerBody.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", refreshDrawerLiveNumbers);
    });

    // Interactive Stored Projects Picker on Project Title click / focus / type
    const titleInput = document.getElementById("ar-f-title");
    const dropdown = document.getElementById("ar-proj-dropdown");
    const toggleBtn = document.getElementById("ar-btn-toggle-proj-list");
    const pickerWrap = document.getElementById("ar-proj-picker-wrap");

    const renderProjectDropdown = (filterText = "") => {
      const catalog = getStoredProjectsCatalog();
      const q = filterText.trim().toLowerCase();
      const matches = q
        ? catalog.filter((p) => {
            const hay = `${p.projectId} ${p.projectTitle} ${p.client} ${p.endUser} ${p.projectSite} ${p.poNo}`.toLowerCase();
            return hay.includes(q);
          })
        : catalog;

      if (!matches.length) {
        dropdown.innerHTML = `<div class="ar-proj-empty">${
          catalog.length
            ? "No stored project matches your search — you may keep typing a custom Project Title."
            : "No projects saved yet. Add one via + New Project or type a Project Title manually."
        }</div>`;
      } else {
        dropdown.innerHTML = matches
          .map(
            (p, idx) => `
              <button type="button" class="ar-proj-option" role="option" data-proj-idx="${idx}">
                <div class="ar-proj-opt-top">
                  <strong>${esc(p.projectTitle)}</strong>
                  <span class="ar-proj-opt-badge ${p.hasAR ? "is-linked" : "is-new"}">${p.hasAR ? "Saved Project" : "New • Auto-Fill"}</span>
                </div>
                <div class="ar-proj-opt-meta">
                  <span>${esc(p.client || "No Client")}${p.endUser ? ` &bull; ${esc(p.endUser)}` : ""}</span>
                  <span class="mono">${esc(p.poNo || "No Purchase Order")} &bull; ${fmtMoney(p.poAmount, true)}</span>
                </div>
                ${p.projectSite ? `<div class="ar-proj-opt-site">${esc(p.projectSite)}${p.poDate ? ` &bull; Purchase Order Date: ${esc(p.poDate)}` : ""}</div>` : ""}
              </button>`
          )
          .join("");
      }

      dropdown._matches = matches;
      dropdown.hidden = false;
    };

    const closeDropdown = () => {
      if (dropdown) dropdown.hidden = true;
    };

    if (titleInput && dropdown) {
      titleInput.addEventListener("focus", () => renderProjectDropdown(""));
      titleInput.addEventListener("click", () => renderProjectDropdown(""));
      titleInput.addEventListener("input", (e) => renderProjectDropdown(e.target.value));

      if (toggleBtn) {
        toggleBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropdown.hidden) {
            renderProjectDropdown("");
            titleInput.focus();
          } else {
            closeDropdown();
          }
        });
      }

      dropdown.addEventListener("click", (e) => {
        const opt = e.target.closest("[data-proj-idx]");
        if (!opt) return;
        const idx = Number(opt.getAttribute("data-proj-idx"));
        const picked = (dropdown._matches || [])[idx];
        if (!picked) return;

        document.getElementById("ar-f-title").value = picked.projectTitle || "";
        document.getElementById("ar-f-client").value = picked.client || "";
        document.getElementById("ar-f-enduser").value = picked.endUser || "";
        document.getElementById("ar-f-site").value = picked.projectSite || "";
        document.getElementById("ar-f-pono").value = picked.poNo || "";
        document.getElementById("ar-f-poamt").value = picked.poAmount || "";
        if (picked.poDate) document.getElementById("ar-f-podate").value = picked.poDate;
        const tpcInput = document.getElementById("ar-f-tpc");
        if (tpcInput && (!tpcInput.value || Number(tpcInput.value) === 0) && picked.tpcCost > 0) {
          tpcInput.value = picked.tpcCost;
        }

        if (!arState.editingId) {
          dom.drawerTitle.textContent = picked.projectTitle || "Create Account Receivable Record";
        }
        refreshDrawerLiveNumbers();
        closeDropdown();
        toast(`Auto-filled Purchase Order details from "${picked.projectTitle}".`);
      });

      dom.drawerBody.addEventListener("mousedown", (e) => {
        if (pickerWrap && !pickerWrap.contains(e.target)) closeDropdown();
      });
    }

    // Switch between PB1..PB10 tabs inside drawer without losing typed values
    dom.drawerBody.querySelector("#ar-pb-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pb-tab]");
      if (!btn) return;
      syncDraftFromInputs();
      arState.activePbTab = Number(btn.getAttribute("data-pb-tab"));
      renderARDrawerForm();
    });

    // Optional manual 1% / 2% 2307 helper buttons (never runs automatically!)
    document.getElementById("ar-btn-calc-1pct").addEventListener("click", () => {
      syncDraftFromInputs();
      const m = computeMetrics(arState.draft);
      const val = Number((m.totalReceived * 0.01).toFixed(2));
      document.getElementById("ar-f-ewt").value = val;
      refreshDrawerLiveNumbers();
      toast(`Filled 1% 2307 helper (${fmtMoney(val)}).`);
    });

    document.getElementById("ar-btn-calc-2pct").addEventListener("click", () => {
      syncDraftFromInputs();
      const m = computeMetrics(arState.draft);
      const val = Number((m.totalReceived * 0.02).toFixed(2));
      document.getElementById("ar-f-ewt").value = val;
      refreshDrawerLiveNumbers();
      toast(`Filled 2% 2307 helper (${fmtMoney(val)}).`);
    });
  }

  function saveARDrawer() {
    syncDraftFromInputs();
    const d = arState.draft;
    const missing = [];
    if (!d.projectTitle.trim()) missing.push("Project Title");
    if (!d.client.trim()) missing.push("Client");
    if (!d.endUser.trim()) missing.push("End User");
    if (!d.projectSite.trim()) missing.push("Project Site");
    if (!d.poNo.trim()) missing.push("Purchase Order No.");
    if (!(Number(d.poAmount) > 0)) missing.push("Purchase Order Amount");
    if (!d.poDate.trim()) missing.push("Purchase Order Date");

    if (missing.length) {
      toast(`Please fill required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
      return;
    }

    if (arState.editingId) {
      const idx = arState.records.findIndex((r) => r.id === arState.editingId);
      if (idx !== -1) arState.records[idx] = structuredClone(d);
      toast(`Updated AR record: ${d.projectTitle}`);
    } else {
      arState.records.unshift(structuredClone(d));
      toast(`Added new AR record: ${d.projectTitle}`);
    }

    saveAR();
    closeARDrawer();
    renderAR();
  }

  function deleteARRecord() {
    if (!arState.editingId) return;
    const rec = arState.records.find((r) => r.id === arState.editingId);
    if (!rec) return;
    if (!window.confirm(`Delete Account Receivable record "${rec.projectTitle}"?`)) return;
    arState.records = arState.records.filter((r) => r.id !== arState.editingId);
    saveAR();
    closeARDrawer();
    renderAR();
    if (window.RGE_CLOUD_SYNC) window.RGE_CLOUD_SYNC.pushImmediateIfEnabled();
    toast(`Permanently deleted AR record ${rec.id} from storage.`);
  }

  function closeARDrawer() {
    dom.drawerBackdrop.classList.remove("is-open");
    dom.drawer.classList.remove("is-open");
    dom.drawerBackdrop.setAttribute("aria-hidden", "true");
    dom.drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    arState.editingId = null;
  }

  /* ========================================================================
     EXPORT FULL AR CSV (ALL PB1–PB10 COLUMNS INCLUDED!)
     ======================================================================== */
  function exportARCSV() {
    const rows = getFilteredAR();
    const headers = [
      "Project Title", "Client", "End User", "Project Site", "Purchase Order No.", "Purchase Order Amount", "Purchase Order Date",
      "Down Payment", "% of DP", "DP Date", "DP Sales Invoice #", "DP Sales Invoice Date"
    ];
    for (let i = 1; i <= PB_COUNT; i++) {
      headers.push(`Progress Billing ${i}`, `% of PB${i}`, `PB${i} Date`, `PB${i} Sales Invoice #`, `PB${i} Sales Invoice Date`);
    }
    headers.push(
      "Final Payment", "% of Final Payment", "Final Date", "Final Sales Invoice #", "Final Sales Invoice Date",
      "Total Payment Received", "2307 w/holding tax", "Total % Paid", "Payment Remarks", "Account Receivable", "Terms", "TPC Cost"
    );

    const lines = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => {
        const m = computeMetrics(r);
        const vals = [
          r.projectTitle, r.client, r.endUser, r.projectSite, r.poNo, m.po.toFixed(2), r.poDate,
          m.dp.toFixed(2), `${m.dpPct.toFixed(2)}%`, r.dpDate, r.dpSiNo, r.dpSiDate
        ];
        for (let i = 0; i < PB_COUNT; i++) {
          const pb = r.pbs[i];
          const pct = m.po > 0 ? (pb.amount / m.po) * 100 : 0;
          vals.push(pb.amount.toFixed(2), `${pct.toFixed(2)}%`, pb.date, pb.siNo, pb.siDate);
        }
        vals.push(
          m.fin.toFixed(2), `${m.finalPct.toFixed(2)}%`, r.finalDate, r.finalSiNo, r.finalSiDate,
          m.totalReceived.toFixed(2), m.ewt.toFixed(2), `${m.totalPctPaid.toFixed(2)}%`,
          m.remarks, m.arBalance.toFixed(2), r.terms, m.tpc.toFixed(2)
        );
        return vals.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
      })
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RGE_Account_Receivable_PB1_to_PB10_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} AR records (with all PB1–PB10 columns) to CSV.`);
  }

  function openOrCreateFromAwarded(proj) {
    if (!dom.tableEl) cacheDOM();
    const poClean = (proj.po || "").trim().toLowerCase();
    const titleClean = (proj.name || "").trim().toLowerCase();

    const match = arState.records.find(
      (r) =>
        (poClean && (r.poNo || "").trim().toLowerCase() === poClean) ||
        (titleClean && (r.projectTitle || "").trim().toLowerCase() === titleClean)
    );

    if (match) {
      renderAR();
      openARDrawer(match.id);
      toast(`Opened existing AR Ledger record (${match.poNo || match.id}).`);
      return;
    }

    // Auto-create AR record directly from the unified Project Awarded object (zero double entry!)
    const newAR = {
      id: `AR-2026-${String(arState.records.length + 1).padStart(3, "0")}`,
      projectTitle: proj.name || "",
      client: proj.client || "",
      endUser: proj.endUser || proj.client || "",
      projectSite: proj.location || "",
      poNo: proj.po || "",
      poAmount: Number(proj.value) || 0,
      poDate: proj.poDate || new Date().toISOString().slice(0, 10),
      dpAmount: 0,
      dpDate: "",
      dpSiNo: "",
      dpSiDate: "",
      pbs: makeEmptyPBs(),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 0,
      terms: "50% DP, 40% Progress Billing, 10% Completion",
      tpcCost: Number(proj.workingBudget) || 0
    };

    arState.records.unshift(newAR);
    saveAR();
    renderAR();
    openARDrawer(newAR.id);
    toast(`Created & synced AR record ${newAR.id} from "${proj.po || proj.id}".`);
  }

  /* ========================================================================
     SINGLE-ROW VIEW STATEMENT MODAL & PRINTABLE RGE CORPORATE STATEMENT
     ======================================================================== */
  function buildVerticalARTableHTML(r) {
    const m = computeMetrics(r);
    const activePbs = (r.pbs || []).filter((pb) => Number(pb.amount) > 0 || pb.date || pb.siNo);
    const pbRows = activePbs.length
      ? activePbs
          .map((pb) => {
            const pct = m.po > 0 ? (pb.amount / m.po) * 100 : 0;
            return `
              <tr class="st-pb"><td class="st-k">Progress Billing ${pb.num} (PB${pb.num})</td><td class="st-v mono"><strong>${fmtMoney(pb.amount)}</strong> (${fmtPct(pct)})</td></tr>
              <tr class="st-pb-sub"><td class="st-k">PB${pb.num} Date / Sales Invoice # / Sales Invoice Date</td><td class="st-v mono">${esc(pb.date || "—")} &nbsp;|&nbsp; Sales Invoice #: ${esc(pb.siNo || "—")} &nbsp;|&nbsp; ${esc(pb.siDate || "—")}</td></tr>`;
          })
          .join("")
      : `<tr class="st-pb"><td class="st-k">Progress Billing (PB1–PB10)</td><td class="st-v muted">No progress billing recorded yet</td></tr>`;

    return `
      <table class="ar-vert-sheet">
        <tbody>
          <tr class="st-navy"><td class="st-k">Project Title</td><td class="st-v"><strong>${esc(r.projectTitle)}</strong></td></tr>
          <tr class="st-navy"><td class="st-k">Client</td><td class="st-v">${esc(r.client)}</td></tr>
          <tr class="st-navy"><td class="st-k">End User</td><td class="st-v">${esc(r.endUser || "—")}</td></tr>
          <tr class="st-navy"><td class="st-k">Project Site</td><td class="st-v">${esc(r.projectSite || "—")}</td></tr>
          <tr class="st-navy"><td class="st-k">Purchase Order No.</td><td class="st-v mono">${esc(r.poNo || "—")}</td></tr>
          <tr class="st-navy"><td class="st-k">Purchase Order Amount</td><td class="st-v mono"><strong>${fmtMoney(m.po)}</strong></td></tr>
          <tr class="st-navy"><td class="st-k">Purchase Order Date</td><td class="st-v mono">${esc(r.poDate || "—")}</td></tr>

          <tr class="st-dp"><td class="st-k">Down Payment</td><td class="st-v mono"><strong>${fmtMoney(m.dp)}</strong> (${fmtPct(m.dpPct)})</td></tr>
          <tr class="st-dp"><td class="st-k">DP Date / Sales Invoice # / Sales Invoice Date</td><td class="st-v mono">${esc(r.dpDate || "—")} &nbsp;|&nbsp; Sales Invoice #: ${esc(r.dpSiNo || "—")} &nbsp;|&nbsp; ${esc(r.dpSiDate || "—")}</td></tr>

          ${pbRows}

          <tr class="st-final"><td class="st-k">Final Payment</td><td class="st-v mono"><strong>${fmtMoney(m.fin)}</strong> (${fmtPct(m.finalPct)})</td></tr>
          <tr class="st-final"><td class="st-k">Final Date / Sales Invoice # / Sales Invoice Date</td><td class="st-v mono">${esc(r.finalDate || "—")} &nbsp;|&nbsp; Sales Invoice #: ${esc(r.finalSiNo || "—")} &nbsp;|&nbsp; ${esc(r.finalSiDate || "—")}</td></tr>

          <tr class="st-cyan"><td class="st-k">Total Payment Received</td><td class="st-v mono"><strong>${fmtMoney(m.totalReceived)}</strong></td></tr>
          <tr class="st-rose"><td class="st-k">2307 w/holding tax</td><td class="st-v mono"><strong>${fmtMoney(m.ewt)}</strong></td></tr>
          <tr class="st-white"><td class="st-k">Total % Paid</td><td class="st-v mono"><strong>${fmtPct(m.totalPctPaid)}</strong></td></tr>
          <tr class="st-cyan"><td class="st-k">Payment Remarks</td><td class="st-v"><span class="ar-rem-pill ${m.remarksClass}">${esc(m.remarks)}</span></td></tr>
          <tr class="st-cyan"><td class="st-k">Account Receivable (Balance)</td><td class="st-v mono"><strong style="font-size:1.05em">${fmtMoney(m.arBalance)}</strong></td></tr>
          <tr class="st-white"><td class="st-k">Terms</td><td class="st-v">${esc(r.terms || "—")}</td></tr>
          <tr class="st-white"><td class="st-k">TPC Cost / Est. Gross Margin</td><td class="st-v mono">${fmtMoney(m.tpc)} &nbsp;|&nbsp; Margin: <strong>${fmtMoney(m.grossMargin)} (${fmtPct(m.marginPct)})</strong></td></tr>
        </tbody>
      </table>`;
  }

  function openARViewModal(recordId) {
    const rec = arState.records.find((r) => r.id === recordId);
    if (!rec) return;
    arState.viewingId = recordId;
    dom.viewCode.textContent = `${rec.id} • ${rec.poNo || "NO PURCHASE ORDER"}`;
    dom.viewTitle.textContent = rec.projectTitle;
    dom.viewBody.innerHTML = buildVerticalARTableHTML(rec);
    dom.viewBackdrop.classList.add("is-open");
    dom.viewBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeARViewModal() {
    dom.viewBackdrop.classList.remove("is-open");
    dom.viewBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    arState.viewingId = null;
  }

  function printARRecord(recordId) {
    const rec = arState.records.find((r) => r.id === recordId) || arState.draft;
    if (!rec) return;
    const win = window.open("", "_blank", "width=920,height=780");
    if (!win) {
      toast("Pop-up blocked — allow pop-ups to print the AR statement.");
      return;
    }
    const tableHTML = buildVerticalARTableHTML(rec);
    const printedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

    win.document.write(`<!DOCTYPE html><html><head><title>${esc(rec.poNo || rec.id)} — Account Receivable Statement</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Inter,Arial,sans-serif;color:#0F172A;margin:0;padding:24px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;}
        .hdr-l{display:flex;align-items:center;gap:12px;}
        .hdr-l img{width:56px;height:56px;object-fit:contain;}
        .hdr-w{font-weight:800;font-size:15px;line-height:1.15;color:#0A0E17;}
        .hdr-r{font-size:12px;text-align:right;color:#111827;line-height:1.35;}
        .accent-bar{display:flex;height:14px;margin-bottom:18px;}
        .ab-gray{width:54%;height:5px;background:#636569;align-self:flex-end;}
        .ab-blue{width:18px;background:#2573BA;transform:skewX(-32deg);margin:0 4px;}
        .ab-navy{flex:1;background:#142A54;}
        .doc-title{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;}
        .doc-title h1{font-size:17px;margin:0;color:#002060;letter-spacing:0.02em;text-transform:uppercase;}
        .doc-title span{font-size:11px;color:#64748B;}
        .ar-vert-sheet{width:100%;border-collapse:collapse;font-size:12px;border:1px solid #CBD5E1;}
        .ar-vert-sheet td{padding:7px 11px;border:1px solid #CBD5E1;}
        .ar-vert-sheet .st-k{width:34%;font-weight:700;}
        .ar-vert-sheet .st-v{width:66%;background:#FFFFFF;}
        .st-navy .st-k{background:#002060;color:#FFFFFF;}
        .st-dp .st-k{background:#68D37E;color:#052E16;}
        .st-pb .st-k,.st-pb-sub .st-k{background:#DA96DE;color:#3B0764;}
        .st-final .st-k{background:#EB9E71;color:#431407;}
        .st-cyan .st-k{background:#4FC3F7;color:#082F49;}
        .st-rose .st-k{background:#F8BBD0;color:#B91C1C;}
        .st-white .st-k{background:#F8FAFD;color:#0F172A;}
        .mono{font-family:Consolas,monospace;}
        .muted{color:#64748B;}
        .ar-rem-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:700;font-size:11px;}
        .ar-rem-paid{background:#DCFCE7;color:#15803D;}
        .ar-rem-good{background:#CCFBF1;color:#0F766E;}
        .ar-rem-billing{background:#FEF3C7;color:#B45309;}
        .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:34px;font-size:12px;}
        .sig-line{border-top:1px solid #475569;padding-top:6px;margin-top:34px;font-weight:600;color:#334155;}
        .ftr{margin-top:26px;padding-top:10px;border-top:3px solid #142A54;display:flex;justify-content:space-between;font-size:11px;color:#334155;}
      </style></head><body>
      <div class="hdr">
        <div class="hdr-l">
          <img src="${window.location.origin}/Images/RGE%20Logo.jpg" alt="RGE" />
          <div class="hdr-w">INFRA &amp; INFORMATION<br/>TECHNOLOGY SERVICES</div>
        </div>
        <div class="hdr-r">Unit 210, Don Raul Building, #77<br/>Kamuning Road, Quezon City</div>
      </div>
      <div class="accent-bar"><div class="ab-gray"></div><div class="ab-blue"></div><div class="ab-navy"></div></div>
      <div class="doc-title">
        <h1>Account Receivable Record Statement</h1>
        <span>Ref: ${esc(rec.id)} &bull; Printed ${esc(printedAt)}</span>
      </div>
      ${tableHTML}
      <div class="sigs">
        <div>Prepared by:<div class="sig-line">Accounting / Project Coordinator</div></div>
        <div>Reviewed &amp; Approved by:<div class="sig-line">Authorized Signatory — RGE Infra &amp; IT</div></div>
      </div>
      <div class="ftr">
        <span>admin@rgeitservices.com &bull; www.rgeinfraitservices.com</span>
        <span>+63 917 637 9769 &bull; +63 917 180 3070</span>
      </div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`);
    win.document.close();
  }

  /* ========================================================================
     INIT & EVENT WIRING
     ======================================================================== */
  function init() {
    cacheDOM();
    if (!dom.tableEl) return;

    dom.searchInput.addEventListener("input", (e) => {
      arState.search = e.target.value;
      renderAR();
    });

    dom.remarksPills.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ar-remark]");
      if (!btn) return;
      arState.remarksFilter = btn.getAttribute("data-ar-remark");
      dom.remarksPills.querySelectorAll(".status-chip").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderAR();
    });

    dom.btnPbActive.addEventListener("click", () => {
      arState.pbViewMode = "active";
      dom.btnPbActive.classList.add("is-active");
      dom.btnPbAll.classList.remove("is-active");
      renderAR();
    });

    dom.btnPbAll.addEventListener("click", () => {
      arState.pbViewMode = "all";
      dom.btnPbAll.classList.add("is-active");
      dom.btnPbActive.classList.remove("is-active");
      renderAR();
    });

    dom.btnExportCsv.addEventListener("click", exportARCSV);
    dom.btnAddRecord.addEventListener("click", () => openARDrawer(null));

    const openHandler = (e) => {
      const viewBtn = e.target.closest("[data-ar-view]");
      if (viewBtn) {
        e.stopPropagation();
        openARViewModal(viewBtn.getAttribute("data-ar-view"));
        return;
      }
      const printBtn = e.target.closest("[data-ar-print]");
      if (printBtn) {
        e.stopPropagation();
        printARRecord(printBtn.getAttribute("data-ar-print"));
        return;
      }
      const row = e.target.closest("[data-ar-open]");
      if (row) openARDrawer(row.getAttribute("data-ar-open"));
    };
    dom.tableEl.addEventListener("click", openHandler);
    dom.mobileCards.addEventListener("click", openHandler);

    dom.btnCloseDrawer.addEventListener("click", closeARDrawer);
    dom.drawerBackdrop.addEventListener("click", closeARDrawer);
    dom.btnSaveDrawer.addEventListener("click", saveARDrawer);
    dom.btnDeleteDrawer.addEventListener("click", deleteARRecord);
    if (dom.btnPrintDrawer) {
      dom.btnPrintDrawer.addEventListener("click", () => {
        syncDraftFromInputs();
        printARRecord(arState.editingId);
      });
    }

    if (dom.btnCloseView) dom.btnCloseView.addEventListener("click", closeARViewModal);
    if (dom.viewBackdrop) {
      dom.viewBackdrop.addEventListener("click", (e) => {
        if (e.target === dom.viewBackdrop) closeARViewModal();
      });
    }
    if (dom.btnEditFromView) {
      dom.btnEditFromView.addEventListener("click", () => {
        const id = arState.viewingId;
        closeARViewModal();
        if (id) openARDrawer(id);
      });
    }
    if (dom.btnPrintFromView) {
      dom.btnPrintFromView.addEventListener("click", () => {
        if (arState.viewingId) printARRecord(arState.viewingId);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (dom.viewBackdrop?.classList.contains("is-open")) closeARViewModal();
        else if (dom.drawer.classList.contains("is-open")) closeARDrawer();
      }
    });

    renderAR();
  }

  /* Cascade delete matching AR record when parent project is deleted */
  function deleteByProject(proj) {
    if (!proj) return false;
    const poClean = (proj.po || "").trim().toLowerCase();
    const titleClean = (proj.name || "").trim().toLowerCase();
    const before = arState.records.length;
    arState.records = arState.records.filter((r) => {
      const matchPo = poClean && (r.poNo || "").trim().toLowerCase() === poClean;
      const matchTitle = titleClean && (r.projectTitle || "").trim().toLowerCase() === titleClean;
      return !(matchPo || matchTitle);
    });
    if (arState.records.length !== before) {
      saveAR();
      renderAR();
      return true;
    }
    return false;
  }

  return { init, renderAR, openARDrawer, openOrCreateFromAwarded, deleteByProject };
})();
