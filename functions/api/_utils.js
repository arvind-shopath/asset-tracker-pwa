// Cloudflare Pages Functions Utility Library
const JWT_SECRET = "asset-tracker-jwt-secret-key-2024-secure";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

// Generate simple HMAC signature using native Web Crypto API
async function signMessage(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createAuthToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days session
  };
  const payloadStr = btoa(JSON.stringify(payload));
  const sig = await signMessage(payloadStr, JWT_SECRET);
  return `${payloadStr}.${sig}`;
}

export async function verifyAuth(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadStr, sig] = parts;
  const expectedSig = await signMessage(payloadStr, JWT_SECRET);
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(atob(payloadStr));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function recordAudit(env, { productId, serialNumber, action, actor, details = {}, photoKey = null, gpsLat = null, gpsLng = null }) {
  await env.DB.prepare(
    `INSERT INTO audit_trail 
      (product_id, serial_number, action, actor_name, actor_phone, actor_role, details_json, photo_key, gps_lat, gps_lng) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    productId,
    serialNumber,
    action,
    actor.name,
    actor.phone,
    actor.role,
    JSON.stringify(details),
    photoKey,
    gpsLat,
    gpsLng
  ).run();
}
