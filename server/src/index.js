/* Relais distant AINM : le serveur ne reçoit que des rapports chiffrés côté téléphone. */

const JSON_HEADERS = { "content-type": "application/json; charset=UTF-8" };
const REPORT_TTL_DAYS_DEFAULT = 14;

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || !env.ALLOWED_ORIGIN || origin === env.ALLOWED_ORIGIN;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, PUT, OPTIONS",
      "access-control-allow-headers": "Content-Type, X-AINM-Report-Token",
      "access-control-max-age": "86400",
      vary: "Origin",
    };
  }
  return { vary: "Origin" };
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...corsHeaders(request, env) } });
}

function badOrigin(request, env) {
  return json(request, env, { error: "origin_forbidden", message: "Origine non autorisée." }, 403);
}

function isPayload(value) {
  if (!value || value.schema !== "AINM-RJ-REMOTE-1" || value.algorithm !== "A256GCM") return false;
  if (typeof value.iv !== "string" || typeof value.cipherText !== "string") return false;
  return value.iv.length <= 80 && value.cipherText.length > 30 && value.cipherText.length <= 33 * 1024 * 1024;
}

function sameSecret(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

async function tokenHash(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function expiryFrom(env) {
  const days = Math.max(1, Math.min(30, Number(env.REPORT_TTL_DAYS) || REPORT_TTL_DAYS_DEFAULT));
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

export class ReportRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (!allowedOrigin(request, this.env)) return badOrigin(request, this.env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, this.env) });
    if (!["GET", "PUT"].includes(request.method)) return json(request, this.env, { error: "method_not_allowed" }, 405);

    const token = request.headers.get("X-AINM-Report-Token") || "";
    if (token.length < 20 || token.length > 120) return json(request, this.env, { error: "unauthorized" }, 401);
    const hashedToken = await tokenHash(token);
    const record = await this.ctx.storage.get("report");
    if (record?.expiresAt && record.expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      return json(request, this.env, { error: "not_found", message: "Cette passation a expiré." }, 404);
    }

    if (request.method === "GET") {
      if (!record) return json(request, this.env, { error: "not_found" }, 404);
      if (!sameSecret(record.tokenHash, hashedToken)) return json(request, this.env, { error: "unauthorized" }, 401);
      return json(request, this.env, { revision: record.revision, updatedAt: record.updatedAt, expiresAt: record.expiresAt, payload: record.payload });
    }

    let body;
    try { body = await request.json(); } catch (_) { return json(request, this.env, { error: "invalid_json" }, 400); }
    const baseRevision = Number.isInteger(body?.baseRevision) && body.baseRevision >= 0 ? body.baseRevision : -1;
    if (baseRevision < 0 || !isPayload(body?.payload)) return json(request, this.env, { error: "invalid_payload" }, 400);

    if (record) {
      if (!sameSecret(record.tokenHash, hashedToken)) return json(request, this.env, { error: "unauthorized" }, 401);
      if (baseRevision !== record.revision) {
        return json(request, this.env, { error: "conflict", message: "Une version plus récente existe déjà.", revision: record.revision, updatedAt: record.updatedAt }, 409);
      }
    } else if (baseRevision !== 0) {
      return json(request, this.env, { error: "conflict", message: "Cette passation doit être initialisée à la révision 0." }, 409);
    }

    const updatedAt = new Date().toISOString();
    const next = {
      tokenHash: record?.tokenHash || hashedToken,
      revision: (record?.revision || 0) + 1,
      updatedAt,
      expiresAt: expiryFrom(this.env),
      payload: body.payload,
    };
    await this.ctx.storage.put("report", next);
    await this.ctx.storage.setAlarm(next.expiresAt);
    return json(request, this.env, { revision: next.revision, updatedAt: next.updatedAt, expiresAt: next.expiresAt }, 200);
  }

  async alarm() {
    const record = await this.ctx.storage.get("report");
    if (!record) return;
    if (record.expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(record.expiresAt);
  }
}

export default {
  async fetch(request, env) {
    if (!allowedOrigin(request, env)) return badOrigin(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json(request, env, { ok: true, service: "AINM report relay" });
    const match = /^\/reports\/([A-Za-z0-9_-]{16,80})$/.exec(url.pathname);
    if (!match) return json(request, env, { error: "not_found" }, 404);
    const id = env.REPORT_ROOM.idFromName(`ainm-report:${match[1]}`);
    return env.REPORT_ROOM.get(id).fetch(request);
  },
};
