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
    mobile: user.mobile || user.phone,
    phone: user.mobile || user.phone,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const payloadStr = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
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
    const payload = JSON.parse(decodeURIComponent(escape(atob(payloadStr))));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// -------------------------------------------------------------
// DEFAULT IN-MEMORY SEED MASTER DATA
// -------------------------------------------------------------
export const DEFAULT_USERS = [
  { id: 1, name: "Administrator", mobile: "9876543210", phone: "9876543210", pin_or_password: "1234", pin: "1234", role: "admin", is_active: 1 },
  { id: 2, name: "Production Admin", mobile: "8400600379", phone: "8400600379", pin_or_password: "Ait@600379", pin: "Ait@600379", role: "admin", is_active: 1 },
  { id: 3, name: "Rahul Sharma", mobile: "9876543211", phone: "9876543211", pin_or_password: "1234", pin: "1234", role: "in_house_staff", is_active: 1 },
  { id: 4, name: "Amit Verma", mobile: "9876543212", phone: "9876543212", pin_or_password: "1234", pin: "1234", role: "in_house_staff", is_active: 1 },
  { id: 5, name: "Vishal Kumar", mobile: "9876543213", phone: "9876543213", pin_or_password: "1234", pin: "1234", role: "third_party_tech", is_active: 1 },
  { id: 6, name: "Sonu Singh", mobile: "9876543214", phone: "9876543214", pin_or_password: "1234", pin: "1234", role: "third_party_tech", is_active: 1 },
  { id: 7, name: "Deepak Gupta", mobile: "9876543215", phone: "9876543215", pin_or_password: "1234", pin: "1234", role: "third_party_tech", is_active: 1 },
];

export const DEFAULT_CATEGORIES = [
  { id: 1, name_en: "Television (TV)", name_hi: "टेलीविज़न (TV)" },
  { id: 2, name_en: "Refrigerator / Fridge", name_hi: "रेफ्रिजरेटर / फ्रिज" },
  { id: 3, name_en: "Air Conditioner (AC)", name_hi: "एयर कंडीशनर (AC)" },
  { id: 4, name_en: "Washing Machine", name_hi: "वाशिंग मशीन" },
  { id: 5, name_en: "Microwave Oven", name_hi: "माइक्रोवेव ओवन" },
  { id: 6, name_en: "Air Cooler", name_hi: "एयर कूलर" },
  { id: 7, name_en: "Spare Parts & PCB", name_hi: "स्पेयर पार्ट्स एवं पीसीबी" },
];

export const DEFAULT_RATE_CARDS = [
  { id: 1, service_title_en: "32\" TV Standard Wall Mount Installation", service_title_hi: "32\" टीवी वाल माउंट इंस्टॉलेशन", fixed_amount: 300 },
  { id: 2, service_title_en: "43\" - 55\" Smart 4K TV Installation", service_title_hi: "43\" - 55\" स्मार्ट 4K टीवी इंस्टॉलेशन", fixed_amount: 450 },
  { id: 3, service_title_en: "Split AC General Service & Jet Wash", service_title_hi: "स्प्लिट एसी सर्विस एवं जेट वाश", fixed_amount: 600 },
  { id: 4, service_title_en: "Double Door Refrigerator Gas Charging", service_title_hi: "डबल डोर फ्रिज गैस चार्जिंग", fixed_amount: 850 },
  { id: 5, service_title_en: "Fully Automatic Washing Machine Motor Fix", service_title_hi: "फुल्ली ऑटोमैटिक वाशिंग मशीन मोटर रिपेयर", fixed_amount: 500 },
  { id: 6, service_title_en: "Microwave High-Voltage Magnetron Replacement", service_title_hi: "माइक्रोवेव मैग्नेट्रॉन रिप्लेसमेंट", fixed_amount: 400 },
];

// User Lookup Helper
export async function findUser(env, mobile, pin = null) {
  const cleanMobile = String(mobile).trim();

  // Try KV
  if (env.KV) {
    try {
      const kvUser = await env.KV.get(`user:${cleanMobile}`, "json");
      if (kvUser) {
        const userPin = kvUser.pin_or_password || kvUser.pin;
        if (pin !== null && String(userPin).trim() !== String(pin).trim()) {
          return null;
        }
        return kvUser;
      }
    } catch (e) {}
  }

  // Try D1
  if (env.DB) {
    try {
      let query = "SELECT id, name, mobile, pin_or_password, role, is_active FROM users WHERE (mobile = ? OR mobile = ?) AND is_active = 1";
      const params = [cleanMobile, cleanMobile];
      const dbRow = await env.DB.prepare(query).bind(...params).first();
      if (dbRow) {
        const userPin = dbRow.pin_or_password;
        if (pin !== null && String(userPin).trim() !== String(pin).trim()) {
          return null;
        }
        return { ...dbRow, phone: dbRow.mobile };
      }
    } catch (e) {}
  }

  // Fallback to in-memory list
  const matched = DEFAULT_USERS.find((u) => u.mobile === cleanMobile || u.phone === cleanMobile);
  if (matched && (pin === null || String(pin).trim() === String(matched.pin_or_password || matched.pin).trim())) {
    return matched;
  }

  return null;
}

export async function getUsers(env) {
  if (env.KV) {
    try {
      const list = await env.KV.get("users_list", "json");
      if (list && list.length > 0) return list;
    } catch (e) {}
  }
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT id, name, mobile, role, is_active, created_at FROM users ORDER BY id ASC").all();
      if (results && results.length > 0) return results.map(r => ({ ...r, phone: r.mobile }));
    } catch (e) {}
  }
  return DEFAULT_USERS;
}

export async function getCategories(env) {
  if (env.KV) {
    try {
      const list = await env.KV.get("categories_list", "json");
      if (list && list.length > 0) return list;
    } catch (e) {}
  }
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM categories ORDER BY id ASC").all();
      if (results && results.length > 0) return results;
    } catch (e) {}
  }
  return DEFAULT_CATEGORIES;
}

export async function saveCategory(env, category) {
  const list = await getCategories(env);
  const existingIdx = list.findIndex(c => c.id === category.id);
  if (existingIdx >= 0) {
    list[existingIdx] = category;
  } else {
    category.id = category.id || Date.now();
    list.push(category);
  }
  if (env.KV) {
    try { await env.KV.put("categories_list", JSON.stringify(list)); } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare("INSERT OR REPLACE INTO categories (id, name_en, name_hi) VALUES (?, ?, ?)").bind(category.id, category.name_en, category.name_hi).run();
    } catch (e) {}
  }
  return category;
}

export async function getInventory(env) {
  if (env.KV) {
    try {
      const list = await env.KV.get("inventory_list", "json");
      if (list && list.length > 0) return list;
    } catch (e) {}
  }
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM inventory_items ORDER BY id DESC").all();
      if (results && results.length > 0) return results;
    } catch (e) {}
  }
  return [];
}

export async function findInventoryItem(env, serialNumber) {
  if (!serialNumber) return null;
  const clean = String(serialNumber).trim().toUpperCase();
  if (env.KV) {
    try {
      const direct = await env.KV.get(`item:${clean}`, "json");
      if (direct) return direct;
    } catch (e) {}
  }
  const all = await getInventory(env);
  return all.find(i => String(i.serial_number || "").trim().toUpperCase() === clean) || null;
}

export async function saveInventoryItem(env, item) {
  const serial = String(item.serial_number).trim();
  const all = await getInventory(env);
  const idx = all.findIndex(i => String(i.serial_number).trim().toUpperCase() === serial.toUpperCase());
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...item };
  } else {
    item.id = item.id || Date.now();
    all.unshift(item);
  }
  if (env.KV) {
    try {
      await env.KV.put("inventory_list", JSON.stringify(all));
      await env.KV.put(`item:${serial.toUpperCase()}`, JSON.stringify(item));
    } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO inventory_items 
        (id, category_id, part_name, model_number, serial_number, status, current_holder_id, invoice_image_url, challan_number, return_slip_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        item.id, item.category_id || null, item.part_name, item.model_number || "",
        item.serial_number, item.status || "received", item.current_holder_id || null,
        item.invoice_image_url || null, item.challan_number || null, item.return_slip_url || null
      ).run();
    } catch (e) {}
  }
  return item;
}

export async function getCompanyAssets(env, userId = null) {
  let list = [];
  if (env.KV) {
    try {
      list = (await env.KV.get("company_assets_list", "json")) || [];
    } catch (e) {}
  }
  if ((!list || list.length === 0) && env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM company_assets ORDER BY id ASC").all();
      if (results) list = results;
    } catch (e) {}
  }
  if (userId) {
    return list.filter(a => String(a.user_id) === String(userId));
  }
  return list;
}

export async function saveCompanyAsset(env, asset) {
  const all = await getCompanyAssets(env);
  const idx = all.findIndex(a => a.id === asset.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...asset };
  } else {
    asset.id = asset.id || Date.now();
    all.push(asset);
  }
  if (env.KV) {
    try { await env.KV.put("company_assets_list", JSON.stringify(all)); } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare("INSERT OR REPLACE INTO company_assets (id, user_id, asset_name, asset_code, status) VALUES (?, ?, ?, ?, ?)")
        .bind(asset.id, asset.user_id, asset.asset_name, asset.asset_code || "", asset.status || "active").run();
    } catch (e) {}
  }
  return asset;
}

export async function getRateCards(env) {
  if (env.KV) {
    try {
      const list = await env.KV.get("rate_cards_list", "json");
      if (list && list.length > 0) return list;
    } catch (e) {}
  }
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM rate_cards ORDER BY id ASC").all();
      if (results && results.length > 0) return results;
    } catch (e) {}
  }
  return DEFAULT_RATE_CARDS;
}

export async function saveRateCard(env, rc) {
  const all = await getRateCards(env);
  const idx = all.findIndex(r => r.id === rc.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...rc };
  } else {
    rc.id = rc.id || Date.now();
    all.push(rc);
  }
  if (env.KV) {
    try { await env.KV.put("rate_cards_list", JSON.stringify(all)); } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare("INSERT OR REPLACE INTO rate_cards (id, service_title_en, service_title_hi, fixed_amount) VALUES (?, ?, ?, ?)")
        .bind(rc.id, rc.service_title_en, rc.service_title_hi, rc.fixed_amount).run();
    } catch (e) {}
  }
  return rc;
}

export async function getServiceCalls(env, techId = null) {
  let list = [];
  if (env.KV) {
    try {
      list = (await env.KV.get("service_calls_list", "json")) || [];
    } catch (e) {}
  }
  if ((!list || list.length === 0) && env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM service_calls ORDER BY id DESC").all();
      if (results) list = results;
    } catch (e) {}
  }
  if (techId) {
    return list.filter(c => String(c.assigned_tech_id) === String(techId));
  }
  return list;
}

export async function findServiceCall(env, complaintOrId) {
  const all = await getServiceCalls(env);
  const clean = String(complaintOrId).trim().toUpperCase();
  return all.find(c => String(c.id) === clean || String(c.complaint_number || "").trim().toUpperCase() === clean) || null;
}

export async function saveServiceCall(env, call) {
  const all = await getServiceCalls(env);
  const idx = all.findIndex(c => c.id === call.id || (call.complaint_number && c.complaint_number === call.complaint_number));
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...call };
  } else {
    call.id = call.id || Date.now();
    all.unshift(call);
  }
  if (env.KV) {
    try { await env.KV.put("service_calls_list", JSON.stringify(all)); } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO service_calls
        (id, complaint_number, customer_name, customer_mobile, customer_address, rate_card_id, assigned_tech_id, used_part_id, tech_payout_amount, admin_edited_amount, admin_edit_remark, customer_extra_collected, customer_extra_remark, status, payout_status, payment_batch_id, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        call.id, call.complaint_number, call.customer_name, call.customer_mobile, call.customer_address || "",
        call.rate_card_id || null, call.assigned_tech_id || null, call.used_part_id || null,
        call.tech_payout_amount || 0, call.admin_edited_amount || null, call.admin_edit_remark || null,
        call.customer_extra_collected || 0, call.customer_extra_remark || null,
        call.status || "pending", call.payout_status || "unpaid", call.payment_batch_id || null,
        call.completed_at || null
      ).run();
    } catch (e) {}
  }
  return call;
}

export async function getPaymentBatches(env, techId = null) {
  let list = [];
  if (env.KV) {
    try {
      list = (await env.KV.get("payment_batches_list", "json")) || [];
    } catch (e) {}
  }
  if ((!list || list.length === 0) && env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM payment_batches ORDER BY id DESC").all();
      if (results) list = results;
    } catch (e) {}
  }
  if (techId) {
    return list.filter(b => String(b.tech_id) === String(techId));
  }
  return list;
}

export async function savePaymentBatch(env, batch) {
  const all = await getPaymentBatches(env);
  batch.id = batch.id || Date.now();
  batch.paid_at = batch.paid_at || new Date().toISOString();
  all.unshift(batch);
  if (env.KV) {
    try { await env.KV.put("payment_batches_list", JSON.stringify(all)); } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare("INSERT INTO payment_batches (id, tech_id, amount_paid, payment_screenshot_url, remarks, paid_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(batch.id, batch.tech_id, batch.amount_paid, batch.payment_screenshot_url || "", batch.remarks || "", batch.paid_at).run();
    } catch (e) {}
  }
  return batch;
}

// Audit Logs
export async function recordAudit(env, { entity_type, entity_id, action_by_user_id, assigned_to_user_id = null, action_description_en, action_description_hi }) {
  const record = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    entity_type,
    entity_id,
    action_by_user_id,
    assigned_to_user_id,
    action_description_en,
    action_description_hi,
    is_read: 0,
    created_at: new Date().toISOString(),
  };

  let logs = [];
  if (env.KV) {
    try {
      logs = (await env.KV.get("audit_logs_list", "json")) || [];
      logs.unshift(record);
      await env.KV.put("audit_logs_list", JSON.stringify(logs.slice(0, 100)));
    } catch (e) {}
  }
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, entity_type, entity_id, action_by_user_id, assigned_to_user_id, action_description_en, action_description_hi, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        record.id, record.entity_type, record.entity_id, record.action_by_user_id,
        record.assigned_to_user_id, record.action_description_en, record.action_description_hi
      ).run();
    } catch (e) {}
  }
  return record;
}

export async function getAuditLogs(env, entityType = null, entityId = null) {
  let logs = [];
  if (env.KV) {
    try {
      logs = (await env.KV.get("audit_logs_list", "json")) || [];
    } catch (e) {}
  }
  if ((!logs || logs.length === 0) && env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all();
      if (results) logs = results;
    } catch (e) {}
  }
  if (entityType && entityId) {
    return logs.filter(l => l.entity_type === entityType && String(l.entity_id) === String(entityId));
  }
  return logs;
}
