/* ==========================================================================
   RGE Project Tracker — Field Sites & Photos Module
   Features:
     - Auto-syncs with every project in the unified tracker (zero double entry)
     - 3-Stage Categorized Site Photos: Survey / In-Progress (with PB tag) / Completed
     - Automatic Client-Side Canvas HD Compression (max 1280px WebP/JPEG ~120KB)
     - Two-Tier Media Storage: Cloudflare R2 (/api/media) + IndexedDB Local Cache
     - Google Maps Integration: Address/URL/Lat-Lng, One-Tap Mobile GPS Pin, Live Map Embed
     - Fullscreen Lightbox + Printable RGE Site Accomplishment Sheet
   ========================================================================== */

window.RGE_SITES_MEDIA = (() => {
  const DB_NAME = "rge_sites_media_db_v1";
  const STORE_NAME = "photos";
  const CFG_KEY = "rge_cloud_r2_config_v1";

  const PHASES = [
    { id: "survey", label: "Site Survey / Before", short: "Survey", cls: "ph-survey" },
    { id: "progress", label: "In-Progress", short: "In-Progress", cls: "ph-progress" },
    { id: "completed", label: "Completed / Turnover", short: "Completed", cls: "ph-completed" }
  ];
  const phaseById = Object.fromEntries(PHASES.map((p) => [p.id, p]));

  const mediaState = {
    search: "",
    statusFilter: "all",
    photoFilter: "all", // 'all' | 'has-photos' | 'no-photos'
    activeProjectId: null,
    activePhaseTab: "all",
    lightboxPhotos: [],
    lightboxIndex: 0
  };

  let hostAPI = null; // { getProjects, saveAndRender, colById }
  let dbPromise = null;
  let memoryCache = new Map(); // photoId -> dataUrl
  let dom = {};

  /* ========================================================================
     INDEXEDDB LOCAL PHOTO CACHE (Hundreds of MB capacity vs 5MB localStorage)
     ======================================================================== */
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbPutPhoto(id, dataUrl) {
    memoryCache.set(id, dataUrl);
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ id, dataUrl });
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch (_) {}
  }

  async function idbGetPhoto(id) {
    if (memoryCache.has(id)) return memoryCache.get(id);
    try {
      const db = await openDB();
      const rec = await new Promise((res, rej) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      if (rec?.dataUrl) {
        memoryCache.set(id, rec.dataUrl);
        return rec.dataUrl;
      }
    } catch (_) {}
    return null;
  }

  async function idbDeletePhoto(id) {
    memoryCache.delete(id);
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch (_) {}
  }

  /* ========================================================================
     CLIENT-SIDE IMAGE COMPRESSION (Max 1280px, WebP/JPEG ~120-180KB)
     ======================================================================== */
  function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Invalid image format."));
        img.onload = () => {
          const MAX = 1280;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          let mime = "image/webp";
          let dataUrl = canvas.toDataURL("image/webp", 0.8);
          if (!dataUrl.startsWith("data:image/webp")) {
            mime = "image/jpeg";
            dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          }

          canvas.toBlob(
            (blob) => {
              resolve({
                dataUrl,
                blob,
                mime,
                sizeKB: Math.max(1, Math.round((blob ? blob.size : dataUrl.length * 0.75) / 1024))
              });
            },
            mime,
            0.8
          );
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ========================================================================
     CLOUDFLARE R2 MEDIA UPLOAD HELPER (/api/media)
     ======================================================================== */
  function readCloudCfg() {
    try {
      return JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  async function tryUploadToR2(projectId, photoId, blob, mime) {
    const cfg = readCloudCfg();
    const ws = encodeURIComponent(cfg.workspaceId || "rge-main");
    let baseMediaUrl = "/api/media";
    if (cfg.workerUrl && cfg.workerUrl.startsWith("http")) {
      baseMediaUrl = cfg.workerUrl.replace(/\/api\/sync\/?$/, "/api/media");
    }
    try {
      const res = await fetch(
        `${baseMediaUrl}?workspace=${ws}&projectId=${encodeURIComponent(projectId)}&photoId=${encodeURIComponent(photoId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": mime,
            ...(cfg.syncToken ? { "X-Sync-Key": cfg.syncToken } : {})
          },
          body: blob
        }
      );
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.ok && json.url) {
        return { r2Key: json.key, remoteUrl: json.url };
      }
    } catch (_) {
      // Offline or localhost without Pages Function -> IndexedDB handles storage cleanly
    }
    return null;
  }

  async function tryDeleteFromR2(r2Key) {
    if (!r2Key) return;
    const cfg = readCloudCfg();
    let baseMediaUrl = "/api/media";
    if (cfg.workerUrl && cfg.workerUrl.startsWith("http")) {
      baseMediaUrl = cfg.workerUrl.replace(/\/api\/sync\/?$/, "/api/media");
    }
    try {
      await fetch(`${baseMediaUrl}?key=${encodeURIComponent(r2Key)}`, {
        method: "DELETE",
        headers: cfg.syncToken ? { "X-Sync-Key": cfg.syncToken } : {}
      });
    } catch (_) {}
  }

  /* ========================================================================
     GOOGLE MAPS URL & EMBED BUILDER
     ======================================================================== */
  function getMapQuery(proj) {
    if (proj.mapLat && proj.mapLng) return `${proj.mapLat},${proj.mapLng}`;
    if (proj.mapQuery && proj.mapQuery.trim()) return proj.mapQuery.trim();
    return proj.location ? `${proj.location}, Philippines` : "";
  }

  function getGoogleMapsOpenUrl(proj) {
    if (proj.mapUrl && /^https?:\/\//i.test(proj.mapUrl.trim())) return proj.mapUrl.trim();
    const q = getMapQuery(proj);
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
  }

  function getGoogleMapsEmbedUrl(proj) {
    const q = getMapQuery(proj);
    if (!q) return "";
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
  }

  function parseCoordinatesOrUrl(rawInput) {
    const trimmed = rawInput.trim();
    // Extract @lat,lng or q=lat,lng from Google Maps links
    const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { mapLat: atMatch[1], mapLng: atMatch[2], mapUrl: trimmed, mapQuery: `${atMatch[1]},${atMatch[2]}` };
    const qCoordMatch = trimmed.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qCoordMatch) return { mapLat: qCoordMatch[1], mapLng: qCoordMatch[2], mapUrl: trimmed, mapQuery: `${qCoordMatch[1]},${qCoordMatch[2]}` };
    const plainCoords = trimmed.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (plainCoords) return { mapLat: plainCoords[1], mapLng: plainCoords[2], mapUrl: "", mapQuery: `${plainCoords[1]},${plainCoords[2]}` };
    if (/^https?:\/\//i.test(trimmed)) return { mapLat: "", mapLng: "", mapUrl: trimmed, mapQuery: "" };
    return { mapLat: "", mapLng: "", mapUrl: "", mapQuery: trimmed };
  }

  /* ========================================================================
     HELPERS & DOM CACHE
     ======================================================================== */
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
    }, 3200);
  }

  function cacheDOM() {
    dom = {
      tabBadge: document.getElementById("tab-badge-sites"),
      kpiSites: document.getElementById("sites-kpi-total"),
      kpiSitesSub: document.getElementById("sites-kpi-sub"),
      kpiPhotos: document.getElementById("sites-kpi-photos"),
      kpiPhotosSub: document.getElementById("sites-kpi-photos-sub"),
      kpiAccomp: document.getElementById("sites-kpi-accomp"),
      kpiAccompSub: document.getElementById("sites-kpi-accomp-sub"),
      kpiCoverage: document.getElementById("sites-kpi-coverage"),
      kpiCoverageSub: document.getElementById("sites-kpi-coverage-sub"),
      searchInput: document.getElementById("sites-search-input"),
      statusPills: document.getElementById("sites-status-pills"),
      photoFilter: document.getElementById("sites-photo-filter"),
      grid: document.getElementById("sites-cards-grid"),
      emptyState: document.getElementById("sites-empty-state"),
      // Slide-over Inspector Drawer
      drawerBackdrop: document.getElementById("sites-drawer-backdrop"),
      drawer: document.getElementById("sites-drawer"),
      drawerCode: document.getElementById("sites-drawer-code"),
      drawerTitle: document.getElementById("sites-drawer-title"),
      drawerBody: document.getElementById("sites-drawer-body"),
      btnCloseDrawer: document.getElementById("sites-btn-close-drawer"),
      btnPrintSheet: document.getElementById("sites-btn-print-sheet"),
      btnDoneDrawer: document.getElementById("sites-btn-done-drawer"),
      // Lightbox
      lightbox: document.getElementById("sites-lightbox"),
      lbImg: document.getElementById("sites-lb-img"),
      lbCaption: document.getElementById("sites-lb-caption"),
      lbMeta: document.getElementById("sites-lb-meta"),
      lbClose: document.getElementById("sites-lb-close"),
      lbPrev: document.getElementById("sites-lb-prev"),
      lbNext: document.getElementById("sites-lb-next")
    };
  }

  async function resolvePhotoSrc(photo) {
    if (!photo) return null;
    const local = await idbGetPhoto(photo.id);
    if (local) return local;
    if (photo.remoteUrl) return photo.remoteUrl;
    return null;
  }

  /* ========================================================================
     MAIN GRID RENDERER
     ======================================================================== */
  function getFilteredProjects() {
    if (!hostAPI) return [];
    const q = mediaState.search.trim().toLowerCase();
    return hostAPI.getProjects().filter((p) => {
      const photos = Array.isArray(p.sitePhotos) ? p.sitePhotos : [];
      if (mediaState.statusFilter !== "all" && p.status !== mediaState.statusFilter) return false;
      if (mediaState.photoFilter === "has-photos" && photos.length === 0) return false;
      if (mediaState.photoFilter === "no-photos" && photos.length > 0) return false;
      if (q) {
        const hay = `${p.id} ${p.name} ${p.client} ${p.clientContactNo || ""} ${p.clientEmail || ""} ${p.location} ${p.pm} ${p.status} ${p.mapQuery || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    if (!dom.grid || !hostAPI) return;
    const allProjects = hostAPI.getProjects();
    const list = getFilteredProjects();
    const colById = hostAPI.colById;

    // Update KPI Cards & Badge
    let totalPhotos = 0, surveyPhotos = 0, progPhotos = 0, compPhotos = 0, sitesWithPhotos = 0, sitesWithMaps = 0;
    allProjects.forEach((p) => {
      const ph = Array.isArray(p.sitePhotos) ? p.sitePhotos : [];
      if (ph.length > 0) sitesWithPhotos++;
      if (p.mapLat || p.mapUrl || p.mapQuery || p.location) sitesWithMaps++;
      totalPhotos += ph.length;
      surveyPhotos += ph.filter((x) => x.phase === "survey").length;
      progPhotos += ph.filter((x) => x.phase === "progress").length;
      compPhotos += ph.filter((x) => x.phase === "completed").length;
    });

    const avgProg = allProjects.length
      ? allProjects.reduce((s, p) => s + (Number(p.progress) || 0), 0) / allProjects.length
      : 0;
    const coveragePct = allProjects.length ? Math.round((sitesWithPhotos / allProjects.length) * 100) : 0;

    if (dom.tabBadge) dom.tabBadge.textContent = totalPhotos > 0 ? `${totalPhotos} img` : String(allProjects.length);
    dom.kpiSites.textContent = allProjects.length;
    dom.kpiSitesSub.textContent = `${sitesWithMaps} with Google Maps location`;
    dom.kpiPhotos.textContent = totalPhotos;
    dom.kpiPhotosSub.textContent = `${surveyPhotos} Survey • ${progPhotos} Progress • ${compPhotos} Done`;
    dom.kpiAccomp.textContent = `${avgProg.toFixed(1)}%`;
    dom.kpiAccompSub.textContent = `Across ${allProjects.length} active project site${allProjects.length === 1 ? "" : "s"}`;
    dom.kpiCoverage.textContent = `${coveragePct}%`;
    dom.kpiCoverageSub.textContent = `${sitesWithPhotos} of ${allProjects.length} sites have photos`;

    if (list.length === 0) {
      dom.grid.innerHTML = "";
      dom.emptyState.hidden = false;
      return;
    }
    dom.emptyState.hidden = true;

    dom.grid.innerHTML = list
      .map((p) => {
        const photos = Array.isArray(p.sitePhotos) ? p.sitePhotos : [];
        const latestPhoto = photos[0] || null;
        const cSurvey = photos.filter((x) => x.phase === "survey").length;
        const cProg = photos.filter((x) => x.phase === "progress").length;
        const cComp = photos.filter((x) => x.phase === "completed").length;
        const track = colById[p.column] || { label: p.column, accent: "#1C305C" };
        const mapLink = getGoogleMapsOpenUrl(p);

        return `
          <article class="site-card" data-site-open="${esc(p.id)}">
            <div class="site-cover" data-cover-photo-id="${latestPhoto ? esc(latestPhoto.id) : ""}" data-cover-remote="${latestPhoto?.remoteUrl ? esc(latestPhoto.remoteUrl) : ""}">
              <div class="site-cover-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>${photos.length ? "Loading site photo..." : "No site photo yet — tap to upload"}</span>
              </div>
              <img class="site-cover-img" alt="${esc(p.name)} site photo" hidden />
              <span class="site-photo-pill">&#128247; ${photos.length} Photo${photos.length === 1 ? "" : "s"}</span>
              <span class="site-track-pill" style="background:${track.accent}">${esc(track.label)}</span>
            </div>

            <div class="site-card-body">
              <div class="site-card-head">
                <span class="card-code">${esc(p.id)}</span>
                <span class="status-badge ${statusClassFor(p.status)}">${esc(p.status)}</span>
              </div>

              <h3 class="site-card-title">${esc(p.name)}</h3>
              <p class="site-card-client">${esc(p.client)} &bull; PIC: ${esc(p.pm || "TBA")}</p>

              <div class="site-contact-row">
                ${
                  p.clientContactNo
                    ? `<a href="tel:${esc(p.clientContactNo.replace(/[^+\d]/g, ""))}" class="site-contact-chip" data-stop-card="true" title="Call ${esc(p.clientContactNo)}">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                         <span>${esc(p.clientContactNo)}</span>
                       </a>`
                    : `<span class="site-contact-chip is-empty">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                         <span>Add contact no.</span>
                       </span>`
                }
                ${
                  p.clientEmail
                    ? `<a href="mailto:${esc(p.clientEmail)}" class="site-contact-chip" data-stop-card="true" title="Email ${esc(p.clientEmail)}">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                         <span>${esc(p.clientEmail)}</span>
                       </a>`
                    : `<span class="site-contact-chip is-empty">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                         <span>Add Gmail / email</span>
                       </span>`
                }
              </div>

              <div class="site-phase-counts">
                <span class="ph-chip ph-survey">Survey: ${cSurvey}</span>
                <span class="ph-chip ph-progress">Progress: ${cProg}</span>
                <span class="ph-chip ph-completed">Done: ${cComp}</span>
              </div>

              <div>
                <div class="card-progress-meta">
                  <span>Completion Progress</span>
                  <strong>${p.progress}%</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill ${p.progress === 100 ? "is-complete" : ""}" style="width:${p.progress}%"></div>
                </div>
              </div>

              <div class="site-card-footer">
                <span class="site-loc-text" title="${esc(p.location)}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${esc(p.location || "Set location")}</span>
                </span>
                <div class="site-card-actions">
                  ${
                    mapLink
                      ? `<a href="${esc(mapLink)}" target="_blank" rel="noopener noreferrer" class="site-map-link" data-stop-card="true">Maps &#8599;</a>`
                      : ""
                  }
                  <button type="button" class="site-open-btn" data-site-open="${esc(p.id)}">Gallery</button>
                </div>
              </div>
            </div>
          </article>`;
      })
      .join("");

    hydrateCardCovers();
  }

  function statusClassFor(status) {
    if (status === "Survey") return "st-Survey";
    if (status === "Project awarded") return "st-Awarded";
    if (status === "On-going project") return "st-Ongoing";
    if (status === "Project completed") return "st-Completed";
    if (status === "Hold") return "st-Hold";
    return "st-Ongoing";
  }

  async function hydrateCardCovers() {
    const covers = dom.grid.querySelectorAll("[data-cover-photo-id]");
    for (const box of covers) {
      const pid = box.getAttribute("data-cover-photo-id");
      const remote = box.getAttribute("data-cover-remote");
      if (!pid) continue;
      const src = (await idbGetPhoto(pid)) || remote;
      if (src) {
        const img = box.querySelector(".site-cover-img");
        const ph = box.querySelector(".site-cover-placeholder");
        if (img) {
          img.src = src;
          img.hidden = false;
        }
        if (ph) ph.hidden = true;
      }
    }
  }

  /* ========================================================================
     SLIDE-OVER SITE GALLERY & GOOGLE MAPS INSPECTOR DRAWER
     ======================================================================== */
  function openSiteDrawer(projectId) {
    const proj = hostAPI.getProjects().find((p) => p.id === projectId);
    if (!proj) return;
    mediaState.activeProjectId = projectId;
    mediaState.activePhaseTab = "all";
    renderSiteDrawer(proj);
    dom.drawerBackdrop.classList.add("is-open");
    dom.drawer.classList.add("is-open");
    dom.drawerBackdrop.setAttribute("aria-hidden", "false");
    dom.drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeSiteDrawer() {
    dom.drawerBackdrop.classList.remove("is-open");
    dom.drawer.classList.remove("is-open");
    dom.drawerBackdrop.setAttribute("aria-hidden", "true");
    dom.drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    mediaState.activeProjectId = null;
  }

  function renderSiteDrawer(proj) {
    const photos = Array.isArray(proj.sitePhotos) ? proj.sitePhotos : [];
    const filteredPhotos =
      mediaState.activePhaseTab === "all" ? photos : photos.filter((x) => x.phase === mediaState.activePhaseTab);
    const embedUrl = getGoogleMapsEmbedUrl(proj);
    const openMapUrl = getGoogleMapsOpenUrl(proj);
    const currentLocVal = proj.mapUrl || (proj.mapLat && proj.mapLng ? `${proj.mapLat}, ${proj.mapLng}` : proj.mapQuery || proj.location || "");

    dom.drawerCode.textContent = `${proj.id} • FIELD SITE GALLERY & MAP`;
    dom.drawerTitle.textContent = proj.name;

    const pbOptions = ["", "DP", "PB1", "PB2", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8", "PB9", "PB10", "COC / Final"]
      .map((t) => `<option value="${t}">${t || "No Billing Tag"}</option>`)
      .join("");

    const galleryHTML = filteredPhotos.length
      ? filteredPhotos
          .map((ph, idx) => {
            const meta = phaseById[ph.phase] || PHASES[1];
            return `
              <div class="site-thumb-card" data-photo-id="${esc(ph.id)}" data-remote="${esc(ph.remoteUrl || "")}">
                <div class="site-thumb-img-wrap" data-lb-index="${idx}">
                  <img class="site-thumb-img" alt="${esc(ph.caption || proj.name)}" />
                  <span class="ph-chip ${meta.cls} thumb-phase-pos">${esc(meta.short)}</span>
                  ${ph.pbTag ? `<span class="thumb-pb-tag">${esc(ph.pbTag)}</span>` : ""}
                </div>
                <div class="site-thumb-meta">
                  <strong class="site-thumb-cap">${esc(ph.caption || "Site photo")}</strong>
                  <div class="site-thumb-row">
                    <span>${esc(ph.date || "")} &bull; ${ph.sizeKB || 0}KB ${ph.r2Key ? "• R2" : "• Local"}</span>
                    <button type="button" class="site-del-photo-btn" data-del-photo="${esc(ph.id)}" title="Delete photo">&times;</button>
                  </div>
                </div>
              </div>`;
          })
          .join("")
      : `<div class="cb-empty" style="text-align:center">No photos in this stage yet. Upload site photos or snap with your phone camera above.</div>`;

    dom.drawerBody.innerHTML = `
      <!-- Live Progress & Status Sync Strip -->
      <div class="ar-live-summary">
        <div class="ar-live-box">
          <span>Project Status</span>
          <div style="margin-top:0.2rem"><span class="status-badge ${statusClassFor(proj.status)}">${esc(proj.status)}</span></div>
        </div>
        <div class="ar-live-box highlight">
          <span>Completion Progress</span>
          <strong>${proj.progress}%</strong>
        </div>
      </div>

      <!-- SECTION 1: CLIENT / COMPANY CONTACT DETAILS -->
      <div class="ar-form-section sec-navy">
        <div class="ar-sec-head">
          <h3>1. Client / Company Contact Details</h3>
          <div class="site-contact-actions">
            ${
              proj.clientContactNo
                ? `<a href="tel:${esc(proj.clientContactNo.replace(/[^+\d]/g, ""))}" class="site-contact-pill pill-call">Call &#8599;</a>`
                : ""
            }
            ${
              proj.clientEmail
                ? `<a href="mailto:${esc(proj.clientEmail)}" class="site-contact-pill pill-mail">Gmail &#8599;</a>`
                : ""
            }
          </div>
        </div>
        <div class="ar-form-grid">
          <div class="form-field">
            <label for="site-f-contact-no">Client / Company Contact No.</label>
            <input type="tel" id="site-f-contact-no" value="${esc(proj.clientContactNo || "")}" placeholder="e.g., +63 917 000 0000 / (02) 8123-4567" />
          </div>
          <div class="form-field">
            <label for="site-f-contact-email">Gmail / Email Address</label>
            <input type="email" id="site-f-contact-email" value="${esc(proj.clientEmail || "")}" placeholder="e.g., client.contact@gmail.com" />
          </div>
        </div>
        <div class="site-loc-btns" style="margin-top:0.6rem">
          <button type="button" class="btn btn-primary btn-sm" id="site-btn-save-contact">Save Contact Details</button>
        </div>
      </div>

      <!-- SECTION 2: GOOGLE MAPS LOCATION & LIVE PREVIEW -->
      <div class="ar-form-section sec-navy">
        <div class="ar-sec-head">
          <h3>2. Google Maps Site Location</h3>
          ${
            openMapUrl
              ? `<a href="${esc(openMapUrl)}" target="_blank" rel="noopener noreferrer" class="site-map-link">Open in Google Maps &#8599;</a>`
              : ""
          }
        </div>
        <div class="site-loc-controls">
          <input type="text" id="site-f-map-input" value="${esc(currentLocVal)}" placeholder="Paste Google Maps link, address, or Lat, Lng..." aria-label="Google Maps location or coordinates" />
          <div class="site-loc-btns">
            <button type="button" class="btn btn-outline btn-sm" id="site-btn-gps" title="Use your device's current GPS coordinates">&#128205; Pin My GPS</button>
            <button type="button" class="btn btn-primary btn-sm" id="site-btn-save-map">Save Location</button>
          </div>
        </div>
        ${
          embedUrl
            ? `<div class="site-map-embed-wrap">
                 <iframe src="${esc(embedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google Maps preview for ${esc(proj.name)}"></iframe>
               </div>`
            : `<p class="cb-subtext" style="margin-top:0.5rem">Enter a site address or tap <strong>Pin My GPS</strong> to embed an interactive Google Map.</p>`
        }
      </div>

      <!-- SECTION 3: UPLOAD SITE PHOTOS (3 STAGES + MOBILE CAMERA + AUTO COMPRESS) -->
      <div class="ar-form-section sec-dp">
        <h3>3. Upload Site Photos (Auto-Compressed for R2)</h3>
        <div class="ar-form-grid">
          <div class="form-field">
            <label for="site-f-phase">Photo Stage</label>
            <select id="site-f-phase" class="select-control">
              <option value="survey">Site Survey / Before</option>
              <option value="progress" selected>In-Progress</option>
              <option value="completed">Completed / Turnover</option>
            </select>
          </div>
          <div class="form-field">
            <label for="site-f-pbtag">Billing Proof Tag (Optional)</label>
            <select id="site-f-pbtag" class="select-control">${pbOptions}</select>
          </div>
          <div class="form-field full-span">
            <label for="site-f-caption">Photo Caption / Site Note</label>
            <input type="text" id="site-f-caption" placeholder="e.g., Backbone fiber splicing at Kamuning manhole #4" />
          </div>
        </div>

        <div class="site-upload-actions">
          <label class="btn btn-primary btn-sm" for="site-input-files" style="cursor:pointer">&#128247; Upload Photos</label>
          <input type="file" id="site-input-files" accept="image/*" multiple hidden />

          <label class="btn btn-outline btn-sm" for="site-input-camera" style="cursor:pointer">&#128248; Take Photo (Camera)</label>
          <input type="file" id="site-input-camera" accept="image/*" capture="environment" hidden />
        </div>
      </div>

      <!-- SECTION 4: 3-STAGE SITE PHOTO GALLERY -->
      <div class="ar-form-section sec-tax">
        <div class="ar-sec-head">
          <h3>4. Site Photo Gallery (${photos.length})</h3>
        </div>
        <div class="site-phase-tabs" id="site-drawer-phase-tabs">
          <button type="button" class="mini-col-btn ${mediaState.activePhaseTab === "all" ? "is-active" : ""}" data-ph-tab="all">All (${photos.length})</button>
          <button type="button" class="mini-col-btn ${mediaState.activePhaseTab === "survey" ? "is-active" : ""}" data-ph-tab="survey">Survey (${photos.filter((x) => x.phase === "survey").length})</button>
          <button type="button" class="mini-col-btn ${mediaState.activePhaseTab === "progress" ? "is-active" : ""}" data-ph-tab="progress">In-Progress (${photos.filter((x) => x.phase === "progress").length})</button>
          <button type="button" class="mini-col-btn ${mediaState.activePhaseTab === "completed" ? "is-active" : ""}" data-ph-tab="completed">Completed (${photos.filter((x) => x.phase === "completed").length})</button>
        </div>
        <div class="site-thumbs-grid" id="site-drawer-gallery">${galleryHTML}</div>
      </div>`;

    bindDrawerEvents(proj, filteredPhotos);
    hydrateDrawerThumbs();
  }

  async function hydrateDrawerThumbs() {
    const cards = dom.drawerBody.querySelectorAll("[data-photo-id]");
    for (const card of cards) {
      const pid = card.getAttribute("data-photo-id");
      const remote = card.getAttribute("data-remote");
      const src = (await idbGetPhoto(pid)) || remote;
      const img = card.querySelector(".site-thumb-img");
      if (img && src) img.src = src;
    }
  }

  function bindDrawerEvents(proj, filteredPhotos) {
    // Save Client / Company Contact No. & Gmail
    const saveContactDetails = () => {
      const contactNoEl = document.getElementById("site-f-contact-no");
      const contactEmailEl = document.getElementById("site-f-contact-email");
      proj.clientContactNo = contactNoEl ? contactNoEl.value.trim() : "";
      proj.clientEmail = contactEmailEl ? contactEmailEl.value.trim() : "";
    };

    document.getElementById("site-btn-save-contact").addEventListener("click", () => {
      saveContactDetails();
      hostAPI.saveAndRender();
      renderSiteDrawer(proj);
      toast("Saved client contact details.");
    });

    // Save Google Maps location (also preserves any unsaved contact edits)
    document.getElementById("site-btn-save-map").addEventListener("click", () => {
      saveContactDetails();
      const raw = document.getElementById("site-f-map-input").value;
      const parsed = parseCoordinatesOrUrl(raw);
      proj.mapLat = parsed.mapLat;
      proj.mapLng = parsed.mapLng;
      proj.mapUrl = parsed.mapUrl;
      proj.mapQuery = parsed.mapQuery;
      if (!proj.location && parsed.mapQuery) proj.location = parsed.mapQuery;
      hostAPI.saveAndRender();
      renderSiteDrawer(proj);
      toast("Saved Google Maps location.");
    });

    // One-Tap Mobile GPS Pin
    document.getElementById("site-btn-gps").addEventListener("click", () => {
      if (!navigator.geolocation) {
        toast("Geolocation is not supported on this browser.");
        return;
      }
      toast("Acquiring GPS coordinates...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          proj.mapLat = lat;
          proj.mapLng = lng;
          proj.mapQuery = `${lat},${lng}`;
          proj.mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          hostAPI.saveAndRender();
          renderSiteDrawer(proj);
          toast(`Pinned exact GPS: ${lat}, ${lng}`);
        },
        (err) => toast(`GPS error: ${err.message}`),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Upload files / camera photos
    const handleFiles = async (fileList) => {
      if (!fileList || fileList.length === 0) return;
      const phase = document.getElementById("site-f-phase").value;
      const pbTag = document.getElementById("site-f-pbtag").value;
      const caption = document.getElementById("site-f-caption").value.trim();
      proj.sitePhotos = Array.isArray(proj.sitePhotos) ? proj.sitePhotos : [];

      toast(`Compressing ${fileList.length} photo${fileList.length > 1 ? "s" : ""}...`);
      let r2Count = 0;

      for (const file of Array.from(fileList)) {
        try {
          const comp = await compressImageFile(file);
          const photoId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await idbPutPhoto(photoId, comp.dataUrl);
          const r2Res = await tryUploadToR2(proj.id, photoId, comp.blob, comp.mime);
          if (r2Res) r2Count++;

          proj.sitePhotos.unshift({
            id: photoId,
            phase,
            pbTag,
            caption: caption || file.name.replace(/\.[^.]+$/, ""),
            date: new Date().toISOString().slice(0, 10),
            sizeKB: comp.sizeKB,
            r2Key: r2Res?.r2Key || "",
            remoteUrl: r2Res?.remoteUrl || ""
          });
        } catch (err) {
          toast(`Skipped image: ${err.message}`);
        }
      }

      hostAPI.saveAndRender();
      renderSiteDrawer(proj);
      toast(
        r2Count > 0
          ? `Uploaded ${fileList.length} compressed photo(s) to Cloudflare R2!`
          : `Saved ${fileList.length} compressed photo(s) to local site vault.`
      );
    };

    document.getElementById("site-input-files").addEventListener("change", (e) => {
      handleFiles(e.target.files);
      e.target.value = "";
    });
    document.getElementById("site-input-camera").addEventListener("change", (e) => {
      handleFiles(e.target.files);
      e.target.value = "";
    });

    // Phase filter tabs inside drawer
    document.getElementById("site-drawer-phase-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ph-tab]");
      if (!btn) return;
      mediaState.activePhaseTab = btn.getAttribute("data-ph-tab");
      renderSiteDrawer(proj);
    });

    // Lightbox & Delete inside gallery
    document.getElementById("site-drawer-gallery").addEventListener("click", async (e) => {
      const delBtn = e.target.closest("[data-del-photo]");
      if (delBtn) {
        const pid = delBtn.getAttribute("data-del-photo");
        if (!window.confirm("Delete this site photo?")) return;
        const target = (proj.sitePhotos || []).find((x) => x.id === pid);
        proj.sitePhotos = (proj.sitePhotos || []).filter((x) => x.id !== pid);
        await idbDeletePhoto(pid);
        if (target?.r2Key) await tryDeleteFromR2(target.r2Key);
        hostAPI.saveAndRender();
        renderSiteDrawer(proj);
        toast("Site photo deleted.");
        return;
      }

      const imgWrap = e.target.closest("[data-lb-index]");
      if (imgWrap) {
        const idx = Number(imgWrap.getAttribute("data-lb-index"));
        openLightbox(filteredPhotos, idx);
      }
    });
  }

  /* ========================================================================
     FULLSCREEN PHOTO LIGHTBOX
     ======================================================================== */
  async function openLightbox(photos, index) {
    mediaState.lightboxPhotos = photos;
    mediaState.lightboxIndex = index;
    await renderLightboxSlide();
    dom.lightbox.classList.add("is-open");
    dom.lightbox.setAttribute("aria-hidden", "false");
  }

  async function renderLightboxSlide() {
    const ph = mediaState.lightboxPhotos[mediaState.lightboxIndex];
    if (!ph) return;
    const src = await resolvePhotoSrc(ph);
    const meta = phaseById[ph.phase] || PHASES[1];
    dom.lbImg.src = src || "";
    dom.lbCaption.textContent = ph.caption || "Project Site Photo";
    dom.lbMeta.textContent = `${meta.label}${ph.pbTag ? ` • ${ph.pbTag}` : ""} • ${ph.date || ""} (${mediaState.lightboxIndex + 1}/${mediaState.lightboxPhotos.length})`;
  }

  function closeLightbox() {
    dom.lightbox.classList.remove("is-open");
    dom.lightbox.setAttribute("aria-hidden", "true");
  }

  /* ========================================================================
     PRINTABLE RGE SITE ACCOMPLISHMENT REPORT (With Official RGE Header!)
     ======================================================================== */
  async function printSiteAccomplishmentSheet() {
    const proj = hostAPI.getProjects().find((p) => p.id === mediaState.activeProjectId);
    if (!proj) return;
    const photos = Array.isArray(proj.sitePhotos) ? proj.sitePhotos : [];
    const resolved = [];
    for (const ph of photos) {
      const src = await resolvePhotoSrc(ph);
      if (src) resolved.push({ ...ph, src });
    }

    const win = window.open("", "_blank", "width=980,height=760");
    if (!win) {
      toast("Pop-up blocked — allow pop-ups to print the Site Accomplishment Sheet.");
      return;
    }

    const photoCards = resolved.length
      ? resolved
          .map(
            (ph) => `
          <div class="p-card">
            <img src="${ph.src}" alt="${esc(ph.caption)}" />
            <div class="p-cap">
              <strong>${esc(phaseById[ph.phase]?.label || ph.phase)}${ph.pbTag ? ` (${esc(ph.pbTag)})` : ""}</strong>
              <div>${esc(ph.caption)} &bull; ${esc(ph.date)}</div>
            </div>
          </div>`
          )
          .join("")
      : `<p style="color:#64748B">No site photos attached yet.</p>`;

    const mapUrl = getGoogleMapsOpenUrl(proj);
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(proj.id)} — Site Accomplishment Report</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;color:#0F172A;margin:0;padding:24px;}
        .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #142A54;padding-bottom:14px;margin-bottom:18px;}
        .hdr-left{display:flex;align-items:center;gap:12px;}
        .hdr-left img{width:54px;height:54px;object-fit:contain;}
        .hdr-title{font-weight:800;font-size:16px;line-height:1.15;}
        .hdr-addr{font-size:12px;text-align:right;color:#334155;}
        h1{font-size:19px;margin:0 0 6px;color:#142A54;}
        .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#F8FAFD;border:1px solid #DCE3EE;border-radius:8px;padding:12px;margin-bottom:18px;font-size:12px;}
        .meta span{display:block;color:#64748B;font-size:10px;text-transform:uppercase;font-weight:700;}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
        .p-card{border:1px solid #DCE3EE;border-radius:8px;overflow:hidden;break-inside:avoid;}
        .p-card img{width:100%;height:220px;object-fit:cover;display:block;}
        .p-cap{padding:8px 10px;font-size:12px;}
        .ftr{margin-top:24px;padding-top:10px;border-top:2px solid #2573BA;font-size:11px;color:#475569;display:flex;justify-content:space-between;}
      </style></head><body>
      <div class="hdr">
        <div class="hdr-left">
          <img src="${window.location.origin}/Images/RGE%20Logo.jpg" alt="RGE" />
          <div class="hdr-title">RGE INFRA &amp; INFORMATION<br/>TECHNOLOGY SERVICES</div>
        </div>
        <div class="hdr-addr">Unit 210, Don Raul Building, #77<br/>Kamuning Road, Quezon City</div>
      </div>
      <h1>Site Accomplishment &amp; Photo Report — ${esc(proj.name)}</h1>
      <div class="meta">
        <div><span>Project ID / P.O#</span><strong>${esc(proj.id)} / ${esc(proj.po || "TBA")}</strong></div>
        <div><span>Client</span><strong>${esc(proj.client)}</strong></div>
        <div><span>Status &amp; Progress</span><strong>${esc(proj.status)} (${proj.progress}%)</strong></div>
        <div><span>Client / Company Contact No.</span><strong>${esc(proj.clientContactNo || "—")}</strong></div>
        <div><span>Gmail / Email</span><strong>${esc(proj.clientEmail || "—")}</strong></div>
        <div><span>Project Lead / PIC</span><strong>${esc(proj.pm || "—")}</strong></div>
        <div><span>Project Site</span><strong>${esc(proj.location || "—")}</strong></div>
        <div><span>Google Maps</span><strong>${mapUrl ? `<a href="${esc(mapUrl)}">Open Site Pin</a>` : "Not set"}</strong></div>
      </div>
      <div class="grid">${photoCards}</div>
      <div class="ftr">
        <span>admin@rgeitservices.com | www.rgeinfraitservices.com</span>
        <span>+63 917 637 9769 / +63 917 180 3070</span>
      </div>
      <script>window.onload=()=>setTimeout(()=>window.print(),350);</script>
      </body></html>`);
    win.document.close();
  }

  /* ========================================================================
     INIT & EVENTS
     ======================================================================== */
  function init(api) {
    hostAPI = api;
    cacheDOM();
    if (!dom.grid) return;

    dom.searchInput.addEventListener("input", (e) => {
      mediaState.search = e.target.value;
      render();
    });

    dom.statusPills.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-site-status]");
      if (!btn) return;
      mediaState.statusFilter = btn.getAttribute("data-site-status");
      dom.statusPills.querySelectorAll(".status-chip").forEach((b) => b.classList.toggle("is-active", b === btn));
      render();
    });

    dom.photoFilter.addEventListener("change", (e) => {
      mediaState.photoFilter = e.target.value;
      render();
    });

    dom.grid.addEventListener("click", (e) => {
      if (e.target.closest("[data-stop-card]")) return;
      const trigger = e.target.closest("[data-site-open]");
      if (trigger) openSiteDrawer(trigger.getAttribute("data-site-open"));
    });

    dom.btnCloseDrawer.addEventListener("click", closeSiteDrawer);
    dom.btnDoneDrawer.addEventListener("click", closeSiteDrawer);
    dom.drawerBackdrop.addEventListener("click", closeSiteDrawer);
    dom.btnPrintSheet.addEventListener("click", printSiteAccomplishmentSheet);

    // Lightbox controls
    dom.lbClose.addEventListener("click", closeLightbox);
    dom.lightbox.addEventListener("click", (e) => { if (e.target === dom.lightbox) closeLightbox(); });
    dom.lbPrev.addEventListener("click", () => {
      if (!mediaState.lightboxPhotos.length) return;
      mediaState.lightboxIndex = (mediaState.lightboxIndex - 1 + mediaState.lightboxPhotos.length) % mediaState.lightboxPhotos.length;
      renderLightboxSlide();
    });
    dom.lbNext.addEventListener("click", () => {
      if (!mediaState.lightboxPhotos.length) return;
      mediaState.lightboxIndex = (mediaState.lightboxIndex + 1) % mediaState.lightboxPhotos.length;
      renderLightboxSlide();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (dom.lightbox.classList.contains("is-open")) closeLightbox();
        else if (dom.drawer.classList.contains("is-open")) closeSiteDrawer();
      }
    });

    render();
  }

  /* Permanently purge all photos of a deleted project from IndexedDB + Cloudflare R2 */
  async function cleanupProjectMedia(proj) {
    if (!proj || !Array.isArray(proj.sitePhotos)) return;
    for (const ph of proj.sitePhotos) {
      if (ph.id) await idbDeletePhoto(ph.id);
      if (ph.r2Key) await tryDeleteFromR2(ph.r2Key);
    }
  }

  return { init, render, openSiteDrawer, cleanupProjectMedia };
})();
