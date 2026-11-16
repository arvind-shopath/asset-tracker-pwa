import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

// GET: List employees (both Admin and Employees can read for handover dropdown)
export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, phone, role, created_at FROM users WHERE is_active = 1 ORDER BY name ASC"
    ).all();

    return jsonResponse({ success: true, employees: results || [] });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// POST: Add new Employee (Admin Only)
export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);
  if (user.role !== "admin") return errorResponse("केवल एडमिन नए कर्मचारी जोड़ सकते हैं।", 403);

  try {
    const { name, phone, pin } = await request.json();
    if (!name || !phone || !pin) {
      return errorResponse("नाम, मोबाइल नंबर और 4-अंकीय PIN आवश्यक हैं।", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanPin = String(pin).trim();
    const cleanName = String(name).trim();

    // Check if phone already exists
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE phone = ?"
    ).bind(cleanPhone).first();

    if (existing) {
      return errorResponse("यह मोबाइल नंबर पहले से पंजीकृत है।", 400);
    }

    const result = await env.DB.prepare(
      "INSERT INTO users (name, phone, pin, role) VALUES (?, ?, ?, 'employee')"
    ).bind(cleanName, cleanPhone, cleanPin).run();

    return jsonResponse({
      success: true,
      message: "कर्मचारी सफलतापूर्वक जोड़ा गया।",
      id: result.meta?.last_row_id
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// DELETE: Deactivate/Remove Employee (Admin Only)
export async function onRequestDelete({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);
  if (user.role !== "admin") return errorResponse("केवल एडमिन कर्मचारी हटा सकते हैं।", 403);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Employee ID आवश्यक है।", 400);

    // Prevent deleting self
    if (parseInt(id) === user.id) {
      return errorResponse("आप स्वयं को नहीं हटा सकते।", 400);
    }

    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(id).run();

    return jsonResponse({ success: true, message: "कर्मचारी सफलतापूर्वक हटाया गया।" });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
