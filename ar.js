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
  const AR_STORAGE_KEY = "rge_project_tracker_ar_v1";
  const PB_COUNT = 10;

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

  /* Seeded AR Records (Starts with the exact example from user's screenshot + RGE Infra records) */
  const INITIAL_AR_RECORDS = [
    {
      id: "AR-2026-001",
      projectTitle: "Supply & installation of CCTV Cameras (24units)",
      client: "ABC Company",
      endUser: "Jaquar",
      projectSite: "Makati",
      poNo: "PO-2026-1001",
      poAmount: 100000,
      poDate: "2026-11-21",
      dpAmount: 50000,
      dpDate: "2026-11-22",
      dpSiNo: "SI-2026-0412",
      dpSiDate: "2026-11-22",
      pbs: makeEmptyPBs({
        1: { amount: 20000, date: "2026-11-28", siNo: "SI-2026-0438", siDate: "2026-11-28" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 700, // Manual 2307 withholding tax input (1% example)
      terms: "50% DP, 40% Progress Billing, 10% Completion",
      tpcCost: 68500
    },
    {
      id: "AR-2026-002",
      projectTitle: "Commonwealth Ave. Smart Traffic & AI CCTV Grid",
      client: "Quezon City DPOS",
      endUser: "Quezon City Government",
      projectSite: "Commonwealth Ave., Quezon City",
      poNo: "PO-2026-4012",
      poAmount: 54200000,
      poDate: "2026-01-12",
      dpAmount: 16260000,
      dpDate: "2026-01-25",
      dpSiNo: "SI-2026-0104",
      dpSiDate: "2026-01-24",
      pbs: makeEmptyPBs({
        1: { amount: 10840000, date: "2026-04-15", siNo: "SI-2026-0188", siDate: "2026-04-12" },
        2: { amount: 10840000, date: "2026-07-22", siNo: "SI-2026-0265", siDate: "2026-07-19" },
        3: { amount: 5420000, date: "2026-10-10", siNo: "SI-2026-0340", siDate: "2026-10-08" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 433600,
      terms: "30% DP, 60% Progress Billing (PB1–PB4), 10% Retention",
      tpcCost: 39800000
    },
    {
      id: "AR-2026-003",
      projectTitle: "BGC Corporate Tower Core Switching & Wi-Fi 6E",
      client: "Ayala Triangle Enterprise Group",
      endUser: "MetroPrime Holdings",
      projectSite: "BGC, Taguig City",
      poNo: "PO-2026-4118",
      poAmount: 41500000,
      poDate: "2025-11-10",
      dpAmount: 20750000,
      dpDate: "2025-11-20",
      dpSiNo: "SI-2025-0910",
      dpSiDate: "2025-11-18",
      pbs: makeEmptyPBs({
        1: { amount: 12450000, date: "2026-03-14", siNo: "SI-2026-0155", siDate: "2026-03-11" },
        2: { amount: 7470000, date: "2026-08-19", siNo: "SI-2026-0299", siDate: "2026-08-15" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 406700,
      terms: "50% DP, 40% Progress Billing, 10% Final Acceptance",
      tpcCost: 29400000
    },
    {
      id: "AR-2026-004",
      projectTitle: "NCR Emergency Ops Center 14m Fine-Pitch LED Wall",
      client: "Metro Manila DRRMO",
      endUser: "MMDA Operations Command",
      projectSite: "Quezon City",
      poNo: "PO-2026-3890",
      poAmount: 29400000,
      poDate: "2025-08-20",
      dpAmount: 14700000,
      dpDate: "2025-09-02",
      dpSiNo: "SI-2025-0744",
      dpSiDate: "2025-09-01",
      pbs: makeEmptyPBs({
        1: { amount: 8820000, date: "2026-01-18", siNo: "SI-2026-0092", siDate: "2026-01-15" }
      }),
      finalAmount: 5586000,
      finalDate: "2026-09-30",
      finalSiNo: "SI-2026-0321",
      finalSiDate: "2026-09-28",
      ewt2307: 294000,
      terms: "50% DP, 30% Delivery PB1, 20% Commissioning",
      tpcCost: 21150000
    },
    {
      id: "AR-2026-005",
      projectTitle: "QC District 4 144-Core ADSS Fiber Drums & Closures",
      client: "Quezon City Engineering Office",
      endUser: "QC IT Development Office",
      projectSite: "Kamuning & District 4, QC",
      poNo: "PO-2026-4410",
      poAmount: 14800000,
      poDate: "2026-08-05",
      dpAmount: 7400000,
      dpDate: "2026-08-18",
      dpSiNo: "SI-2026-0290",
      dpSiDate: "2026-08-16",
      pbs: makeEmptyPBs({
        1: { amount: 3700000, date: "2026-10-22", siNo: "SI-2026-0364", siDate: "2026-10-20" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 111000,
      terms: "50% DP, 25% Batch 1 Delivery, 25% Final Delivery",
      tpcCost: 10900000
    },
    {
      id: "AR-2026-006",
      projectTitle: "Cat6A Shielded Boxes, Patch Panels & OM4 Trunks",
      client: "MetroPrime Financial Holdings",
      endUser: "MetroPrime BGC Tower",
      projectSite: "BGC, Taguig City",
      poNo: "PO-2026-4302",
      poAmount: 6850000,
      poDate: "2026-07-01",
      dpAmount: 3425000,
      dpDate: "2026-07-10",
      dpSiNo: "SI-2026-0251",
      dpSiDate: "2026-07-08",
      pbs: makeEmptyPBs(),
      finalAmount: 3356500,
      finalDate: "2026-11-05",
      finalSiNo: "SI-2026-0392",
      finalSiDate: "2026-11-04",
      ewt2307: 68500,
      terms: "50% DP, 50% Upon Full Warehouse Release",
      tpcCost: 5120000
    },
    {
      id: "AR-2026-007",
      projectTitle: "Ortigas BPO Tower 18-Floor Cat6A Cabling Labor",
      client: "GlobalDesk BPO Solutions",
      endUser: "GlobalDesk PH Operations",
      projectSite: "Ortigas Center, Pasig City",
      poNo: "PO-2026-4220",
      poAmount: 14500000,
      poDate: "2026-05-01",
      dpAmount: 4350000,
      dpDate: "2026-05-12",
      dpSiNo: "SI-2026-0210",
      dpSiDate: "2026-05-10",
      pbs: makeEmptyPBs({
        1: { amount: 2900000, date: "2026-07-04", siNo: "SI-2026-0244", siDate: "2026-07-02" },
        2: { amount: 2900000, date: "2026-09-10", siNo: "SI-2026-0315", siDate: "2026-09-08" }
      }),
      finalAmount: 0,
      finalDate: "",
      finalSiNo: "",
      finalSiDate: "",
      ewt2307: 203000,
      terms: "30% DP, 60% Monthly Progress Billing, 10% Fluke Sign-off",
      tpcCost: 9850000
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
        if (Array.isArray(parsed) && parsed.length > 0) {
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
      btnSaveDrawer: document.getElementById("ar-btn-save-drawer"),
      btnDeleteDrawer: document.getElementById("ar-btn-delete-drawer")
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
        <th class="ar-sub-pb text-right">% of PO</th>
        <th class="ar-sub-pb">PB${i} Date</th>
        <th class="ar-sub-pb">SI #</th>
        <th class="ar-sub-pb">SI Date</th>`;
    }

    const theadHTML = `
      <thead>
        <tr class="ar-group-row">
          <th colspan="7" class="ar-grp-navy">Project &amp; Purchase Order Details</th>
          <th colspan="5" class="ar-grp-dp">Down Payment</th>
          ${pbHeadersTop}
          <th colspan="5" class="ar-grp-final">Final Payment</th>
          <th colspan="7" class="ar-grp-summary">Receivables, 2307 Tax &amp; Cost Summary</th>
        </tr>
        <tr class="ar-col-row">
          <th class="ar-sub-navy ar-sticky-1">Project Title</th>
          <th class="ar-sub-navy ar-sticky-2">Client</th>
          <th class="ar-sub-navy">End User</th>
          <th class="ar-sub-navy">Project Site</th>
          <th class="ar-sub-navy">P.O#</th>
          <th class="ar-sub-navy text-right">P.O Amount</th>
          <th class="ar-sub-navy">P.O Date</th>

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
              <div><span>P.O Amount</span><strong>${fmtMoney(m.po, true)}</strong></div>
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
              <span class="ar-edit-hint">Edit AR &rarr;</span>
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

      <!-- GROUP 1: PROJECT & P.O INFO (DEEP NAVY) -->
      <div class="ar-form-section sec-navy">
        <h3>1. Project &amp; P.O Details</h3>
        <div class="ar-form-grid">
          <div class="form-field full-span">
            <label for="ar-f-title">Project Title *</label>
            <input type="text" id="ar-f-title" value="${esc(d.projectTitle)}" placeholder="e.g., Supply &amp; installation of CCTV Cameras (24units)" />
          </div>
          <div class="form-field">
            <label for="ar-f-client">Client *</label>
            <input type="text" id="ar-f-client" value="${esc(d.client)}" placeholder="e.g., ABC Company" />
          </div>
          <div class="form-field">
            <label for="ar-f-enduser">End User</label>
            <input type="text" id="ar-f-enduser" value="${esc(d.endUser)}" placeholder="e.g., Jaquar" />
          </div>
          <div class="form-field">
            <label for="ar-f-site">Project Site</label>
            <input type="text" id="ar-f-site" value="${esc(d.projectSite)}" placeholder="e.g., Makati" />
          </div>
          <div class="form-field">
            <label for="ar-f-pono">P.O#</label>
            <input type="text" id="ar-f-pono" value="${esc(d.poNo)}" placeholder="e.g., PO-2026-1001" />
          </div>
          <div class="form-field">
            <label for="ar-f-poamt">P.O Amount (&#8369;)</label>
            <input type="number" id="ar-f-poamt" step="0.01" min="0" value="${d.poAmount || ""}" placeholder="100000.00" />
          </div>
          <div class="form-field">
            <label for="ar-f-podate">P.O Date</label>
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
    if (!d.projectTitle.trim() || !d.client.trim()) {
      toast("Please enter both Project Title and Client.");
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
    toast(`Deleted AR record ${rec.id}.`);
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
      "Project Title", "Client", "End User", "Project Site", "P.O#", "P.O Amount", "P.O Date",
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

  function resetDemoAR() {
    localStorage.removeItem(AR_STORAGE_KEY);
    arState.records = structuredClone(INITIAL_AR_RECORDS);
    arState.search = "";
    arState.remarksFilter = "all";
    if (dom.searchInput) dom.searchInput.value = "";
    renderAR();
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
      const row = e.target.closest("[data-ar-open]");
      if (row) openARDrawer(row.getAttribute("data-ar-open"));
    };
    dom.tableEl.addEventListener("click", openHandler);
    dom.mobileCards.addEventListener("click", openHandler);

    dom.btnCloseDrawer.addEventListener("click", closeARDrawer);
    dom.drawerBackdrop.addEventListener("click", closeARDrawer);
    dom.btnSaveDrawer.addEventListener("click", saveARDrawer);
    dom.btnDeleteDrawer.addEventListener("click", deleteARRecord);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dom.drawer.classList.contains("is-open")) {
        closeARDrawer();
      }
    });

    renderAR();
  }

  return { init, renderAR, openARDrawer, resetDemoAR };
})();
