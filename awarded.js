/* ==========================================================================
   RGE Project Tracker — Project Awarded Module (Unified Sync + AR Bridge)
   Mirrors the AR Ledger visual grammar:
     1. Top 4 KPI Summary Cards (Awarded Count, P.O Value, Working Budget & Margin, Avg Accomplishment)
     2. Color-Coded Grouped Master Table (Project Info | Commercial | Schedule | Execution) + Mobile Cards
     3. 3-Section Slide-Over Drawer with Auto-Calculated Margin, Duration, Variance & "Open in AR Ledger" Bridge
   ========================================================================== */

window.RGE_AWARDED_MODULE = (() => {
  const EXECUTION_STATUSES = [
    { id: "Pending Mobilization / TBA", short: "Pending / TBA", cls: "aw-st-tba" },
    { id: "Mobilizing", short: "Mobilizing", cls: "aw-st-mob" },
    { id: "On-going", short: "On-going", cls: "aw-st-ongoing" },
    { id: "On Hold", short: "On Hold", cls: "aw-st-hold" },
    { id: "Completed", short: "Completed", cls: "aw-st-completed" }
  ];

  const TURNOVER_STATUSES = ["Pending", "For Punch-listing", "UAT Signed", "COC Issued"];

  const awState = {
    search: "",
    execFilter: "all",
    trackFilter: "all",
    editingProjectId: null,
    isNew: false,
    draft: null
  };

  let hostAPI = null; // Injected by app.js: { getProjects, saveAndRender, switchMainTab, colById }
  let dom = {};

  function cacheDOM() {
    dom = {
      tabBadge: document.getElementById("tab-badge-awarded"),
      kpiCount: document.getElementById("aw-kpi-count"),
      kpiCountSub: document.getElementById("aw-kpi-count-sub"),
      kpiPo: document.getElementById("aw-kpi-po"),
      kpiPoSub: document.getElementById("aw-kpi-po-sub"),
      kpiBudget: document.getElementById("aw-kpi-budget"),
      kpiMarginSub: document.getElementById("aw-kpi-margin-sub"),
      kpiAccomp: document.getElementById("aw-kpi-accomp"),
      kpiSchedSub: document.getElementById("aw-kpi-sched-sub"),
      searchInput: document.getElementById("aw-search-input"),
      execPills: document.getElementById("aw-exec-pills"),
      trackSelect: document.getElementById("aw-track-filter"),
      btnExportCsv: document.getElementById("aw-btn-export-csv"),
      btnAddAwarded: document.getElementById("aw-btn-add"),
      tableBody: document.getElementById("aw-table-body"),
      mobileCards: document.getElementById("aw-mobile-cards"),
      emptyState: document.getElementById("aw-empty-state"),
      // Slide-Over Drawer
      drawerBackdrop: document.getElementById("aw-drawer-backdrop"),
      drawer: document.getElementById("aw-drawer"),
      drawerCode: document.getElementById("aw-drawer-code"),
      drawerTitle: document.getElementById("aw-drawer-title"),
      drawerBody: document.getElementById("aw-drawer-body"),
      btnCloseDrawer: document.getElementById("aw-btn-close-drawer"),
      btnOpenAR: document.getElementById("aw-btn-open-ar"),
      btnSaveDrawer: document.getElementById("aw-btn-save-drawer")
    };
  }

  /* ========================================================================
     UNIFIED DATA NORMALIZATION & AUTO-CALCULATIONS
     ======================================================================== */
  function mapBoardStatusToExec(status) {
    if (status === "Project completed") return "Completed";
    if (status === "On-going project") return "On-going";
    if (status === "Hold") return "On Hold";
    if (status === "Project awarded") return "Pending Mobilization / TBA";
    return "Pending Mobilization / TBA";
  }

  function mapExecToBoardStatus(execStatus) {
    if (execStatus === "Completed") return "Project completed";
    if (execStatus === "On-going" || execStatus === "Mobilizing") return "On-going project";
    if (execStatus === "On Hold") return "Hold";
    return "Project awarded";
  }

  function ensureAwardedFields(p) {
    const poAmount = Number(p.value) || 0;
    const workingBudget =
      p.workingBudget !== undefined && p.workingBudget !== null && p.workingBudget !== ""
        ? Number(p.workingBudget)
        : Math.round(poAmount * 0.72);
    const execStatus = p.executionStatus || mapBoardStatusToExec(p.status);
    const turnoverStatus = p.turnoverStatus || (execStatus === "Completed" ? "COC Issued" : "Pending");
    const proposalNo = p.proposalNo || `PROP-${(p.id || "000").replace("RGE-TRK-", "2026-")}`;
    const poDate = p.poDate || "2026-08-15";
    const proposalDate = p.proposalDate || "2026-07-28";
    const mobilizationDate = p.mobilizationDate || (execStatus === "Pending Mobilization / TBA" ? "" : poDate);
    const implementationDate = p.implementationDate || (execStatus === "Pending Mobilization / TBA" ? "" : poDate);
    const targetDate = p.dueDate || "";
    const actualCompletionDate = p.actualCompletionDate || (execStatus === "Completed" ? targetDate : "");

    return {
      ...p,
      endUser: p.endUser || p.client,
      proposalNo,
      proposalDate,
      poDate,
      workingBudget,
      executionStatus: execStatus,
      turnoverStatus,
      mobilizationDate,
      implementationDate,
      actualCompletionDate,
      turnoverNotes: p.turnoverNotes !== undefined ? p.turnoverNotes : p.notes || ""
    };
  }

  function computeAwardedMetrics(proj) {
    const p = ensureAwardedFields(proj);
    const po = Number(p.value) || 0;
    const budget = Number(p.workingBudget) || 0;
    const margin = po - budget;
    const marginPct = po > 0 ? (margin / po) * 100 : 0;

    // Auto-calculated Duration (Days) between Mobilization/Implementation start and Target Completion
    let durationDays = null;
    const startStr = p.mobilizationDate || p.implementationDate || p.poDate;
    if (startStr && p.dueDate) {
      const d1 = new Date(startStr);
      const d2 = new Date(p.dueDate);
      if (!Number.isNaN(d1.getTime()) && !Number.isNaN(d2.getTime())) {
        durationDays = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      }
    }

    // Schedule Variance Calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let varianceLabel = "TBA";
    let varianceClass = "aw-var-tba";
    let isDelayed = false;

    if (p.dueDate) {
      const target = new Date(p.dueDate);
      target.setHours(0, 0, 0, 0);
      if (p.executionStatus === "Completed" && p.actualCompletionDate) {
        const actual = new Date(p.actualCompletionDate);
        actual.setHours(0, 0, 0, 0);
        const diff = Math.round((actual - target) / (1000 * 60 * 60 * 24));
        if (diff <= 0) {
          varianceLabel = diff === 0 ? "On Time" : `${Math.abs(diff)}d Early`;
          varianceClass = "aw-var-ontrack";
        } else {
          varianceLabel = `+${diff}d Late`;
          varianceClass = "aw-var-late";
          isDelayed = true;
        }
      } else if (p.executionStatus === "On Hold") {
        varianceLabel = "Paused";
        varianceClass = "aw-var-tba";
      } else {
        const diff = Math.round((today - target) / (1000 * 60 * 60 * 24));
        if (diff > 0) {
          varianceLabel = `+${diff}d Overdue`;
          varianceClass = "aw-var-late";
          isDelayed = true;
        } else {
          varianceLabel = "On Track";
          varianceClass = "aw-var-ontrack";
        }
      }
    }

    let marginClass = "aw-margin-good";
    if (marginPct < 15) marginClass = "aw-margin-low";
    else if (marginPct < 24) marginClass = "aw-margin-mid";

    const stObj = EXECUTION_STATUSES.find((s) => s.id === p.executionStatus) || EXECUTION_STATUSES[0];

    return {
      p,
      po,
      budget,
      margin,
      marginPct,
      marginClass,
      durationDays,
      varianceLabel,
      varianceClass,
      isDelayed,
      stObj
    };
  }

  /* Auto-populate on Award: Any unified project past "Survey" automatically appears here! */
  function getAwardedProjects() {
    if (!hostAPI) return [];
    return hostAPI
      .getProjects()
      .filter((p) => p.status !== "Survey")
      .map(ensureAwardedFields);
  }

  function getFilteredAwarded() {
    const q = awState.search.trim().toLowerCase();
    return getAwardedProjects().filter((p) => {
      if (awState.execFilter !== "all" && p.executionStatus !== awState.execFilter) return false;
      if (awState.trackFilter !== "all" && p.column !== awState.trackFilter) return false;
      if (q) {
        const hay = `${p.id} ${p.name} ${p.client} ${p.endUser} ${p.location} ${p.po} ${p.proposalNo} ${p.pm} ${p.executionStatus}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function fmtMoney(val, compact = false) {
    const n = Number(val) || 0;
    if (compact) {
      if (n >= 1e9) return `₱ ${(n / 1e9).toFixed(2)}B`;
      if (n >= 1e6) return `₱ ${(n / 1e6).toFixed(2)}M`;
      if (n >= 1e3) return `₱ ${(n / 1e3).toFixed(0)}K`;
    }
    return `₱ ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
     RENDERERS (4 KPI CARDS + GROUPED MASTER TABLE + MOBILE CARDS)
     ======================================================================== */
  function render() {
    if (!dom.tableBody || !hostAPI) return;
    const allAwarded = getAwardedProjects();
    const list = getFilteredAwarded();
    const colById = hostAPI.colById;

    if (dom.tabBadge) dom.tabBadge.textContent = String(allAwarded.length);

    // 1. Top 4 KPI Cards
    const metricsList = list.map(computeAwardedMetrics);
    const totalCount = metricsList.length;
    const ongoingCount = metricsList.filter((m) => m.p.executionStatus === "On-going" || m.p.executionStatus === "Mobilizing").length;
    const pendingCount = metricsList.filter((m) => m.p.executionStatus === "Pending Mobilization / TBA").length;
    const completedCount = metricsList.filter((m) => m.p.executionStatus === "Completed").length;

    const sumPo = metricsList.reduce((s, m) => s + m.po, 0);
    const sumBudget = metricsList.reduce((s, m) => s + m.budget, 0);
    const sumMargin = sumPo - sumBudget;
    const avgMarginPct = sumPo > 0 ? (sumMargin / sumPo) * 100 : 0;

    const activeMetrics = metricsList.filter((m) => m.p.executionStatus !== "Completed");
    const avgAccomp = totalCount ? metricsList.reduce((s, m) => s + (Number(m.p.progress) || 0), 0) / totalCount : 0;
    const delayedCount = metricsList.filter((m) => m.isDelayed).length;
    const onScheduleCount = totalCount - delayedCount;

    dom.kpiCount.textContent = totalCount;
    dom.kpiCountSub.textContent = `${ongoingCount} On-going • ${pendingCount} Pending / TBA • ${completedCount} Done`;
    dom.kpiPo.textContent = fmtMoney(sumPo, true);
    dom.kpiPoSub.textContent = `Projected Margin: ${fmtMoney(sumMargin, true)}`;
    dom.kpiBudget.textContent = fmtMoney(sumBudget, true);
    dom.kpiMarginSub.textContent = `Projected Gross Margin: ${avgMarginPct.toFixed(1)}%`;
    dom.kpiAccomp.textContent = `${avgAccomp.toFixed(1)}%`;
    dom.kpiSchedSub.textContent = `${onScheduleCount} on schedule • ${delayedCount} delayed (${activeMetrics.length} active)`;

    if (list.length === 0) {
      dom.tableBody.innerHTML = "";
      dom.mobileCards.innerHTML = "";
      dom.emptyState.hidden = false;
      return;
    }
    dom.emptyState.hidden = true;

    // 2. Grouped Master Table Rows
    dom.tableBody.innerHTML = metricsList
      .map((m) => {
        const p = m.p;
        const track = colById[p.column];
        return `
          <tr data-aw-open="${esc(p.id)}" tabindex="0">
            <!-- Project Info: Project & Site -->
            <td class="aw-proj-cell">
              <strong class="aw-proj-title">${esc(p.name)}</strong>
              <div class="aw-meta-pills">
                <span class="aw-track-tag" style="background:${track.accent}">${esc(track.label)}</span>
                <span class="aw-site-pill">${esc(p.location)}</span>
              </div>
              <span class="aw-sub-line">PIC: ${esc(p.pm)}</span>
            </td>

            <!-- Project Info: Client / End User -->
            <td>
              <strong style="display:block;color:var(--text-primary)">${esc(p.client)}</strong>
              <span class="aw-sub-line">End User: ${esc(p.endUser || "—")}</span>
            </td>

            <!-- Commercial: Proposal & P.O Ref -->
            <td class="mono">
              <div class="aw-ref-top"><strong>${esc(p.po || "TBA")}</strong> <span>${esc(p.poDate || "—")}</span></div>
              <div class="aw-ref-sub">${esc(p.proposalNo)} &bull; ${esc(p.proposalDate || "—")}</div>
            </td>

            <!-- Commercial: Budget & Margin -->
            <td class="mono">
              <div class="aw-budget-line">
                <span class="aw-po-val">${fmtMoney(m.po, true)}</span>
                <span class="aw-margin-pill ${m.marginClass}">${m.marginPct.toFixed(1)}%</span>
              </div>
              <div class="aw-ref-sub">Budget: ${fmtMoney(m.budget, true)}</div>
            </td>

            <!-- Schedule: Mob. / Impl. Dates -->
            <td class="mono nowrap">
              <div class="aw-date-pair">
                <span>Mob: <strong>${esc(p.mobilizationDate || "TBA")}</strong></span>
                <span>Impl: <strong>${esc(p.implementationDate || "TBA")}</strong></span>
              </div>
              ${m.durationDays !== null ? `<span class="aw-dur-chip">${m.durationDays} days</span>` : ""}
            </td>

            <!-- Schedule: Target vs. Actual -->
            <td class="mono nowrap">
              <div class="aw-date-pair">
                <span>Target: <strong>${esc(p.dueDate || "TBA")}</strong></span>
                <span>Actual: <strong>${esc(p.actualCompletionDate || "—")}</strong></span>
              </div>
              <span class="aw-var-pill ${m.varianceClass}">${esc(m.varianceLabel)}</span>
            </td>

            <!-- Execution: Accomplishment -->
            <td style="min-width:118px">
              <div class="card-progress-meta">
                <span>${p.progress}%</span>
                <span style="font-size:0.68rem;color:var(--text-muted)">${esc(p.turnoverStatus)}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${p.progress === 100 ? "is-complete" : ""}" style="width:${p.progress}%"></div>
              </div>
            </td>

            <!-- Execution: Status -->
            <td>
              <span class="aw-status-pill ${m.stObj.cls}">${esc(m.stObj.short)}</span>
            </td>
          </tr>`;
      })
      .join("");

    // 3. Mobile Cards (< 768px)
    dom.mobileCards.innerHTML = metricsList
      .map((m) => {
        const p = m.p;
        const track = colById[p.column];
        return `
          <article class="aw-mob-card" data-aw-open="${esc(p.id)}" tabindex="0">
            <div class="ar-mob-top">
              <span class="aw-track-tag" style="background:${track.accent}">${esc(track.label)}</span>
              <span class="aw-status-pill ${m.stObj.cls}">${esc(m.stObj.short)}</span>
            </div>
            <h3 class="ar-mob-title">${esc(p.name)}</h3>
            <p class="ar-mob-sub"><strong>${esc(p.client)}</strong> &bull; End User: ${esc(p.endUser)} &bull; ${esc(p.location)}</p>

            <div class="ar-mob-metrics">
              <div><span>P.O Amount</span><strong>${fmtMoney(m.po, true)}</strong></div>
              <div><span>Working Budget</span><strong>${fmtMoney(m.budget, true)}</strong></div>
              <div><span>Margin</span><strong class="${m.marginClass}-text">${m.marginPct.toFixed(1)}%</strong></div>
            </div>

            <div class="aw-mob-dates mono">
              <span>PO: ${esc(p.po || "TBA")}</span>
              <span>Target: ${esc(p.dueDate || "TBA")}</span>
              <span class="aw-var-pill ${m.varianceClass}">${esc(m.varianceLabel)}</span>
            </div>

            <div>
              <div class="card-progress-meta">
                <span>Accomplishment: ${p.progress}%</span>
                <span>PIC: ${esc(p.pm.replace("Engr. ", ""))}</span>
              </div>
              <div class="progress-track"><div class="progress-fill ${p.progress === 100 ? "is-complete" : ""}" style="width:${p.progress}%"></div></div>
            </div>
          </article>`;
      })
      .join("");
  }

  /* ========================================================================
     SLIDE-OVER DRAWER (3 SECTIONS + AUTO MARGIN/DURATION + AR LEDGER BRIDGE)
     ======================================================================== */
  function openDrawer(projectId = null) {
    awState.isNew = !projectId;
    awState.editingProjectId = projectId;

    if (projectId) {
      const found = hostAPI.getProjects().find((x) => x.id === projectId);
      if (!found) return;
      awState.draft = ensureAwardedFields(structuredClone(found));
      dom.drawerCode.textContent = `${awState.draft.id} • PROJECT AWARDED DOSSIER`;
      dom.drawerTitle.textContent = awState.draft.name;
      dom.btnOpenAR.hidden = false;
    } else {
      const nextNum = String(hostAPI.getProjects().length + 1).padStart(3, "0");
      const todayISO = new Date().toISOString().slice(0, 10);
      awState.draft = {
        id: `RGE-TRK-${nextNum}`,
        name: "",
        column: "supply-install",
        status: "Project awarded",
        priority: "Normal",
        client: "",
        endUser: "",
        location: "",
        pm: "",
        proposalNo: `PROP-2026-${nextNum}`,
        proposalDate: todayISO,
        po: "",
        poDate: todayISO,
        value: 0,
        workingBudget: 0,
        billed: 0,
        executionStatus: "Pending Mobilization / TBA",
        turnoverStatus: "Pending",
        mobilizationDate: "",
        implementationDate: "",
        dueDate: "",
        actualCompletionDate: "",
        progress: 10,
        notes: "",
        turnoverNotes: "",
        tasks: [
          { text: "P.O & NTP sign-off", done: true },
          { text: "Working budget & mobilization prep", done: false },
          { text: "Site implementation & testing", done: false },
          { text: "Client UAT & COC turnover", done: false }
        ]
      };
      dom.drawerCode.textContent = `${awState.draft.id} • NEW AWARDED PROJECT`;
      dom.drawerTitle.textContent = "Register Project Awarded";
      dom.btnOpenAR.hidden = true;
    }

    renderDrawerForm();
    dom.drawerBackdrop.classList.add("is-open");
    dom.drawer.classList.add("is-open");
    dom.drawerBackdrop.setAttribute("aria-hidden", "false");
    dom.drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function renderDrawerForm() {
    const d = awState.draft;
    const m = computeAwardedMetrics(d);
    const trackOptions = Object.values(hostAPI.colById)
      .map((c) => `<option value="${c.id}" ${c.id === d.column ? "selected" : ""}>${esc(c.label)}</option>`)
      .join("");
    const execOptions = EXECUTION_STATUSES.map(
      (s) => `<option value="${esc(s.id)}" ${s.id === d.executionStatus ? "selected" : ""}>${esc(s.id)}</option>`
    ).join("");
    const turnoverOptions = TURNOVER_STATUSES.map(
      (t) => `<option value="${esc(t)}" ${t === d.turnoverStatus ? "selected" : ""}>${esc(t)}</option>`
    ).join("");

    dom.drawerBody.innerHTML = `
      <!-- Auto-Calculated Executive Telemetry Banner -->
      <div class="ar-live-summary">
        <div class="ar-live-box highlight">
          <span>Est. Gross Margin (Auto)</span>
          <strong id="aw-live-margin">${fmtMoney(m.margin)} (${m.marginPct.toFixed(1)}%)</strong>
        </div>
        <div class="ar-live-box">
          <span>Project Duration (Auto)</span>
          <strong id="aw-live-duration">${m.durationDays !== null ? `${m.durationDays} Days` : "Set Mob & Target Dates"}</strong>
        </div>
        <div class="ar-live-box">
          <span>Schedule Variance</span>
          <div style="margin-top:0.2rem"><span id="aw-live-var" class="aw-var-pill ${m.varianceClass}">${esc(m.varianceLabel)}</span></div>
        </div>
        <div class="ar-live-box">
          <span>Accomplishment</span>
          <strong id="aw-live-prog">${d.progress}%</strong>
        </div>
      </div>

      <!-- SECTION 1: PROJECT & STAKEHOLDERS -->
      <div class="ar-form-section sec-navy">
        <h3>1. Project &amp; Stakeholders</h3>
        <div class="ar-form-grid">
          <div class="form-field full-span">
            <label for="aw-f-name">Project Title *</label>
            <input type="text" id="aw-f-name" value="${esc(d.name)}" placeholder="e.g., Supply &amp; Installation of CCTV Cameras (24 units)" />
          </div>
          <div class="form-field">
            <label for="aw-f-track">Service Track *</label>
            <select id="aw-f-track" class="select-control">${trackOptions}</select>
          </div>
          <div class="form-field">
            <label for="aw-f-pm">Project Engineer / PIC *</label>
            <input type="text" id="aw-f-pm" value="${esc(d.pm)}" placeholder="e.g., Engr. Clarissa Bautista" />
          </div>
          <div class="form-field">
            <label for="aw-f-client">Client *</label>
            <input type="text" id="aw-f-client" value="${esc(d.client)}" placeholder="e.g., ABC Company" />
          </div>
          <div class="form-field">
            <label for="aw-f-enduser">End User</label>
            <input type="text" id="aw-f-enduser" value="${esc(d.endUser)}" placeholder="e.g., Jaguar" />
          </div>
          <div class="form-field full-span">
            <label for="aw-f-site">Project Site *</label>
            <input type="text" id="aw-f-site" value="${esc(d.location)}" placeholder="e.g., Makati CBD" />
          </div>
        </div>
      </div>

      <!-- SECTION 2: COMMERCIAL & COSTING -->
      <div class="ar-form-section sec-tax">
        <div class="ar-sec-head">
          <h3>2. Commercial &amp; Costing</h3>
          <span class="ar-auto-chip" id="aw-chip-margin">Margin: ${m.marginPct.toFixed(1)}%</span>
        </div>
        <div class="ar-form-grid">
          <div class="form-field">
            <label for="aw-f-propno">Proposal #</label>
            <input type="text" id="aw-f-propno" value="${esc(d.proposalNo)}" placeholder="e.g., PROP-2026-041" />
          </div>
          <div class="form-field">
            <label for="aw-f-propdate">Proposal Date</label>
            <input type="date" id="aw-f-propdate" value="${esc(d.proposalDate)}" />
          </div>
          <div class="form-field">
            <label for="aw-f-pono">P.O #</label>
            <input type="text" id="aw-f-pono" value="${esc(d.po)}" placeholder="e.g., PO-2026-4410" />
          </div>
          <div class="form-field">
            <label for="aw-f-podate">P.O Date</label>
            <input type="date" id="aw-f-podate" value="${esc(d.poDate)}" />
          </div>
          <div class="form-field">
            <label for="aw-f-poamt">P.O Amount (&#8369;)</label>
            <input type="number" id="aw-f-poamt" step="0.01" min="0" value="${d.value || ""}" placeholder="100000.00" />
          </div>
          <div class="form-field">
            <label for="aw-f-budget">Working Budget (&#8369;)</label>
            <input type="number" id="aw-f-budget" step="0.01" min="0" value="${d.workingBudget || ""}" placeholder="72000.00" />
          </div>
          <div class="form-field full-span">
            <label>Auto-Calculated Est. Gross Margin (P.O Amount &minus; Working Budget)</label>
            <div class="ar-readonly-box" id="aw-readonly-margin">${fmtMoney(m.margin)} (${m.marginPct.toFixed(1)}%)</div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: MOBILIZATION & COMPLETION -->
      <div class="ar-form-section sec-dp">
        <h3>3. Mobilization &amp; Completion</h3>
        <div class="ar-form-grid">
          <div class="form-field">
            <label for="aw-f-exec">Execution Status</label>
            <select id="aw-f-exec" class="select-control">${execOptions}</select>
          </div>
          <div class="form-field">
            <label for="aw-f-turnover">Turnover / COC Status</label>
            <select id="aw-f-turnover" class="select-control">${turnoverOptions}</select>
          </div>
          <div class="form-field">
            <label for="aw-f-mobdate">Mobilization Date</label>
            <input type="date" id="aw-f-mobdate" value="${esc(d.mobilizationDate)}" />
          </div>
          <div class="form-field">
            <label for="aw-f-impldate">Implementation Date</label>
            <input type="date" id="aw-f-impldate" value="${esc(d.implementationDate)}" />
          </div>
          <div class="form-field">
            <label for="aw-f-targetdate">Target Completion Date</label>
            <input type="date" id="aw-f-targetdate" value="${esc(d.dueDate)}" />
          </div>
          <div class="form-field">
            <label for="aw-f-actualdate">Actual Completion Date</label>
            <input type="date" id="aw-f-actualdate" value="${esc(d.actualCompletionDate)}" />
          </div>
          <div class="form-field full-span">
            <label for="aw-f-prog-num">Project Accomplishment (%)</label>
            <div class="aw-prog-sync">
              <input type="range" id="aw-f-prog-slider" min="0" max="100" step="1" value="${d.progress}" aria-label="Accomplishment percentage slider" />
              <input type="number" id="aw-f-prog-num" min="0" max="100" value="${d.progress}" style="width:76px;text-align:center" />
            </div>
          </div>
          <div class="form-field full-span">
            <label for="aw-f-notes">Turnover / COC &amp; Site Execution Notes</label>
            <textarea id="aw-f-notes" rows="2" placeholder="Mobilization permits, punch-list status, COC reference...">${esc(d.turnoverNotes)}</textarea>
          </div>
        </div>
      </div>`;

    bindDrawerInputs();
  }

  function syncDraftFromDrawer() {
    const d = awState.draft;
    d.name = document.getElementById("aw-f-name").value;
    d.column = document.getElementById("aw-f-track").value;
    d.pm = document.getElementById("aw-f-pm").value;
    d.client = document.getElementById("aw-f-client").value;
    d.endUser = document.getElementById("aw-f-enduser").value;
    d.location = document.getElementById("aw-f-site").value;

    d.proposalNo = document.getElementById("aw-f-propno").value;
    d.proposalDate = document.getElementById("aw-f-propdate").value;
    d.po = document.getElementById("aw-f-pono").value;
    d.poDate = document.getElementById("aw-f-podate").value;
    d.value = Number(document.getElementById("aw-f-poamt").value) || 0;
    d.workingBudget = Number(document.getElementById("aw-f-budget").value) || 0;

    d.executionStatus = document.getElementById("aw-f-exec").value;
    d.status = mapExecToBoardStatus(d.executionStatus);
    d.turnoverStatus = document.getElementById("aw-f-turnover").value;
    d.mobilizationDate = document.getElementById("aw-f-mobdate").value;
    d.implementationDate = document.getElementById("aw-f-impldate").value;
    d.dueDate = document.getElementById("aw-f-targetdate").value;
    d.actualCompletionDate = document.getElementById("aw-f-actualdate").value;
    d.progress = Math.min(100, Math.max(0, Number(document.getElementById("aw-f-prog-num").value) || 0));
    d.turnoverNotes = document.getElementById("aw-f-notes").value;
    d.notes = d.turnoverNotes;
  }

  function refreshLiveDrawerMetrics() {
    syncDraftFromDrawer();
    const m = computeAwardedMetrics(awState.draft);
    document.getElementById("aw-live-margin").textContent = `${fmtMoney(m.margin)} (${m.marginPct.toFixed(1)}%)`;
    document.getElementById("aw-readonly-margin").textContent = `${fmtMoney(m.margin)} (${m.marginPct.toFixed(1)}%)`;
    document.getElementById("aw-chip-margin").textContent = `Margin: ${m.marginPct.toFixed(1)}%`;
    document.getElementById("aw-live-duration").textContent = m.durationDays !== null ? `${m.durationDays} Days` : "Set Mob & Target Dates";
    document.getElementById("aw-live-prog").textContent = `${awState.draft.progress}%`;
    const varEl = document.getElementById("aw-live-var");
    varEl.textContent = m.varianceLabel;
    varEl.className = `aw-var-pill ${m.varianceClass}`;
  }

  function bindDrawerInputs() {
    const slider = document.getElementById("aw-f-prog-slider");
    const numInput = document.getElementById("aw-f-prog-num");

    slider.addEventListener("input", () => {
      numInput.value = slider.value;
      refreshLiveDrawerMetrics();
    });
    numInput.addEventListener("input", () => {
      slider.value = Math.min(100, Math.max(0, Number(numInput.value) || 0));
      refreshLiveDrawerMetrics();
    });

    dom.drawerBody.querySelectorAll("input:not(#aw-f-prog-slider):not(#aw-f-prog-num), select, textarea").forEach((inp) => {
      inp.addEventListener("input", refreshLiveDrawerMetrics);
      inp.addEventListener("change", refreshLiveDrawerMetrics);
    });
  }

  function saveDrawer() {
    syncDraftFromDrawer();
    const d = awState.draft;
    if (!d.name.trim() || !d.client.trim()) {
      toast("Please enter both Project Title and Client.");
      return;
    }

    const projects = hostAPI.getProjects();
    if (awState.isNew) {
      d.billed = Math.round(d.value * (d.progress / 100));
      projects.unshift(structuredClone(d));
      toast(`Registered awarded project ${d.id} (synced to all boards).`);
    } else {
      const idx = projects.findIndex((x) => x.id === awState.editingProjectId);
      if (idx !== -1) {
        projects[idx] = { ...projects[idx], ...structuredClone(d) };
      }
      toast(`Updated ${d.id} across Awarded, Service Tracks & Status Board.`);
    }

    hostAPI.saveAndRender();
    closeDrawer();
  }

  function closeDrawer() {
    dom.drawerBackdrop.classList.remove("is-open");
    dom.drawer.classList.remove("is-open");
    dom.drawerBackdrop.setAttribute("aria-hidden", "true");
    dom.drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    awState.editingProjectId = null;
  }

  /* Bridge to AR Ledger: Opens existing AR record by P.O # or auto-creates one with zero double entry! */
  function openInARLedger() {
    syncDraftFromDrawer();
    const d = awState.draft;
    if (!window.RGE_AR_MODULE || !window.RGE_AR_MODULE.openOrCreateFromAwarded) {
      toast("AR Ledger module not ready.");
      return;
    }
    // Persist any unsaved edits first
    if (!awState.isNew) {
      const projects = hostAPI.getProjects();
      const idx = projects.findIndex((x) => x.id === awState.editingProjectId);
      if (idx !== -1) projects[idx] = { ...projects[idx], ...structuredClone(d) };
      hostAPI.saveAndRender();
    }
    closeDrawer();
    hostAPI.switchMainTab("ar");
    window.RGE_AR_MODULE.openOrCreateFromAwarded(d);
  }

  function exportAwardedCSV() {
    const rows = getFilteredAwarded().map(computeAwardedMetrics);
    const colById = hostAPI.colById;
    const headers = [
      "Project ID", "Project Title", "Service Track", "Client", "End User", "Project Site", "PIC",
      "Proposal #", "Proposal Date", "P.O #", "P.O Date",
      "P.O Amount (PHP)", "Working Budget (PHP)", "Est. Gross Margin (PHP)", "Margin (%)",
      "Mobilization Date", "Implementation Date", "Target Completion Date", "Duration (Days)",
      "Actual Completion Date", "Schedule Variance", "Accomplishment (%)", "Execution Status", "Turnover / COC Status"
    ];

    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((m) => {
        const p = m.p;
        return [
          p.id, p.name, colById[p.column]?.label || p.column, p.client, p.endUser, p.location, p.pm,
          p.proposalNo, p.proposalDate, p.po, p.poDate,
          m.po.toFixed(2), m.budget.toFixed(2), m.margin.toFixed(2), `${m.marginPct.toFixed(2)}%`,
          p.mobilizationDate, p.implementationDate, p.dueDate, m.durationDays ?? "",
          p.actualCompletionDate, m.varianceLabel, `${p.progress}%`, p.executionStatus, p.turnoverStatus
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",");
      })
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RGE_Project_Awarded_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} Project Awarded records to CSV.`);
  }

  /* ========================================================================
     INIT & EVENT WIRING
     ======================================================================== */
  function init(api) {
    hostAPI = api;
    cacheDOM();
    if (!dom.tableBody) return;

    dom.searchInput.addEventListener("input", (e) => {
      awState.search = e.target.value;
      render();
    });

    dom.execPills.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-aw-exec]");
      if (!btn) return;
      awState.execFilter = btn.getAttribute("data-aw-exec");
      dom.execPills.querySelectorAll(".status-chip").forEach((b) => b.classList.toggle("is-active", b === btn));
      render();
    });

    dom.trackSelect.addEventListener("change", (e) => {
      awState.trackFilter = e.target.value;
      render();
    });

    dom.btnExportCsv.addEventListener("click", exportAwardedCSV);
    dom.btnAddAwarded.addEventListener("click", () => openDrawer(null));

    const openHandler = (e) => {
      const target = e.target.closest("[data-aw-open]");
      if (target) openDrawer(target.getAttribute("data-aw-open"));
    };
    dom.tableBody.addEventListener("click", openHandler);
    dom.mobileCards.addEventListener("click", openHandler);

    dom.btnCloseDrawer.addEventListener("click", closeDrawer);
    dom.drawerBackdrop.addEventListener("click", closeDrawer);
    dom.btnSaveDrawer.addEventListener("click", saveDrawer);
    dom.btnOpenAR.addEventListener("click", openInARLedger);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dom.drawer.classList.contains("is-open")) closeDrawer();
    });

    render();
  }

  return { init, render, openDrawer };
})();
