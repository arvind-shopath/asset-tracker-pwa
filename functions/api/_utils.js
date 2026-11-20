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

// Universal Product Lookup (KV individual key -> KV products_list -> D1 -> Demo seed fallback)
export async function findProduct(env, serialNumber) {
  if (!serialNumber) return null;
  const cleanSerial = String(serialNumber).trim();

  // 1. Try KV individual key
  if (env.KV) {
    try {
      const p = await env.KV.get(`product:${cleanSerial}`, "json");
      if (p) return p;
    } catch (e) {}
  }

  // 2. Try KV products_list (case-insensitive)
  if (env.KV) {
    try {
      const list = (await env.KV.get("products_list", "json")) || [];
      const p = list.find((item) => String(item.serial_number || "").trim().toUpperCase() === cleanSerial.toUpperCase());
      if (p) return p;
    } catch (e) {}
  }

  // 3. Try D1
  if (env.DB) {
    try {
      const p = await env.DB.prepare("SELECT * FROM products WHERE UPPER(serial_number) = UPPER(?)").bind(cleanSerial).first();
      if (p) return p;
    } catch (e) {}
  }

  // 4. In-memory demo products fallback
  if (cleanSerial.toUpperCase() === "SN-INST-2026-01") {
    return {
      id: 1,
      serial_number: "SN-INST-2026-01",
      name: "Commercial Water Purification RO Unit",
      model: "AquaPro-50X",
      supplier: "Ion Exchange Tech",
      current_status: "installed",
      storage_location: "Rack A-04, Shelf 2",
      assigned_to_name: "Dinesh Verma",
      assigned_to_phone: "9876543212",
      customer_name: "Arvind Shukla",
      customer_phone: "9876543210",
      customer_address: "56, Rajajipuram, Lucknow, UP",
      gps_lat: 26.80976,
      gps_lng: 80.89140,
      installed_photo_key: "inst_sn_inst_2026_01.webp",
      updated_at: "2026-11-20T11:45:00.000Z",
      created_at: "2026-11-20T09:30:00.000Z",
    };
  }
  if (cleanSerial.toUpperCase() === "SN-RET-2026-02") {
    return {
      id: 2,
      serial_number: "SN-RET-2026-02",
      name: "Industrial Digital Flow Sensor Meter",
      model: "FlowSense-V2",
      supplier: "Sensotech Precision",
      current_status: "rejected",
      storage_location: "Rack B-01, Shelf 3",
      assigned_to_name: "Manoj Singh",
      assigned_to_phone: "9876543213",
      customer_name: "Rajesh Patel",
      customer_phone: "9811223344",
      rejected_reason: "Packaging Damaged during transit / Outer casing dent",
      pickup_person_name: "Vinay Kumar",
      pickup_person_phone: "9876543214",
      pickup_remarks: "BlueDart Waybill #BD-98273619-IN returned safely to Hub",
      updated_at: "2026-11-20T12:15:00.000Z",
      created_at: "2026-11-20T09:15:00.000Z",
    };
  }

  return null;
}

export async function saveProduct(env, product) {
  const serial = product.serial_number;
  if (env.KV) {
    try {
      await env.KV.put(`product:${serial}`, JSON.stringify(product));
      let list = (await env.KV.get("products_list", "json")) || [];
      const idx = list.findIndex((p) => p.serial_number === serial);
      if (idx >= 0) {
        list[idx] = product;
      } else {
        list.unshift(product);
      }
      await env.KV.put("products_list", JSON.stringify(list));
    } catch (e) {}
  }

  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO products 
         (serial_number, name, model, supplier, current_status, storage_location, assigned_to_name, assigned_to_phone, customer_name, customer_phone, customer_address, gps_lat, gps_lng, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        product.serial_number,
        product.name || "",
        product.model || "",
        product.supplier || "",
        product.current_status,
        product.storage_location || null,
        product.assigned_to_name || null,
        product.assigned_to_phone || null,
        product.customer_name || null,
        product.customer_phone || null,
        product.customer_address || null,
        product.gps_lat || null,
        product.gps_lng || null
      ).run();
    } catch (e) {}
  }
}
