/**
 * Cloudflare Pages Function — RGE Field Sites & Photos R2 Media Storage API
 * File location: functions/api/media.js
 *
 * Uses the exact same R2 bucket binding as /api/sync:
 *   Variable name = RGE_BUCKET
 *   Optional secret = SYNC_SECRET (checked via X-Sync-Key on POST/DELETE)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key"
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/* Stream an uploaded site photo directly from Cloudflare R2 */
export async function onRequestGet({ request, env }) {
  if (!env.RGE_BUCKET) {
    return jsonRes({ error: "RGE_BUCKET binding not configured." }, 500);
  }
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").replace(/[^a-zA-Z0-9/._-]/g, "");
  if (!key || !key.includes("/media/")) {
    return jsonRes({ error: "Invalid media key." }, 400);
  }

  const obj = await env.RGE_BUCKET.get(key);
  if (!obj) {
    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }

  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", obj.httpMetadata?.contentType || "image/webp");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { status: 200, headers });
}

/* Upload a compressed site photo into Cloudflare R2 */
export async function onRequestPost({ request, env }) {
  if (!env.RGE_BUCKET) {
    return jsonRes({ error: "RGE_BUCKET binding not configured." }, 500);
  }
  if (env.SYNC_SECRET && request.headers.get("X-Sync-Key") !== env.SYNC_SECRET) {
    return jsonRes({ error: "Unauthorized: Invalid Sync Key." }, 401);
  }

  const url = new URL(request.url);
  const ws = (url.searchParams.get("workspace") || "rge-main").replace(/[^a-zA-Z0-9_-]/g, "");
  const projectId = (url.searchParams.get("projectId") || "general").replace(/[^a-zA-Z0-9_-]/g, "");
  const photoId = (url.searchParams.get("photoId") || `img-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const contentType = request.headers.get("Content-Type") || "image/webp";
  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "webp";

  const key = `${ws}/media/${projectId}/${photoId}.${ext}`;
  const bytes = await request.arrayBuffer();
  if (!bytes || bytes.byteLength === 0) {
    return jsonRes({ error: "Empty image upload." }, 400);
  }

  await env.RGE_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
    customMetadata: { projectId, uploadedAt: new Date().toISOString() }
  });

  return jsonRes({
    ok: true,
    key,
    url: `/api/media?key=${encodeURIComponent(key)}`,
    sizeBytes: bytes.byteLength
  });
}

/* Delete a site photo from Cloudflare R2 */
export async function onRequestDelete({ request, env }) {
  if (!env.RGE_BUCKET) {
    return jsonRes({ error: "RGE_BUCKET binding not configured." }, 500);
  }
  if (env.SYNC_SECRET && request.headers.get("X-Sync-Key") !== env.SYNC_SECRET) {
    return jsonRes({ error: "Unauthorized: Invalid Sync Key." }, 401);
  }

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").replace(/[^a-zA-Z0-9/._-]/g, "");
  if (!key || !key.includes("/media/")) {
    return jsonRes({ error: "Invalid media key." }, 400);
  }

  await env.RGE_BUCKET.delete(key);
  return jsonRes({ ok: true, deleted: key });
}
