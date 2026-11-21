/* ==========================================================================
   RGE Project Tracker — Cloudflare R2 Cloud Backup & Multi-Device Sync Engine
   Supports:
     1. Cloudflare Pages Functions / Worker + R2 Binding (/api/sync) [Recommended]
     2. Direct Cloudflare R2 S3 Endpoint (Native Web Crypto AWS SigV4)
     3. Optional Client-Side AES-256-GCM Encryption (Master Password in Security)
     4. Auto-Backup Debounce, Versioned Snapshot History & Restore, Phone Pairing
   ========================================================================== */

window.RGE_CLOUD_SYNC = (() => {
  const CFG_KEY = "rge_cloud_r2_config_v1";
  const LOCAL_SNAPS_KEY = "rge_cloud_local_snapshots_v1";
  const PROJECTS_KEY = "rge_project_tracker_v3";
  const AR_KEY = "rge_project_tracker_ar_v2";
  const SETTINGS_KEY = "rge_project_tracker_settings_v1";

  let autoBackupTimer = null;
  let hostCallbacks = null;
  let dom = {};

  function defaultDeviceName() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|Android|Mobile/i.test(ua)) return "RGE-MOBILE";
    return "RGE-DESKTOP";
  }

  function loadConfig() {
    const defaults = {
      mode: "worker", // 'worker' | 'direct-r2'
      workerUrl: "/api/sync",
      r2Endpoint: "",
      r2Bucket: "rge-project-tracker",
      r2AccessKeyId: "",
      r2SecretAccessKey: "",
      syncToken: "",
      workspaceId: "rge-main",
      deviceName: defaultDeviceName(),
      autoBackup: true,
      encryptEnabled: false,
      masterPassword: "",
      lastBackupAt: null,
      lastSyncAt: null,
      lastSyncedDevice: ""
    };
    try {
      const saved = localStorage.getItem(CFG_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (_) {}
    return defaults;
  }

  let cfg = loadConfig();

  function saveConfig() {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    } catch (_) {}
  }

  function loadLocalSnapshots() {
    try {
      const saved = localStorage.getItem(LOCAL_SNAPS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  }

  function saveLocalSnapshots(list) {
    try {
      // Keep last 12 snapshots locally
      localStorage.setItem(LOCAL_SNAPS_KEY, JSON.stringify(list.slice(0, 12)));
    } catch (_) {}
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

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatBytes(bytes) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatRelativeTime(iso) {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const sec = Math.max(0, Math.floor(diffMs / 1000));
    if (sec < 45) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatBackupTimestamp(iso) {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  }

  /* ========================================================================
     CLIENT-SIDE AES-256-GCM ENCRYPTION (Optional Master Password)
     ======================================================================== */
  async function deriveAesKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function toBase64(bytes) {
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  function fromBase64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function packPayload(rawObj) {
    const json = JSON.stringify(rawObj);
    if (!cfg.encryptEnabled || !cfg.masterPassword) {
      return json;
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(cfg.masterPassword, salt);
    const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(json));
    return JSON.stringify({
      encrypted: true,
      alg: "AES-256-GCM",
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(cipherBuf))
    });
  }

  async function unpackPayload(text) {
    const parsed = JSON.parse(text);
    if (!parsed.encrypted) return parsed;
    if (!cfg.masterPassword) {
      throw new Error("Backup is encrypted. Enter your Master Password in Settings → Security.");
    }
    const key = await deriveAesKey(cfg.masterPassword, fromBase64(parsed.salt));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(parsed.iv) },
      key,
      fromBase64(parsed.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plainBuf));
  }

  /* ========================================================================
     NATIVE WEB CRYPTO AWS SIGV4 FOR DIRECT CLOUDFLARE R2 S3 API
     ======================================================================== */
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hmacSha256(keyBytes, dataStr) {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataStr));
    return new Uint8Array(sig);
  }

  async function signR2Request({ method, endpoint, bucket, keyPath, body = "", query = "" }) {
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
    const urlObj = new URL(`${cleanEndpoint}/${bucket}/${keyPath}${query ? `?${query}` : ""}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";
    const payloadHash = await sha256Hex(body);

    const canonicalHeaders = `host:${urlObj.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [method, urlObj.pathname, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

    const enc = new TextEncoder();
    const kDate = await hmacSha256(enc.encode(`AWS4${cfg.r2SecretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");
    const sigBytes = await hmacSha256(kSigning, stringToSign);
    const signature = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      url: urlObj.toString(),
      headers: {
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authHeader,
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {})
      }
    };
  }

  /* ========================================================================
     SNAPSHOT CAPTURE & HYDRATION
     ======================================================================== */
  function buildWorkspaceSnapshot() {
    const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "null") || (hostCallbacks ? hostCallbacks.getProjects() : []);
    const ar = JSON.parse(localStorage.getItem(AR_KEY) || "null") || [];
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") || {};
    return {
      version: 2,
      workspaceId: cfg.workspaceId || "rge-main",
      deviceName: cfg.deviceName || defaultDeviceName(),
      timestamp: new Date().toISOString(),
      projects,
      accountReceivable: ar,
      settings
    };
  }

  function applyWorkspaceSnapshot(snap) {
    if (!snap || typeof snap !== "object") throw new Error("Invalid backup payload.");
    if (Array.isArray(snap.projects)) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(snap.projects));
    }
    if (Array.isArray(snap.accountReceivable)) {
      localStorage.setItem(AR_KEY, JSON.stringify(snap.accountReceivable));
    }
    if (snap.settings && typeof snap.settings === "object") {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(snap.settings));
    }
    if (hostCallbacks && hostCallbacks.reloadFromStorage) {
      hostCallbacks.reloadFromStorage();
    }
  }

  /* ========================================================================
     CLOUD OPERATIONS: BACK UP NOW, SYNC NOW, LIST BACKUPS, RESTORE
     ======================================================================== */
  function isCloudConfigured() {
    if (cfg.mode === "direct-r2") {
      return Boolean(cfg.r2Endpoint && cfg.r2Bucket && cfg.r2AccessKeyId && cfg.r2SecretAccessKey);
    }
    return Boolean(cfg.workerUrl && cfg.workerUrl.trim());
  }

  async function backupNow(silent = false) {
    const snap = buildWorkspaceSnapshot();
    const packed = await packPayload(snap);
    const sizeBytes = new Blob([packed]).size;
    const snapId = `backup-${Date.now()}.json`;

    // Always store a local copy in the versioned backup list for instant offline recovery
    const localSnaps = loadLocalSnapshots();
    localSnaps.unshift({
      id: snapId,
      timestamp: snap.timestamp,
      deviceName: snap.deviceName,
      sizeBytes,
      source: "Local",
      payload: packed
    });

    let cloudOk = false;
    let cloudErr = null;

    if (cfg.mode === "direct-r2" && isCloudConfigured()) {
      try {
        const ws = encodeURIComponent(cfg.workspaceId || "rge-main");
        const latestReq = await signR2Request({
          method: "PUT",
          endpoint: cfg.r2Endpoint,
          bucket: cfg.r2Bucket,
          keyPath: `${ws}/latest.json`,
          body: packed
        });
        const res1 = await fetch(latestReq.url, { method: "PUT", headers: latestReq.headers, body: packed });
        if (!res1.ok) throw new Error(`R2 HTTP ${res1.status}`);

        const verReq = await signR2Request({
          method: "PUT",
          endpoint: cfg.r2Endpoint,
          bucket: cfg.r2Bucket,
          keyPath: `${ws}/history/${snapId}`,
          body: packed
        });
        await fetch(verReq.url, { method: "PUT", headers: verReq.headers, body: packed });
        cloudOk = true;
      } catch (err) {
        cloudErr = err;
      }
    } else if (cfg.mode === "worker" && isCloudConfigured()) {
      try {
        const url = `${cfg.workerUrl.replace(/\/+$/, "")}?workspace=${encodeURIComponent(cfg.workspaceId || "rge-main")}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cfg.syncToken ? { "X-Sync-Key": cfg.syncToken } : {})
          },
          body: JSON.stringify({
            id: snapId,
            timestamp: snap.timestamp,
            deviceName: snap.deviceName,
            sizeBytes,
            payload: packed
          })
        });
        if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
        cloudOk = true;
      } catch (err) {
        cloudErr = err;
      }
    }

    if (cloudOk) {
      localSnaps[0].source = "Cloudflare R2";
      cfg.lastBackupAt = snap.timestamp;
      cfg.lastSyncAt = snap.timestamp;
      cfg.lastSyncedDevice = snap.deviceName;
      saveConfig();
      saveLocalSnapshots(localSnaps);
      renderCloudUI();
      if (!silent) toast(`Backed up to Cloudflare R2 (${formatBytes(sizeBytes)}).`);
      return;
    }

    // Fallback: saved locally when running offline / localhost without Worker
    cfg.lastBackupAt = snap.timestamp;
    saveConfig();
    saveLocalSnapshots(localSnaps);
    renderCloudUI();
    if (!silent) {
      if (cloudErr) {
        toast(`Saved local backup (${formatBytes(sizeBytes)}). R2 endpoint unreachable locally — deploy to Cloudflare Pages to sync.`);
      } else {
        toast(`Saved local backup (${formatBytes(sizeBytes)}). Configure Cloudflare R2 below for cloud sync.`);
      }
    }
  }

  async function syncNow() {
    if (!isCloudConfigured()) {
      toast("Configure your Cloudflare R2 endpoint or Pages Worker URL first.");
      toggleConfigPanel(true);
      return;
    }

    try {
      let packedText = null;
      if (cfg.mode === "direct-r2") {
        const ws = encodeURIComponent(cfg.workspaceId || "rge-main");
        const req = await signR2Request({
          method: "GET",
          endpoint: cfg.r2Endpoint,
          bucket: cfg.r2Bucket,
          keyPath: `${ws}/latest.json`
        });
        const res = await fetch(req.url, { method: "GET", headers: req.headers });
        if (!res.ok) throw new Error(`R2 HTTP ${res.status}`);
        packedText = await res.text();
      } else {
        const url = `${cfg.workerUrl.replace(/\/+$/, "")}?workspace=${encodeURIComponent(cfg.workspaceId || "rge-main")}&action=latest`;
        const res = await fetch(url, {
          method: "GET",
          headers: cfg.syncToken ? { "X-Sync-Key": cfg.syncToken } : {}
        });
        if (!res.ok) throw new Error(`Sync HTTP ${res.status}`);
        const json = await res.json();
        packedText = typeof json.payload === "string" ? json.payload : JSON.stringify(json.payload || json);

        // Merge remote version history list if returned by Pages Function
        if (Array.isArray(json.backups) && json.backups.length > 0) {
          const existing = loadLocalSnapshots();
          const merged = [...json.backups.map((b) => ({ ...b, source: "Cloudflare R2" })), ...existing.filter((e) => !json.backups.some((b) => b.id === e.id))];
          saveLocalSnapshots(merged);
        }
      }

      const snap = await unpackPayload(packedText);
      applyWorkspaceSnapshot(snap);
      cfg.lastSyncAt = new Date().toISOString();
      cfg.lastSyncedDevice = snap.deviceName || "Cloud R2";
      saveConfig();
      renderCloudUI();
      toast(`Synced workspace from ${cfg.lastSyncedDevice} (${snap.projects?.length || 0} projects).`);
    } catch (err) {
      toast(`Cloud sync failed: ${err.message}`);
    }
  }

  async function restoreSnapshotById(snapId) {
    const local = loadLocalSnapshots().find((s) => s.id === snapId);
    if (!window.confirm("Restore this backup snapshot? Current unsaved edits will be replaced.")) return;

    try {
      let packedText = local?.payload || null;
      if (!packedText && cfg.mode === "worker" && isCloudConfigured()) {
        const url = `${cfg.workerUrl.replace(/\/+$/, "")}?workspace=${encodeURIComponent(cfg.workspaceId || "rge-main")}&action=get&id=${encodeURIComponent(snapId)}`;
        const res = await fetch(url, { headers: cfg.syncToken ? { "X-Sync-Key": cfg.syncToken } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        packedText = json.payload;
      }
      if (!packedText) throw new Error("Snapshot data unavailable.");

      const snap = await unpackPayload(packedText);
      applyWorkspaceSnapshot(snap);
      renderCloudUI();
      toast(`Restored backup from ${formatBackupTimestamp(snap.timestamp)}.`);
    } catch (err) {
      toast(`Restore failed: ${err.message}`);
    }
  }

  function scheduleAutoBackup() {
    if (!cfg.autoBackup) return;
    clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(() => {
      backupNow(true);
    }, 3500);
  }

  /* ========================================================================
     PHONE / MULTI-DEVICE PAIRING (Hash Link + Scannable Pairing Code)
     ======================================================================== */
  function generatePairingURL() {
    const pairData = {
      mode: cfg.mode,
      workerUrl: cfg.workerUrl,
      r2Endpoint: cfg.r2Endpoint,
      r2Bucket: cfg.r2Bucket,
      workspaceId: cfg.workspaceId,
      syncToken: cfg.syncToken
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(pairData))));
    const base = window.location.origin + window.location.pathname;
    return `${base}#pair=${encoded}`;
  }

  function checkIncomingPairingHash() {
    const hash = window.location.hash || "";
    if (!hash.startsWith("#pair=")) return;
    try {
      const encoded = hash.slice(6);
      const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      cfg = { ...cfg, ...parsed };
      saveConfig();
      history.replaceState(null, "", window.location.pathname + window.location.search);
      toast(`Paired device with Cloudflare R2 workspace "${cfg.workspaceId}"!`);
      setTimeout(() => syncNow(), 400);
    } catch (_) {}
  }

  /* ========================================================================
     UI RENDERING (Matches Uploaded Screenshot Aesthetic!)
     ======================================================================== */
  function cacheDOM() {
    dom = {
      endpointLabel: document.getElementById("cloud-endpoint-label"),
      backupStatusSub: document.getElementById("cloud-backup-status-sub"),
      syncStatusSub: document.getElementById("cloud-sync-status-sub"),
      btnBackupNow: document.getElementById("cloud-btn-backup-now"),
      btnSyncNow: document.getElementById("cloud-btn-sync-now"),
      btnAddPhone: document.getElementById("cloud-btn-add-phone"),
      toggleAuto: document.getElementById("cloud-toggle-auto"),
      backupsList: document.getElementById("cloud-backups-list"),
      btnToggleConfig: document.getElementById("cloud-btn-toggle-config"),
      configBox: document.getElementById("cloud-r2-config-box"),
      // Config Inputs
      inpMode: document.getElementById("r2-mode"),
      wrapWorker: document.getElementById("r2-worker-fields"),
      wrapDirect: document.getElementById("r2-direct-fields"),
      inpWorkerUrl: document.getElementById("r2-worker-url"),
      inpEndpoint: document.getElementById("r2-endpoint"),
      inpBucket: document.getElementById("r2-bucket"),
      inpAccessKey: document.getElementById("r2-access-key"),
      inpSecretKey: document.getElementById("r2-secret-key"),
      inpWorkspace: document.getElementById("r2-workspace-id"),
      inpDevice: document.getElementById("r2-device-name"),
      inpSyncToken: document.getElementById("r2-sync-token"),
      btnSaveConfig: document.getElementById("r2-btn-save-config"),
      // Security Sub-tab Inputs
      toggleEncrypt: document.getElementById("sec-toggle-encrypt"),
      inpMasterPass: document.getElementById("sec-master-password"),
      btnSaveSecurity: document.getElementById("sec-btn-save"),
      // Phone Pairing Modal
      pairBackdrop: document.getElementById("pair-modal-backdrop"),
      pairUrlInput: document.getElementById("pair-url-output"),
      pairQrBox: document.getElementById("pair-qr-box"),
      btnCopyPair: document.getElementById("pair-btn-copy"),
      btnClosePair: document.getElementById("pair-btn-close")
    };
  }

  function renderCloudUI() {
    if (!dom.endpointLabel) return;

    // Row 1: R2 Endpoint Display
    if (cfg.mode === "direct-r2" && cfg.r2Endpoint) {
      dom.endpointLabel.textContent = `${cfg.r2Endpoint.replace(/^https?:\/\//, "")}/${cfg.r2Bucket}`;
    } else if (cfg.workerUrl) {
      const hostDisp = cfg.workerUrl.startsWith("/") ? `${window.location.host || "rgeprojecttracker.pages.dev"}${cfg.workerUrl}` : cfg.workerUrl.replace(/^https?:\/\//, "");
      dom.endpointLabel.textContent = `${hostDisp} (${cfg.r2Bucket || "rge-r2"})`;
    } else {
      dom.endpointLabel.textContent = "Cloudflare R2 not configured yet — click Configure";
    }

    dom.backupStatusSub.textContent = cfg.lastBackupAt
      ? `Last backed up ${formatRelativeTime(cfg.lastBackupAt)}${cfg.encryptEnabled ? " • AES-256 Encrypted" : ""}`
      : "Not backed up yet this session.";

    // Row 2: Sync status
    dom.syncStatusSub.textContent = cfg.lastSyncAt
      ? `Synced with ${cfg.lastSyncedDevice || cfg.deviceName} · ${formatRelativeTime(cfg.lastSyncAt)}`
      : `Device: ${cfg.deviceName} · Ready to sync across devices`;

    dom.toggleAuto.checked = Boolean(cfg.autoBackup);

    // Populate Config Form
    dom.inpMode.value = cfg.mode;
    dom.wrapWorker.hidden = cfg.mode !== "worker";
    dom.wrapDirect.hidden = cfg.mode !== "direct-r2";
    dom.inpWorkerUrl.value = cfg.workerUrl || "";
    dom.inpEndpoint.value = cfg.r2Endpoint || "";
    dom.inpBucket.value = cfg.r2Bucket || "";
    dom.inpAccessKey.value = cfg.r2AccessKeyId || "";
    dom.inpSecretKey.value = cfg.r2SecretAccessKey || "";
    dom.inpWorkspace.value = cfg.workspaceId || "rge-main";
    dom.inpDevice.value = cfg.deviceName || defaultDeviceName();
    dom.inpSyncToken.value = cfg.syncToken || "";

    // Security Form
    if (dom.toggleEncrypt) dom.toggleEncrypt.checked = Boolean(cfg.encryptEnabled);
    if (dom.inpMasterPass) dom.inpMasterPass.value = cfg.masterPassword || "";

    // Backups History List
    const snaps = loadLocalSnapshots();
    if (snaps.length === 0) {
      dom.backupsList.innerHTML = `<div class="cb-empty">No backups created yet. Click <strong>Back up now</strong> above to create your first snapshot.</div>`;
    } else {
      dom.backupsList.innerHTML = snaps
        .map(
          (s) => `
        <div class="cb-history-row">
          <div class="cb-history-info">
            <span class="cb-history-date">${esc(formatBackupTimestamp(s.timestamp))}</span>
            <span class="cb-history-meta">${esc(formatBytes(s.sizeBytes))} &bull; ${esc(s.source || "Local")} &bull; ${esc(s.deviceName || "RGE")}</span>
          </div>
          <button type="button" class="cb-restore-btn" data-restore-id="${esc(s.id)}">Restore</button>
        </div>`
        )
        .join("");
    }
  }

  function toggleConfigPanel(forceOpen) {
    if (!dom.configBox) return;
    const nextHidden = forceOpen === true ? false : !dom.configBox.hidden;
    dom.configBox.hidden = nextHidden;
  }

  function openPairModal() {
    const pairUrl = generatePairingURL();
    dom.pairUrlInput.value = pairUrl;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&color=1C305C&data=${encodeURIComponent(pairUrl)}`;
    dom.pairQrBox.innerHTML = `
      <img src="${qrSrc}" alt="QR Code to pair phone with RGE Project Tracker" width="180" height="180"
        onerror="this.style.display='none';this.nextElementSibling.hidden=false;" />
      <div class="pair-qr-fallback" hidden>Copy the pairing link below and open it on your phone browser.</div>`;
    dom.pairBackdrop.classList.add("is-open");
    dom.pairBackdrop.setAttribute("aria-hidden", "false");
  }

  function closePairModal() {
    dom.pairBackdrop.classList.remove("is-open");
    dom.pairBackdrop.setAttribute("aria-hidden", "true");
  }

  function init(callbacks) {
    hostCallbacks = callbacks;
    cacheDOM();
    if (!dom.endpointLabel) return;

    checkIncomingPairingHash();

    // Settings Inner Sub-Nav (General | Security | Backup | Import & Export)
    document.querySelectorAll("[data-settings-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = btn.getAttribute("data-settings-sub");
        document.querySelectorAll("[data-settings-sub]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll("[data-settings-pane]").forEach((p) => {
          p.hidden = p.getAttribute("data-settings-pane") !== sub;
        });
      });
    });

    dom.btnBackupNow.addEventListener("click", () => backupNow(false));
    dom.btnSyncNow.addEventListener("click", syncNow);
    dom.btnAddPhone.addEventListener("click", openPairModal);
    dom.btnToggleConfig.addEventListener("click", () => toggleConfigPanel());

    dom.toggleAuto.addEventListener("change", (e) => {
      cfg.autoBackup = e.target.checked;
      saveConfig();
      toast(cfg.autoBackup ? "Automatic cloud backup enabled." : "Automatic cloud backup paused.");
    });

    dom.inpMode.addEventListener("change", (e) => {
      dom.wrapWorker.hidden = e.target.value !== "worker";
      dom.wrapDirect.hidden = e.target.value !== "direct-r2";
    });

    dom.btnSaveConfig.addEventListener("click", () => {
      cfg.mode = dom.inpMode.value;
      cfg.workerUrl = dom.inpWorkerUrl.value.trim();
      cfg.r2Endpoint = dom.inpEndpoint.value.trim();
      cfg.r2Bucket = dom.inpBucket.value.trim() || "rge-project-tracker";
      cfg.r2AccessKeyId = dom.inpAccessKey.value.trim();
      cfg.r2SecretAccessKey = dom.inpSecretKey.value.trim();
      cfg.workspaceId = dom.inpWorkspace.value.trim() || "rge-main";
      cfg.deviceName = dom.inpDevice.value.trim() || defaultDeviceName();
      cfg.syncToken = dom.inpSyncToken.value.trim();
      saveConfig();
      renderCloudUI();
      toggleConfigPanel(false);
      toast("Cloudflare R2 sync settings saved.");
    });

    if (dom.btnSaveSecurity) {
      dom.btnSaveSecurity.addEventListener("click", () => {
        cfg.encryptEnabled = dom.toggleEncrypt.checked;
        cfg.masterPassword = dom.inpMasterPass.value;
        if (cfg.encryptEnabled && cfg.masterPassword.length < 6) {
          toast("Please use a Master Password of at least 6 characters.");
          return;
        }
        saveConfig();
        renderCloudUI();
        toast(cfg.encryptEnabled ? "AES-256-GCM encryption enabled for R2 backups." : "Encryption disabled.");
      });
    }

    dom.backupsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-restore-id]");
      if (btn) restoreSnapshotById(btn.getAttribute("data-restore-id"));
    });

    dom.btnCopyPair.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(dom.pairUrlInput.value);
        toast("Pairing link copied! Open it on your phone or another laptop.");
      } catch (_) {
        dom.pairUrlInput.select();
        document.execCommand("copy");
        toast("Pairing link copied!");
      }
    });

    dom.btnClosePair.addEventListener("click", closePairModal);
    dom.pairBackdrop.addEventListener("click", (e) => {
      if (e.target === dom.pairBackdrop) closePairModal();
    });

    renderCloudUI();
  }

  return { init, renderCloudUI, scheduleAutoBackup, backupNow, syncNow };
})();
