// Cloudflare Pages Functions Utility Library
const JWT_SECRET = "asset-tracker-enterprise-secret-key-2024";

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

// HMAC SHA-256 Signature using native Web Crypto API
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
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
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

// User Lookup Helper (Checks D1, falls back to KV)
export async function findUser(env, phone, pin = null) {
  const cleanPhone = String(phone).trim();

  // Try KV first (ultra fast, high throughput)
  if (env.KV) {
    try {
      const kvUser = await env.KV.get(`user:${cleanPhone}`, "json");
      if (kvUser) {
        if (pin !== null && String(kvUser.pin).trim() !== String(pin).trim()) {
          return null;
        }
        return kvUser;
      }
    } catch (e) {
      console.warn("KV findUser warning:", e);
    }
  }

  // Try D1
  if (env.DB) {
    try {
      let query = "SELECT id, name, phone, pin, role, is_active FROM users WHERE phone = ? AND is_active = 1";
      const params = [cleanPhone];
      if (pin !== null) {
        query += " AND pin = ?";
        params.push(String(pin).trim());
      }
      const dbRow = await env.DB.prepare(query).bind(...params).first();
      if (dbRow) return dbRow;
    } catch (e) {
      console.warn("D1 findUser warning:", e);
    }
  }

  // Built-in hardcoded fallback for seed testing
  const fallbackUsers = [
    { id: 1, name: "Administrator", phone: "9876543210", role: "admin", pin: "1234", is_active: 1 },
    { id: 2, name: "Rahul Sharma", phone: "9876543211", role: "employee", pin: "1234", is_active: 1 },
    { id: 3, name: "Dinesh Verma", phone: "9876543212", role: "employee", pin: "1234", is_active: 1 },
    { id: 4, name: "Manoj Singh", phone: "9876543213", role: "employee", pin: "1234", is_active: 1 },
    { id: 5, name: "Vinay Kumar", phone: "9876543214", role: "employee", pin: "1234", is_active: 1 },
  ];

  const matched = fallbackUsers.find((u) => u.phone === cleanPhone);
  if (matched && (pin === null || String(pin).trim() === matched.pin)) {
    return matched;
  }

  return null;
}

// Audit Trail Record Helper (Syncs to both D1 and KV)
export async function recordAudit(env, { productId, serialNumber, action, actor, details = {}, photoKey = null, gpsLat = null, gpsLng = null }) {
  const record = {
    id: Date.now(),
    productId,
    serialNumber,
    action,
    actorName: actor.name,
    actorPhone: actor.phone,
    actorRole: actor.role,
    details,
    photoKey,
    photoUrl: photoKey ? `/api/photo/${photoKey}` : null,
    gpsLat,
    gpsLng,
    timestamp: new Date().toISOString(),
  };

  // 1. Save into KV timeline list
  if (env.KV) {
    try {
      const existingTimeline = (await env.KV.get(`timeline:${serialNumber}`, "json")) || [];
      existingTimeline.push(record);
      await env.KV.put(`timeline:${serialNumber}`, JSON.stringify(existingTimeline));

      // Also update recent activity feed
      const recent = (await env.KV.get("recent_activity", "json")) || [];
      recent.unshift(record);
      await env.KV.put("recent_activity", JSON.stringify(recent.slice(0, 20)));
    } catch (kvErr) {
      console.warn("KV recordAudit warning:", kvErr);
    }
  }

  // 2. Save into D1
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO audit_trail 
          (product_id, serial_number, action, actor_name, actor_phone, actor_role, details_json, photo_key, gps_lat, gps_lng) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        productId || 0,
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
    } catch (d1Err) {
      console.warn("D1 recordAudit warning:", d1Err);
    }
  }

  return record;
}
