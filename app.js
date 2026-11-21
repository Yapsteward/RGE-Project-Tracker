/* ==========================================================================
   RGE Project Tracker — 3-Tab Interactive Desktop & Mobile Engine
   Tab 1: Service Tracks (Supply & Delivery, Supply only, Supply & Install, Install/Services)
   Tab 2: Project Status Board (Survey, Project awarded, On-going project, Project completed, Hold)
   Tab 3: Project Status Overview & Project Status Distribution
   ========================================================================== */

(() => {
  const { COLUMNS, STATUS_COLUMNS, INITIAL_PROJECTS } = window.RGE_TRACKER_DATA;

  const STORAGE_KEY = "rge_project_tracker_v3";
  const SETTINGS_KEY = "rge_project_tracker_settings_v1";
  const colById = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));
  const statusById = Object.fromEntries(STATUS_COLUMNS.map((s) => [s.id, s]));

  const state = {
    projects: loadProjects(),
    settings: loadSettings(),
    activeTab: "overview",    // 'overview' | 'tracks' | 'status' | 'ar' | 'settings'
    viewMode: "board",        // 'board' | 'table'
    mobileCol: "all",         // mobile filter for Service Tracks
    mobileStatusCol: "all",   // mobile filter for Project Status Board
    tableColFilter: "all",
    statusFilter: "all",
    priorityFilter: "all",
    search: "",
    sortBy: "due-asc",
    activeProjectId: null,
    draggedId: null,
    dragKind: null            // 'column' | 'status'
  };

  const el = {
    appShell: document.getElementById("app-shell"),
    leftSidebar: document.getElementById("left-sidebar"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
    liveSyncLabel: document.getElementById("live-sync-label"),
    boardListSwitcher: document.getElementById("board-list-switcher"),
    kpiTotalCount: document.getElementById("kpi-total-count"),
    kpiTotalSub: document.getElementById("kpi-total-sub"),
    kpiTotalValue: document.getElementById("kpi-total-value"),
    kpiBilledSub: document.getElementById("kpi-billed-sub"),
    kpiActiveCount: document.getElementById("kpi-active-count"),
    kpiAvgProgress: document.getElementById("kpi-avg-progress"),
    kpiCompletedCount: document.getElementById("kpi-completed-count"),
    kpiCompletedRate: document.getElementById("kpi-completed-rate"),
    sharedFilterToolbar: document.getElementById("shared-filter-toolbar"),
    inputSearch: document.getElementById("input-search"),
    statusFilterPills: document.getElementById("status-filter-pills"),
    selectPriorityFilter: document.getElementById("select-priority-filter"),
    selectSort: document.getElementById("select-sort"),
    // Panels
    panelTracks: document.getElementById("panel-tracks"),
    panelStatus: document.getElementById("panel-status"),
    panelOverview: document.getElementById("panel-overview"),
    panelAwarded: document.getElementById("panel-awarded"),
    panelAr: document.getElementById("panel-ar"),
    panelSettings: document.getElementById("panel-settings"),
    topKpiStrip: document.querySelector("#main-workspace > .kpi-strip"),
    // Tab 1 (4 Service Columns)
    mobileColumnTabs: document.getElementById("mobile-column-tabs"),
    kanbanBoard: document.getElementById("kanban-board"),
    // Tab 2 (5 Status Columns)
    mobileStatusTabs: document.getElementById("mobile-status-tabs"),
    statusKanbanBoard: document.getElementById("status-kanban-board"),
    // Tab 3 (Overview & Distribution)
    overviewTotalPill: document.getElementById("overview-total-pill"),
    statusOverviewGrid: document.getElementById("status-overview-grid"),
    statusDonutContainer: document.getElementById("status-donut-container"),
    statusDonutLegend: document.getElementById("status-donut-legend"),
    statusValueBars: document.getElementById("status-value-bars"),
    crossMatrixTable: document.getElementById("cross-matrix-table"),
    // Shared Table View
    masterTableSection: document.getElementById("master-table-section"),
    tableSummaryText: document.getElementById("table-summary-text"),
    tableColumnFilter: document.getElementById("table-column-filter"),
    masterTableBody: document.getElementById("master-table-body"),
    tableEmptyState: document.getElementById("table-empty-state"),
    btnModeBoard: document.getElementById("btn-mode-board"),
    btnModeTable: document.getElementById("btn-mode-table"),
    // Detail Drawer & Add Modal
    detailBackdrop: document.getElementById("detail-backdrop"),
    detailDrawer: document.getElementById("detail-drawer"),
    detailCode: document.getElementById("detail-code"),
    detailTitle: document.getElementById("detail-title"),
    detailBody: document.getElementById("detail-body"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    formAddProject: document.getElementById("form-add-project"),
    toastStack: document.getElementById("toast-stack")
  };

  /* ========================================================================
     STORAGE & FORMATTERS
     ======================================================================== */
  function loadSettings() {
    const defaults = {
      companyName: "RGE Infra & Information Technology Services",
      hqAddress: "Unit 210, Don Raul Building, #77 Kamuning Road, Quezon City",
      defaultTerms: "50% DP, 40% Progress Billing, 10% Completion"
    };
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (_) {}
    return defaults;
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (_) {}
  }

  function populateSettingsForm() {
    const s = state.settings;
    const setVal = (id, v) => { const node = document.getElementById(id); if (node) node.value = v || ""; };
    setVal("set-company-name", s.companyName);
    setVal("set-hq-address", s.hqAddress);
    setVal("set-default-terms", s.defaultTerms);
  }

  function loadProjects() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return structuredClone(INITIAL_PROJECTS);
  }

  function saveProjects() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
    } catch (_) {}
    if (window.RGE_CLOUD_SYNC) window.RGE_CLOUD_SYNC.scheduleAutoBackup();
  }

  function formatPHP(amount, compact = false) {
    if (compact) {
      if (amount >= 1e9) return `₱ ${(amount / 1e9).toFixed(2)}B`;
      if (amount >= 1e6) return `₱ ${(amount / 1e6).toFixed(2)}M`;
      if (amount >= 1e3) return `₱ ${(amount / 1e3).toFixed(0)}K`;
      return `₱ ${amount.toLocaleString("en-PH")}`;
    }
    return `₱ ${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function badgeClassForStatus(status) {
    return statusById[status]?.badgeClass || "st-Ongoing";
  }

  function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    el.toastStack.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
      t.style.transition = "opacity 0.22s ease, transform 0.22s ease";
      setTimeout(() => t.remove(), 240);
    }, 3000);
  }

  function updateClock() {
    const now = new Date();
    const str = now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    el.liveSyncLabel.textContent = `Updated ${str} • ${state.projects.length} Tracked Projects`;
  }

  /* ========================================================================
     FILTER & SORT ENGINE
     ======================================================================== */
  function getFilteredProjects(options = {}) {
    const { ignoreStatus = false } = options;
    const q = state.search.trim().toLowerCase();
    return state.projects.filter((p) => {
      if (!ignoreStatus && state.statusFilter !== "all" && p.status !== state.statusFilter) return false;
      if (state.priorityFilter !== "all" && p.priority !== state.priorityFilter) return false;
      if (q) {
        const hay = `${p.id} ${p.po} ${p.name} ${p.client} ${p.location} ${p.pm} ${p.status} ${colById[p.column]?.label || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function sortProjects(list) {
    const copy = [...list];
    switch (state.sortBy) {
      case "due-asc": return copy.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      case "value-desc": return copy.sort((a, b) => b.value - a.value);
      case "progress-desc": return copy.sort((a, b) => b.progress - a.progress);
      case "name-asc": return copy.sort((a, b) => a.name.localeCompare(b.name));
      default: return copy;
    }
  }

  /* ========================================================================
     MAIN RENDER ORCHESTRATOR
     ======================================================================== */
  function renderAll() {
    const filteredForTracks = sortProjects(getFilteredProjects());
    const filteredForStatusBoard = sortProjects(getFilteredProjects({ ignoreStatus: true }));
    const activeData = state.activeTab === "status" ? filteredForStatusBoard : state.activeTab === "overview" ? state.projects : filteredForTracks;

    renderKPIs(activeData);
    renderTab1ServiceBoard(filteredForTracks);
    renderTab2StatusBoard(filteredForStatusBoard);
    renderMasterTable(filteredForTracks);
    renderTab3OverviewAndDistribution(state.projects);
    if (window.RGE_AWARDED_MODULE) window.RGE_AWARDED_MODULE.render();
    syncTabAndViewUI();
  }

  function renderKPIs(list) {
    const count = list.length;
    const totalValue = list.reduce((s, p) => s + p.value, 0);
    const totalBilled = list.reduce((s, p) => s + p.billed, 0);
    const billedPct = totalValue ? ((totalBilled / totalValue) * 100).toFixed(1) : "0.0";
    const completed = list.filter((p) => p.status === "Project completed").length;
    const ongoing = list.filter((p) => p.status === "On-going project").length;
    const hold = list.filter((p) => p.status === "Hold").length;
    const avgProg = count ? (list.reduce((s, p) => s + p.progress, 0) / count).toFixed(0) : "0";
    const compRate = count ? ((completed / count) * 100).toFixed(1) : "0.0";

    el.kpiTotalCount.textContent = count;
    el.kpiTotalSub.textContent = `${hold} on Hold • ${state.projects.length} total saved`;
    el.kpiTotalValue.textContent = formatPHP(totalValue, true);
    el.kpiBilledSub.textContent = `${formatPHP(totalBilled, true)} billed (${billedPct}%)`;
    el.kpiActiveCount.textContent = ongoing;
    el.kpiAvgProgress.textContent = `${avgProg}% average completion`;
    el.kpiCompletedCount.textContent = completed;
    el.kpiCompletedRate.textContent = `${compRate}% completion rate`;
  }

  /* ========================================================================
     TAB 1: SERVICE TRACKS (4 COLUMNS)
     ======================================================================== */
  function renderTab1ServiceBoard(filtered) {
    // Mobile tabs
    const allTab = `
      <button type="button" class="mob-col-tab ${state.mobileCol === "all" ? "is-active" : ""}" data-mob-col="all">
        <span>All Tracks</span><span class="tab-count">${filtered.length}</span>
      </button>`;
    const colTabs = COLUMNS.map((col) => {
      const cnt = filtered.filter((p) => p.column === col.id).length;
      return `
        <button type="button" class="mob-col-tab ${state.mobileCol === col.id ? "is-active" : ""}" data-mob-col="${col.id}">
          <span class="tab-dot" style="background:${col.accent}"></span>
          <span>${esc(col.label)}</span>
          <span class="tab-count">${cnt}</span>
        </button>`;
    }).join("");
    el.mobileColumnTabs.innerHTML = allTab + colTabs;

    // 4-Column Board
    el.kanbanBoard.classList.toggle("show-all-cols", state.mobileCol === "all");
    el.kanbanBoard.innerHTML = COLUMNS.map((col) => {
      const items = filtered.filter((p) => p.column === col.id);
      const colVal = items.reduce((s, p) => s + p.value, 0);
      const hiddenOnMobile = state.mobileCol !== "all" && state.mobileCol !== col.id;
      const cardsHTML = items.length
        ? items.map((p) => renderCard(p, "tracks")).join("")
        : `<div class="col-empty">No projects in <strong>${esc(col.label)}</strong>.<br/>Drag a card here or click <strong>+</strong>.</div>`;

      return `
        <section class="kanban-column ${hiddenOnMobile ? "is-hidden-mobile" : ""}"
          data-drop-kind="column" data-drop-target="${col.id}"
          style="--col-accent: ${col.accent}" aria-label="${esc(col.label)}">
          <div class="col-header">
            <div class="col-header-top">
              <div class="col-title-wrap">
                <span class="col-icon" aria-hidden="true">${col.icon}</span>
                <h2 class="col-title">${esc(col.label)}</h2>
              </div>
              <button type="button" class="col-add-btn" data-quick-add-track="${col.id}" title="Add to ${esc(col.label)}" aria-label="Add project to ${esc(col.label)}">+</button>
            </div>
            <div class="col-metrics-row">
              <span class="col-count-badge">${items.length} Project${items.length === 1 ? "" : "s"}</span>
              <span class="col-total-val">${formatPHP(colVal, true)}</span>
            </div>
          </div>
          <div class="col-body">${cardsHTML}</div>
        </section>`;
    }).join("");

    bindDragAndDrop(el.kanbanBoard, "column");
  }

  /* ========================================================================
     TAB 2: PROJECT STATUS BOARD (5 COLUMNS)
       Survey | Project awarded | On-going project | Project completed | Hold
     ======================================================================== */
  function renderTab2StatusBoard(filtered) {
    // Mobile Status Column Switcher Tabs
    const allTab = `
      <button type="button" class="mob-col-tab ${state.mobileStatusCol === "all" ? "is-active" : ""}" data-mob-status="all">
        <span>All Status</span><span class="tab-count">${filtered.length}</span>
      </button>`;
    const stTabs = STATUS_COLUMNS.map((st) => {
      const cnt = filtered.filter((p) => p.status === st.id).length;
      return `
        <button type="button" class="mob-col-tab ${state.mobileStatusCol === st.id ? "is-active" : ""}" data-mob-status="${esc(st.id)}">
          <span class="tab-dot" style="background:${st.accent}"></span>
          <span>${esc(st.label)}</span>
          <span class="tab-count">${cnt}</span>
        </button>`;
    }).join("");
    el.mobileStatusTabs.innerHTML = allTab + stTabs;

    // 5-Column Status Board
    el.statusKanbanBoard.classList.toggle("show-all-cols", state.mobileStatusCol === "all");
    el.statusKanbanBoard.innerHTML = STATUS_COLUMNS.map((st) => {
      const items = filtered.filter((p) => p.status === st.id);
      const stVal = items.reduce((s, p) => s + p.value, 0);
      const hiddenOnMobile = state.mobileStatusCol !== "all" && state.mobileStatusCol !== st.id;
      const cardsHTML = items.length
        ? items.map((p) => renderCard(p, "status")).join("")
        : `<div class="col-empty">No projects in <strong>${esc(st.label)}</strong>.<br/>Drag a card here or click <strong>+</strong>.</div>`;

      return `
        <section class="kanban-column ${hiddenOnMobile ? "is-hidden-mobile" : ""}"
          data-drop-kind="status" data-drop-target="${esc(st.id)}"
          style="--col-accent: ${st.accent}" aria-label="${esc(st.label)}">
          <div class="col-header">
            <div class="col-header-top">
              <div class="col-title-wrap">
                <span class="col-icon" aria-hidden="true">${st.icon}</span>
                <h2 class="col-title">${esc(st.label)}</h2>
              </div>
              <button type="button" class="col-add-btn" data-quick-add-status="${esc(st.id)}" title="Add project under ${esc(st.label)}" aria-label="Add project under ${esc(st.label)}">+</button>
            </div>
            <div class="col-metrics-row">
              <span class="col-count-badge">${items.length} Project${items.length === 1 ? "" : "s"}</span>
              <span class="col-total-val">${formatPHP(stVal, true)}</span>
            </div>
          </div>
          <div class="col-body">${cardsHTML}</div>
        </section>`;
    }).join("");

    bindDragAndDrop(el.statusKanbanBoard, "status");
  }

  function renderCard(p, boardContext) {
    const doneTasks = (p.tasks || []).filter((t) => t.done).length;
    const totalTasks = (p.tasks || []).length;
    const col = colById[p.column];

    // On Service Tracks board show Status badge; on Status Board show Service Track badge!
    const topRightBadge =
      boardContext === "tracks"
        ? `<span class="status-badge ${badgeClassForStatus(p.status)}">${esc(p.status)}</span>`
        : `<span class="track-chip" style="background:${col.accent}">${esc(col.label)}</span>`;

    return `
      <article class="project-card" draggable="true" data-project-id="${esc(p.id)}" tabindex="0">
        <div class="card-top-row">
          <span class="card-code">${esc(p.id)}</span>
          ${topRightBadge}
        </div>
        <h3 class="card-title">${esc(p.name)}</h3>
        <div class="card-client-row">
          <strong>${esc(p.client)}</strong>
          <span class="card-location">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${esc(p.location)}
          </span>
        </div>
        <div class="card-progress-block">
          <div class="card-progress-meta">
            <span>${p.progress}% ${totalTasks ? `(${doneTasks}/${totalTasks})` : ""}</span>
            <span>${esc(p.pm.replace("Engr. ", ""))}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${p.progress === 100 ? "is-complete" : ""}" style="width:${p.progress}%"></div>
          </div>
        </div>
        <div class="card-footer-row">
          <span class="card-cost">${formatPHP(p.value, true)}</span>
          <div class="card-meta-right">
            <span class="priority-dot prio-${esc(p.priority)}">${esc(p.priority)}</span>
            <span class="card-due">${esc(p.dueDate)}</span>
          </div>
        </div>
      </article>`;
  }

  /* ========================================================================
     TAB 3: PROJECT STATUS OVERVIEW & PROJECT STATUS DISTRIBUTION
     ======================================================================== */
  function renderTab3OverviewAndDistribution(allProjects) {
    const totalCount = allProjects.length;
    const totalValue = allProjects.reduce((s, p) => s + p.value, 0);
    el.overviewTotalPill.textContent = `${totalCount} Projects • ${formatPHP(totalValue, true)}`;

    const stats = STATUS_COLUMNS.map((st) => {
      const items = allProjects.filter((p) => p.status === st.id);
      const count = items.length;
      const pct = totalCount ? (count / totalCount) * 100 : 0;
      const val = items.reduce((s, p) => s + p.value, 0);
      const billed = items.reduce((s, p) => s + p.billed, 0);
      const avgProg = count ? Math.round(items.reduce((s, p) => s + p.progress, 0) / count) : 0;
      return { st, count, pct, val, billed, avgProg };
    });

    // 1. Project Status Overview Cards (clickable -> jumps to Status Board filtered on mobile/desktop!)
    el.statusOverviewGrid.innerHTML = stats
      .map(
        ({ st, count, pct, val, billed, avgProg }) => `
      <button type="button" class="ov-status-card" data-jump-status="${esc(st.id)}"
        style="--st-accent: ${st.accent}; --st-soft: ${st.softBg}">
        <div class="ov-top">
          <span class="ov-title">${esc(st.label)}</span>
          <span class="ov-icon" aria-hidden="true">${st.icon}</span>
        </div>
        <div class="ov-count-row">
          <span class="ov-count">${count}</span>
          <span class="ov-pct">${pct.toFixed(1)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${avgProg}%; background:${st.accent}"></div>
        </div>
        <div class="ov-financials">
          <span>Value: <strong>${formatPHP(val, true)}</strong></span>
          <span>Billed: ${formatPHP(billed, true)} &bull; Avg ${avgProg}%</span>
        </div>
      </button>`
      )
      .join("");

    // 2. Interactive SVG Donut Chart (Project Status Distribution)
    const radius = 78;
    const circumference = 2 * Math.PI * radius;
    let cumulativePct = 0;

    const segmentsSVG = stats
      .map(({ st, count, pct }) => {
        if (count === 0) return "";
        const segLen = (pct / 100) * circumference;
        const dashArray = `${Math.max(0, segLen - 2)} ${circumference}`;
        const offset = -(cumulativePct / 100) * circumference;
        cumulativePct += pct;
        return `
          <circle class="donut-segment" cx="110" cy="110" r="${radius}"
            fill="none" stroke="${st.accent}" stroke-width="24"
            stroke-dasharray="${dashArray}" stroke-dashoffset="${offset}"
            transform="rotate(-90 110 110)"
            data-donut-label="${esc(st.label)}" data-donut-count="${count}" data-donut-pct="${pct.toFixed(1)}%"
            data-jump-status="${esc(st.id)}">
            <title>${esc(st.label)}: ${count} projects (${pct.toFixed(1)}%)</title>
          </circle>`;
      })
      .join("");

    el.statusDonutContainer.innerHTML = `
      <svg viewBox="0 0 220 220" role="img" aria-label="Project Status Distribution Donut Chart">
        <circle cx="110" cy="110" r="${radius}" fill="none" stroke="#E2E8F0" stroke-width="24" />
        ${segmentsSVG}
        <text id="donut-center-val" x="110" y="106" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="28" font-weight="800" fill="#1C305C">${totalCount}</text>
        <text id="donut-center-sub" x="110" y="126" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#64748B">Total Projects</text>
      </svg>`;

    // Hover interactivity on Donut center text
    const centerVal = el.statusDonutContainer.querySelector("#donut-center-val");
    const centerSub = el.statusDonutContainer.querySelector("#donut-center-sub");
    el.statusDonutContainer.querySelectorAll(".donut-segment").forEach((seg) => {
      seg.addEventListener("mouseenter", () => {
        centerVal.textContent = seg.getAttribute("data-donut-pct");
        centerSub.textContent = seg.getAttribute("data-donut-label");
      });
      seg.addEventListener("mouseleave", () => {
        centerVal.textContent = String(totalCount);
        centerSub.textContent = "Total Projects";
      });
    });

    // Donut Legend Rows
    el.statusDonutLegend.innerHTML = stats
      .map(
        ({ st, count, pct }) => `
      <div class="legend-row" data-jump-status="${esc(st.id)}" tabindex="0" role="button">
        <span class="legend-left">
          <i class="legend-swatch" style="background:${st.accent}"></i>
          <span>${esc(st.label)}</span>
        </span>
        <span class="legend-right">${count} (${pct.toFixed(1)}%)</span>
      </div>`
      )
      .join("");

    // 3. Contract Value & Billing Bars by Status
    const maxVal = Math.max(1, ...stats.map((s) => s.val));
    el.statusValueBars.innerHTML = stats
      .map(({ st, val, billed }) => {
        const allocPct = Math.round((val / maxVal) * 100);
        const billedWidth = Math.round((billed / maxVal) * 100);
        const billedRatio = val ? Math.round((billed / val) * 100) : 0;
        return `
          <div class="vdist-item">
            <div class="vdist-top">
              <span class="vdist-label">
                <i class="vdist-dot" style="background:${st.accent}"></i>
                ${esc(st.label)}
              </span>
              <span class="vdist-nums"><strong>${formatPHP(val, true)}</strong> &bull; ${billedRatio}% billed</span>
            </div>
            <div class="vdist-bar-bg">
              <div class="vdist-bar-alloc" style="width:${allocPct}%; background:${st.accent}"></div>
              <div class="vdist-bar-billed" style="width:${billedWidth}%; background:${st.accent}"></div>
            </div>
          </div>`;
      })
      .join("");

    // 4. Service Track x Project Status Cross-Matrix Table
    const headCells = STATUS_COLUMNS.map((st) => `<th>${esc(st.label)}</th>`).join("");
    const bodyRows = COLUMNS.map((col) => {
      const colProjects = allProjects.filter((p) => p.column === col.id);
      const colTotalVal = colProjects.reduce((s, p) => s + p.value, 0);
      const statusCells = STATUS_COLUMNS.map((st) => {
        const cellItems = colProjects.filter((p) => p.status === st.id);
        if (cellItems.length === 0) return `<td><span class="matrix-cell-zero">—</span></td>`;
        const cellVal = cellItems.reduce((s, p) => s + p.value, 0);
        return `<td><span class="matrix-cell-count">${cellItems.length}</span><span class="matrix-cell-val">${formatPHP(cellVal, true)}</span></td>`;
      }).join("");

      return `
        <tr>
          <td><span class="col-pill" style="background:${col.accent}">${esc(col.label)}</span></td>
          ${statusCells}
          <td><span class="matrix-cell-count">${colProjects.length}</span><span class="matrix-cell-val">${formatPHP(colTotalVal, true)}</span></td>
        </tr>`;
    }).join("");

    const footCells = stats
      .map((s) => `<td>${s.count}<span class="matrix-cell-val">${formatPHP(s.val, true)}</span></td>`)
      .join("");

    el.crossMatrixTable.innerHTML = `
      <thead>
        <tr>
          <th>Service Track</th>
          ${headCells}
          <th>Track Total</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr>
          <td>Grand Total</td>
          ${footCells}
          <td>${totalCount}<span class="matrix-cell-val">${formatPHP(totalValue, true)}</span></td>
        </tr>
      </tfoot>`;
  }

  /* ========================================================================
     SHARED MASTER TABLE VIEW
     ======================================================================== */
  function renderMasterTable(filtered) {
    const rows = state.tableColFilter === "all" ? filtered : filtered.filter((p) => p.column === state.tableColFilter);
    el.tableSummaryText.textContent = `Showing ${rows.length} project${rows.length === 1 ? "" : "s"} — click any row to inspect or update.`;

    if (rows.length === 0) {
      el.masterTableBody.innerHTML = "";
      el.tableEmptyState.hidden = false;
      return;
    }

    el.tableEmptyState.hidden = true;
    el.masterTableBody.innerHTML = rows
      .map((p) => {
        const col = colById[p.column];
        return `
          <tr data-project-id="${esc(p.id)}" tabindex="0">
            <td>
              <span class="card-code">${esc(p.id)}</span>
              <div style="font-size:0.74rem;color:var(--text-muted)">${esc(p.po || "—")}</div>
            </td>
            <td>
              <strong style="display:block;color:var(--text-primary)">${esc(p.name)}</strong>
              <span style="font-size:0.76rem;color:var(--text-muted)">${esc(p.client)} &bull; ${esc(p.pm)}</span>
            </td>
            <td><span class="col-pill" style="background:${col.accent}">${esc(col.label)}</span></td>
            <td>${esc(p.location)}</td>
            <td><span class="status-badge ${badgeClassForStatus(p.status)}">${esc(p.status)}</span></td>
            <td style="min-width:105px">
              <div style="font-family:var(--font-mono);font-size:0.75rem;font-weight:700;margin-bottom:0.2rem">${p.progress}%</div>
              <div class="progress-track"><div class="progress-fill ${p.progress === 100 ? "is-complete" : ""}" style="width:${p.progress}%"></div></div>
            </td>
            <td style="font-family:var(--font-mono);font-size:0.78rem;white-space:nowrap">${esc(p.dueDate)}</td>
            <td class="text-right" style="font-family:var(--font-mono);font-weight:700;white-space:nowrap">${formatPHP(p.value, true)}</td>
          </tr>`;
      })
      .join("");
  }

  /* ========================================================================
     TAB & VIEW SYNCHRONIZATION
     ======================================================================== */
  function syncTabAndViewUI() {
    const tab = state.activeTab;
    const isOverview = tab === "overview";
    const isAwarded = tab === "awarded";
    const isAR = tab === "ar";
    const isSettings = tab === "settings";
    const isBoardTab = tab === "tracks" || tab === "status";
    const isTable = isBoardTab && state.viewMode === "table";

    // Left vertical menu items + mobile bottom bar tabs
    document.querySelectorAll("[data-main-tab]").forEach((b) => {
      const active = b.getAttribute("data-main-tab") === tab;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-mob-main-tab]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-mob-main-tab") === tab);
    });

    // Show/Hide KPIs, Toolbar & Panels cleanly
    if (el.topKpiStrip) el.topKpiStrip.hidden = isAwarded || isAR || isSettings;
    el.boardListSwitcher.hidden = !isBoardTab;
    el.sharedFilterToolbar.hidden = !isBoardTab;
    el.statusFilterPills.hidden = tab === "status";

    el.panelTracks.hidden = !(tab === "tracks" && !isTable);
    el.panelStatus.hidden = !(tab === "status" && !isTable);
    el.masterTableSection.hidden = !isTable;
    el.panelOverview.hidden = !isOverview;
    if (el.panelAwarded) el.panelAwarded.hidden = !isAwarded;
    if (el.panelAr) el.panelAr.hidden = !isAR;
    if (el.panelSettings) el.panelSettings.hidden = !isSettings;

    el.btnModeBoard.classList.toggle("is-active", state.viewMode === "board");
    el.btnModeTable.classList.toggle("is-active", state.viewMode === "table");
  }

  function openMobileSidebar() {
    if (!el.leftSidebar) return;
    el.leftSidebar.classList.add("is-open");
    el.sidebarBackdrop.classList.add("is-open");
    el.btnToggleSidebar.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeMobileSidebar() {
    if (!el.leftSidebar) return;
    el.leftSidebar.classList.remove("is-open");
    el.sidebarBackdrop.classList.remove("is-open");
    el.btnToggleSidebar.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function switchMainTab(tabName) {
    state.activeTab = tabName;
    if (tabName === "overview" || tabName === "ar" || tabName === "settings") {
      state.viewMode = "board";
    }
    closeMobileSidebar();
    renderAll();
    if (tabName === "ar" && window.RGE_AR_MODULE) {
      window.RGE_AR_MODULE.renderAR();
    }
    if (tabName === "settings") {
      populateSettingsForm();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ========================================================================
     DRAG & DROP ENGINE (Works on BOTH Tab 1 Service Board & Tab 2 Status Board!)
     ======================================================================== */
  function bindDragAndDrop(boardEl, kind) {
    boardEl.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        state.draggedId = card.getAttribute("data-project-id");
        state.dragKind = kind;
        card.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", state.draggedId);
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        state.draggedId = null;
        state.dragKind = null;
        boardEl.querySelectorAll(".kanban-column").forEach((c) => c.classList.remove("is-drag-over"));
      });
    });

    boardEl.querySelectorAll("[data-drop-target]").forEach((colEl) => {
      colEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        colEl.classList.add("is-drag-over");
      });

      colEl.addEventListener("dragleave", (e) => {
        if (!colEl.contains(e.relatedTarget)) colEl.classList.remove("is-drag-over");
      });

      colEl.addEventListener("drop", (e) => {
        e.preventDefault();
        colEl.classList.remove("is-drag-over");
        const targetVal = colEl.getAttribute("data-drop-target");
        const projId = state.draggedId || e.dataTransfer.getData("text/plain");
        const proj = state.projects.find((p) => p.id === projId);
        if (!proj) return;

        if (kind === "column" && proj.column !== targetVal) {
          proj.column = targetVal;
          saveProjects();
          renderAll();
          showToast(`Moved ${proj.id} to "${colById[targetVal].label}".`);
        } else if (kind === "status" && proj.status !== targetVal) {
          proj.status = targetVal;
          if (targetVal === "Project completed") {
            proj.progress = 100;
            proj.billed = proj.value;
            (proj.tasks || []).forEach((t) => (t.done = true));
          }
          saveProjects();
          renderAll();
          showToast(`Updated ${proj.id} status to "${targetVal}".`);
        }
      });
    });
  }

  /* ========================================================================
     SLIDE-OVER DETAIL & LIVE EDITOR DRAWER
     ======================================================================== */
  function openDetail(id) {
    const proj = state.projects.find((p) => p.id === id);
    if (!proj) return;
    state.activeProjectId = id;
    renderDetailContent(proj);
    el.detailBackdrop.classList.add("is-open");
    el.detailDrawer.classList.add("is-open");
    el.detailBackdrop.setAttribute("aria-hidden", "false");
    el.detailDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function renderDetailContent(proj) {
    const billedPct = proj.value ? Math.round((proj.billed / proj.value) * 100) : 0;
    el.detailCode.textContent = `${proj.id} • ${proj.po || "NO PO"}`;
    el.detailTitle.textContent = proj.name;

    const colOptions = COLUMNS.map(
      (c) => `<option value="${c.id}" ${c.id === proj.column ? "selected" : ""}>${esc(c.label)}</option>`
    ).join("");

    const stOptions = STATUS_COLUMNS.map(
      (s) => `<option value="${esc(s.id)}" ${s.id === proj.status ? "selected" : ""}>${esc(s.label)}</option>`
    ).join("");

    const tasksHTML = (proj.tasks || [])
      .map(
        (t, i) => `
      <label class="check-item ${t.done ? "is-done" : ""}">
        <input type="checkbox" data-task-idx="${i}" ${t.done ? "checked" : ""} />
        <span>${esc(t.text)}</span>
      </label>`
      )
      .join("");

    el.detailBody.innerHTML = `
      <div class="detail-controls-box">
        <div class="detail-field">
          <label for="d-column">Service Track Column</label>
          <select id="d-column" class="select-control">${colOptions}</select>
        </div>
        <div class="detail-field">
          <label for="d-status">Project Status Column</label>
          <select id="d-status" class="select-control">${stOptions}</select>
        </div>
      </div>

      <div class="detail-kpi-pair">
        <div class="detail-stat-box">
          <div class="detail-label">Contract Value</div>
          <div class="detail-stat-val">${formatPHP(proj.value)}</div>
        </div>
        <div class="detail-stat-box">
          <div class="detail-label">Billed / Collected (${billedPct}%)</div>
          <div class="detail-stat-val">${formatPHP(proj.billed)}</div>
        </div>
      </div>

      <div>
        <div class="detail-label">Completion Progress</div>
        <div class="slider-row">
          <input type="range" id="d-progress-slider" min="0" max="100" step="5" value="${proj.progress}" aria-label="Adjust project progress" />
          <span class="slider-val" id="d-progress-text">${proj.progress}%</span>
        </div>
      </div>

      <div>
        <div class="detail-label" style="margin-bottom:0.45rem">Project Metadata</div>
        <div class="detail-info-grid">
          <div><span>Client</span><strong>${esc(proj.client)}</strong></div>
          <div><span>Project Lead / PIC</span><strong>${esc(proj.pm)}</strong></div>
          <div><span>Site Location</span><strong>${esc(proj.location)}</strong></div>
          <div><span>Target Completion</span><strong>${esc(proj.dueDate)}</strong></div>
        </div>
      </div>

      <div>
        <div class="detail-label" style="margin-bottom:0.4rem">Scope &amp; Logistics Notes</div>
        <div class="notes-box">${esc(proj.notes || "No additional notes recorded.")}</div>
      </div>

      <div>
        <div class="detail-label" style="margin-bottom:0.45rem">Deliverables &amp; Field Checklist</div>
        <div class="checklist">${tasksHTML || `<p style="font-size:0.8rem;color:var(--text-muted)">No checklist items yet.</p>`}</div>
        <div class="add-task-row">
          <input type="text" id="input-new-task" placeholder="Add deliverable or milestone..." aria-label="Add deliverable item" />
          <button type="button" class="btn btn-outline btn-sm" id="btn-add-task">Add</button>
        </div>
      </div>`;

    document.getElementById("d-column").addEventListener("change", (e) => {
      proj.column = e.target.value;
      saveProjects();
      renderAll();
      showToast(`Moved ${proj.id} to "${colById[proj.column].label}".`);
    });

    document.getElementById("d-status").addEventListener("change", (e) => {
      proj.status = e.target.value;
      if (proj.status === "Project completed") {
        proj.progress = 100;
        proj.billed = proj.value;
        (proj.tasks || []).forEach((t) => (t.done = true));
        renderDetailContent(proj);
      }
      saveProjects();
      renderAll();
      showToast(`${proj.id} moved to "${proj.status}".`);
    });

    const slider = document.getElementById("d-progress-slider");
    const progText = document.getElementById("d-progress-text");
    slider.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      progText.textContent = `${val}%`;
      proj.progress = val;
      proj.billed = Math.round(proj.value * (val / 100));
      if (val === 100) proj.status = "Project completed";
      saveProjects();
      renderAll();
    });

    el.detailBody.querySelectorAll("[data-task-idx]").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const idx = Number(e.target.getAttribute("data-task-idx"));
        proj.tasks[idx].done = e.target.checked;
        const doneCount = proj.tasks.filter((t) => t.done).length;
        proj.progress = Math.round((doneCount / proj.tasks.length) * 100);
        proj.billed = Math.round(proj.value * (proj.progress / 100));
        if (proj.progress === 100) proj.status = "Project completed";
        saveProjects();
        renderDetailContent(proj);
        renderAll();
      });
    });

    const taskInput = document.getElementById("input-new-task");
    const addTaskAction = () => {
      const text = taskInput.value.trim();
      if (!text) return;
      proj.tasks = proj.tasks || [];
      proj.tasks.push({ text, done: false });
      saveProjects();
      renderDetailContent(proj);
      renderAll();
      showToast("Added checklist deliverable.");
    };
    document.getElementById("btn-add-task").addEventListener("click", addTaskAction);
    taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addTaskAction(); }
    });
  }

  function closeDetail() {
    el.detailBackdrop.classList.remove("is-open");
    el.detailDrawer.classList.remove("is-open");
    el.detailBackdrop.setAttribute("aria-hidden", "true");
    el.detailDrawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.activeProjectId = null;
  }

  function deleteActiveProject() {
    if (!state.activeProjectId) return;
    const proj = state.projects.find((p) => p.id === state.activeProjectId);
    if (!proj) return;
    if (!window.confirm(`Remove "${proj.name}" (${proj.id}) from the tracker?`)) return;
    state.projects = state.projects.filter((p) => p.id !== state.activeProjectId);
    saveProjects();
    closeDetail();
    renderAll();
    showToast(`Deleted ${proj.id}.`);
  }

  function downloadBrief() {
    const p = state.projects.find((x) => x.id === state.activeProjectId);
    if (!p) return;
    const content = [
      "RGE INFRA & INFORMATION TECHNOLOGY SERVICES",
      "Unit 210, Don Raul Building, #77 Kamuning Road, Quezon City",
      "admin@rgeitservices.com | www.rgeinfraitservices.com | +63 917 637 9769",
      "======================================================================",
      `Project ID:     ${p.id}`,
      `PO Reference:   ${p.po || "N/A"}`,
      `Project Name:   ${p.name}`,
      `Service Track:  ${colById[p.column].label}`,
      `Project Status: ${p.status} (${p.progress}%)`,
      `Client:         ${p.client}`,
      `Location:       ${p.location}`,
      `Project Lead:   ${p.pm}`,
      `Contract Value: ${formatPHP(p.value)}`,
      `Billed to Date: ${formatPHP(p.billed)}`,
      `Target Date:    ${p.dueDate}`,
      "",
      "SCOPE & LOGISTICS NOTES:",
      p.notes || "None",
      "",
      "CHECKLIST:",
      ...(p.tasks || []).map((t) => `[${t.done ? "X" : " "}] ${t.text}`)
    ].join("\n");
    downloadFile(`${p.id}_RGE_Brief.txt`, content, "text/plain;charset=utf-8");
    showToast(`Downloaded brief for ${p.id}.`);
  }

  /* ========================================================================
     ADD MODAL & CSV EXPORT
     ======================================================================== */
  function openAddModal(defaults = {}) {
    document.getElementById("f-column").value = defaults.column || "supply-install";
    document.getElementById("f-status").value = defaults.status || "On-going project";
    el.modalBackdrop.classList.add("is-open");
    el.modalBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("f-name").focus(), 90);
  }

  function closeAddModal() {
    el.modalBackdrop.classList.remove("is-open");
    el.modalBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    el.formAddProject.reset();
  }

  function handleAddSubmit(e) {
    e.preventDefault();
    const status = document.getElementById("f-status").value;
    const rawProg = Math.min(100, Math.max(0, Number(document.getElementById("f-progress").value)));
    const progress = status === "Project completed" ? 100 : rawProg;
    const value = Number(document.getElementById("f-value").value);
    const nextNum = String(state.projects.length + 1).padStart(3, "0");

    const newProj = {
      id: `RGE-TRK-${nextNum}`,
      po: document.getElementById("f-po").value.trim() || `PO-2026-${4600 + state.projects.length}`,
      name: document.getElementById("f-name").value.trim(),
      client: document.getElementById("f-client").value.trim(),
      column: document.getElementById("f-column").value,
      status,
      priority: document.getElementById("f-priority").value,
      location: document.getElementById("f-location").value.trim(),
      pm: document.getElementById("f-pm").value.trim(),
      value,
      billed: Math.round(value * (progress / 100)),
      progress,
      dueDate: document.getElementById("f-due").value,
      notes: document.getElementById("f-notes").value.trim() || "RGE Infra & Information Technology Services engagement.",
      tasks: [
        { text: "Site survey & technical BOM sign-off", done: progress >= 20 },
        { text: "Award / materials staging & mobilization", done: progress >= 45 },
        { text: "Delivery / installation & QA testing", done: progress >= 85 },
        { text: "Client UAT & formal turnover", done: progress === 100 }
      ]
    };

    state.projects.unshift(newProj);
    saveProjects();
    updateClock();
    closeAddModal();
    renderAll();
    showToast(`Added ${newProj.id} (${colById[newProj.column].label} • ${newProj.status}).`);
  }

  function exportCSV() {
    const rows = sortProjects(getFilteredProjects());
    const headers = [
      "Project ID", "PO Ref", "Project Name", "Service Track", "Project Status",
      "Priority", "Client", "Location", "Project Lead",
      "Contract Value (PHP)", "Billed (PHP)", "Progress (%)", "Target Date"
    ];
    const csv = [
      headers.join(","),
      ...rows.map((p) =>
        [
          p.id, p.po, p.name, colById[p.column].label, p.status,
          p.priority, p.client, p.location, p.pm,
          p.value, p.billed, p.progress, p.dueDate
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    ].join("\n");

    downloadFile(`RGE_Project_Tracker_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    showToast(`Exported ${rows.length} projects to CSV.`);
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    state.statusFilter = "all";
    state.priorityFilter = "all";
    state.search = "";
    state.tableColFilter = "all";
    el.inputSearch.value = "";
    el.selectPriorityFilter.value = "all";
    el.statusFilterPills.querySelectorAll(".status-chip").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-status") === "all"));
    el.tableColumnFilter.querySelectorAll(".mini-col-btn").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-col") === "all"));
    renderAll();
  }

  /* ========================================================================
     EVENT BINDINGS
     ======================================================================== */
  function bindEvents() {
    // Primary 3-Tab Bar (Desktop & Mobile Bottom Bar)
    document.querySelectorAll("[data-main-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchMainTab(btn.getAttribute("data-main-tab")));
    });
    document.querySelectorAll("[data-mob-main-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchMainTab(btn.getAttribute("data-mob-main-tab")));
    });

    // Columns / List view switcher
    el.btnModeBoard.addEventListener("click", () => { state.viewMode = "board"; syncTabAndViewUI(); });
    el.btnModeTable.addEventListener("click", () => { state.viewMode = "table"; syncTabAndViewUI(); });

    // Sidebar Collapse (Desktop) & Drawer (Mobile)
    document.getElementById("btn-collapse-sidebar").addEventListener("click", () => {
      el.appShell.classList.toggle("is-collapsed");
    });
    el.btnToggleSidebar.addEventListener("click", openMobileSidebar);
    document.getElementById("btn-close-sidebar").addEventListener("click", closeMobileSidebar);
    el.sidebarBackdrop.addEventListener("click", closeMobileSidebar);

    // Command Bar Actions
    document.getElementById("btn-new-project").addEventListener("click", () => {
      if (state.activeTab === "ar" && window.RGE_AR_MODULE) {
        window.RGE_AR_MODULE.openARDrawer(null);
      } else if (state.activeTab === "awarded" && window.RGE_AWARDED_MODULE) {
        window.RGE_AWARDED_MODULE.openDrawer(null);
      } else {
        openAddModal();
      }
    });
    document.getElementById("btn-export-csv").addEventListener("click", exportCSV);
    document.getElementById("btn-print-report").addEventListener("click", () => window.print());

    // Settings Panel Actions
    document.getElementById("form-settings").addEventListener("submit", (e) => {
      e.preventDefault();
      state.settings = {
        companyName: document.getElementById("set-company-name").value.trim(),
        hqAddress: document.getElementById("set-hq-address").value.trim(),
        defaultTerms: document.getElementById("set-default-terms").value.trim()
      };
      saveSettings();
      showToast("Workspace settings saved.");
    });

    document.getElementById("btn-backup-json").addEventListener("click", () => {
      const arRaw = localStorage.getItem("rge_project_tracker_ar_v2");
      const payload = {
        exportedAt: new Date().toISOString(),
        settings: state.settings,
        projects: state.projects,
        accountReceivable: arRaw ? JSON.parse(arRaw) : []
      };
      downloadFile(`RGE_Workspace_Backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
      showToast("Downloaded full RGE Workspace JSON backup.");
    });

    document.getElementById("input-restore-json").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (Array.isArray(parsed.projects)) {
            state.projects = parsed.projects;
            saveProjects();
          }
          if (Array.isArray(parsed.accountReceivable)) {
            localStorage.setItem("rge_project_tracker_ar_v2", JSON.stringify(parsed.accountReceivable));
          }
          if (parsed.settings) {
            state.settings = { ...state.settings, ...parsed.settings };
            saveSettings();
            populateSettingsForm();
          }
          if (window.RGE_AR_MODULE) window.RGE_AR_MODULE.init();
          renderAll();
          showToast("Workspace backup restored successfully.");
        } catch (_) {
          showToast("Invalid JSON backup file.");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });

    const resetAllHandler = () => {
      localStorage.removeItem(STORAGE_KEY);
      state.projects = structuredClone(INITIAL_PROJECTS);
      clearFilters();
      updateClock();
      if (window.RGE_AR_MODULE) window.RGE_AR_MODULE.resetDemoAR();
      showToast("Restored default RGE Project Tracker & AR records.");
    };
    document.getElementById("btn-settings-reset").addEventListener("click", resetAllHandler);

    // Search, Status Chips, Priority & Sort
    el.inputSearch.addEventListener("input", (e) => { state.search = e.target.value; renderAll(); });

    el.statusFilterPills.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-status]");
      if (!btn) return;
      state.statusFilter = btn.getAttribute("data-status");
      el.statusFilterPills.querySelectorAll(".status-chip").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderAll();
    });

    el.selectPriorityFilter.addEventListener("change", (e) => { state.priorityFilter = e.target.value; renderAll(); });
    el.selectSort.addEventListener("change", (e) => { state.sortBy = e.target.value; renderAll(); });

    // Mobile Column Tabs (Tab 1 & Tab 2)
    el.mobileColumnTabs.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-mob-col]");
      if (!tab) return;
      state.mobileCol = tab.getAttribute("data-mob-col");
      renderTab1ServiceBoard(sortProjects(getFilteredProjects()));
    });

    el.mobileStatusTabs.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-mob-status]");
      if (!tab) return;
      state.mobileStatusCol = tab.getAttribute("data-mob-status");
      renderTab2StatusBoard(sortProjects(getFilteredProjects({ ignoreStatus: true })));
    });

    // Table column mini filter
    el.tableColumnFilter.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-col]");
      if (!btn) return;
      state.tableColFilter = btn.getAttribute("data-col");
      el.tableColumnFilter.querySelectorAll(".mini-col-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderMasterTable(sortProjects(getFilteredProjects()));
    });

    document.getElementById("btn-reset-filters-empty").addEventListener("click", clearFilters);

    // Tab 1 Board Clicks (Quick Add or Open Detail)
    el.kanbanBoard.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-quick-add-track]");
      if (addBtn) { openAddModal({ column: addBtn.getAttribute("data-quick-add-track") }); return; }
      const card = e.target.closest("[data-project-id]");
      if (card) openDetail(card.getAttribute("data-project-id"));
    });

    // Tab 2 Status Board Clicks (Quick Add with Status or Open Detail)
    el.statusKanbanBoard.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-quick-add-status]");
      if (addBtn) { openAddModal({ status: addBtn.getAttribute("data-quick-add-status") }); return; }
      const card = e.target.closest("[data-project-id]");
      if (card) openDetail(card.getAttribute("data-project-id"));
    });

    // Tab 3 Overview & Distribution Clicks -> Jump to Project Status Board focused on that status
    el.panelOverview.addEventListener("click", (e) => {
      const target = e.target.closest("[data-jump-status]");
      if (!target) return;
      const st = target.getAttribute("data-jump-status");
      state.mobileStatusCol = st;
      switchMainTab("status");
      showToast(`Viewing "${st}" projects on Project Status Board.`);
    });

    // Master Table Row Click
    el.masterTableBody.addEventListener("click", (e) => {
      const row = e.target.closest("[data-project-id]");
      if (row) openDetail(row.getAttribute("data-project-id"));
    });

    // Detail Drawer
    document.getElementById("btn-close-detail").addEventListener("click", closeDetail);
    document.getElementById("btn-done-detail").addEventListener("click", closeDetail);
    el.detailBackdrop.addEventListener("click", closeDetail);
    document.getElementById("btn-delete-project").addEventListener("click", deleteActiveProject);
    document.getElementById("btn-download-brief").addEventListener("click", downloadBrief);

    // Add Modal
    document.getElementById("btn-close-modal").addEventListener("click", closeAddModal);
    document.getElementById("btn-cancel-modal").addEventListener("click", closeAddModal);
    el.modalBackdrop.addEventListener("click", (e) => { if (e.target === el.modalBackdrop) closeAddModal(); });
    el.formAddProject.addEventListener("submit", handleAddSubmit);

    // Reset Demo Data
    document.getElementById("btn-reset-demo").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      state.projects = structuredClone(INITIAL_PROJECTS);
      clearFilters();
      updateClock();
      if (window.RGE_AR_MODULE) window.RGE_AR_MODULE.resetDemoAR();
      showToast("Restored default RGE Project Tracker & AR records.");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.modalBackdrop.classList.contains("is-open")) closeAddModal();
        if (el.detailDrawer.classList.contains("is-open")) closeDetail();
        if (el.leftSidebar?.classList.contains("is-open")) closeMobileSidebar();
      }
    });
  }

  updateClock();
  setInterval(updateClock, 60000);
  populateSettingsForm();
  bindEvents();
  if (window.RGE_AR_MODULE) window.RGE_AR_MODULE.init();
  if (window.RGE_AWARDED_MODULE) {
    window.RGE_AWARDED_MODULE.init({
      getProjects: () => state.projects,
      saveAndRender: () => { saveProjects(); updateClock(); renderAll(); },
      switchMainTab,
      colById
    });
  }
  if (window.RGE_CLOUD_SYNC) {
    window.RGE_CLOUD_SYNC.init({
      getProjects: () => state.projects,
      reloadFromStorage: () => {
        state.projects = loadProjects();
        state.settings = loadSettings();
        populateSettingsForm();
        if (window.RGE_AR_MODULE) window.RGE_AR_MODULE.init();
        updateClock();
        renderAll();
      }
    });
  }
  renderAll();
})();
