/**
 * Cloudflare Pages Function — RGE Project Tracker R2 Cloud Backup & Sync API
 * File location: functions/api/sync.js
 *
 * Setup in Cloudflare Pages Dashboard:
 *   1. Create an R2 Bucket (e.g., "rge-project-tracker")
 *   2. Go to Pages -> your project (rgeprojecttracker) -> Settings -> Functions -> R2 bucket bindings
 *   3. Add binding: Variable name = RGE_BUCKET, R2 bucket = rge-project-tracker
 *   4. (Optional) Add Environment Variable: SYNC_SECRET = <your team secret passphrase>
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  if (!env.RGE_BUCKET) {
    return jsonResponse({ error: "RGE_BUCKET R2 binding not configured in Cloudflare Pages." }, 500);
  }
  if (env.SYNC_SECRET && request.headers.get("X-Sync-Key") !== env.SYNC_SECRET) {
    return jsonResponse({ error: "Unauthorized: Invalid Sync Key." }, 401);
  }

  const url = new URL(request.url);
  const workspace = (url.searchParams.get("workspace") || "rge-main").replace(/[^a-zA-Z0-9_-]/g, "");
  const action = url.searchParams.get("action") || "latest";

  // Fetch specific historical backup by ID
  if (action === "get") {
    const id = (url.searchParams.get("id") || "").replace(/[^a-zA-Z0-9._-]/g, "");
    const obj = await env.RGE_BUCKET.get(`${workspace}/history/${id}`);
    if (!obj) return jsonResponse({ error: "Backup snapshot not found." }, 404);
    return jsonResponse({ id, payload: await obj.text() });
  }

  // Default: fetch latest snapshot + list of recent backups
  const latestObj = await env.RGE_BUCKET.get(`${workspace}/latest.json`);
  if (!latestObj) {
    return jsonResponse({ error: "No cloud backup found for this workspace yet." }, 404);
  }

  const listed = await env.RGE_BUCKET.list({ prefix: `${workspace}/history/`, limit: 20 });
  const backups = (listed.objects || [])
    .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
    .slice(0, 12)
    .map((o) => ({
      id: o.key.split("/").pop(),
      timestamp: o.customMetadata?.timestamp || o.uploaded.toISOString(),
      deviceName: o.customMetadata?.deviceName || "Cloud R2",
      sizeBytes: o.size
    }));

  return jsonResponse({
    payload: await latestObj.text(),
    backups
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.RGE_BUCKET) {
    return jsonResponse({ error: "RGE_BUCKET R2 binding not configured in Cloudflare Pages." }, 500);
  }
  if (env.SYNC_SECRET && request.headers.get("X-Sync-Key") !== env.SYNC_SECRET) {
    return jsonResponse({ error: "Unauthorized: Invalid Sync Key." }, 401);
  }

  const url = new URL(request.url);
  const workspace = (url.searchParams.get("workspace") || "rge-main").replace(/[^a-zA-Z0-9_-]/g, "");
  const body = await request.json();

  if (!body || !body.payload) {
    return jsonResponse({ error: "Missing backup payload." }, 400);
  }

  const id = (body.id || `backup-${Date.now()}.json`).replace(/[^a-zA-Z0-9._-]/g, "");
  const metadata = {
    timestamp: body.timestamp || new Date().toISOString(),
    deviceName: body.deviceName || "RGE-DEVICE"
  };

  // Save both latest pointer and timestamped versioned backup in R2
  await Promise.all([
    env.RGE_BUCKET.put(`${workspace}/latest.json`, body.payload, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: metadata
    }),
    env.RGE_BUCKET.put(`${workspace}/history/${id}`, body.payload, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: metadata
    })
  ]);

  return jsonResponse({ ok: true, id, ...metadata });
}
