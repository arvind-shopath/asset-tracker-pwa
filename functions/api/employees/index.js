import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

// GET: List employees
export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    let employees = [];

    // Try KV first
    if (env.KV) {
      employees = (await env.KV.get("users_list", "json")) || [];
    }

    // Try D1 if KV is empty
    if ((!employees || employees.length === 0) && env.DB) {
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, phone, role, created_at FROM users WHERE is_active = 1 ORDER BY name ASC"
        ).all();
        if (results && results.length > 0) employees = results;
      } catch (e) {
        console.warn("D1 employees query warning:", e);
      }
    }

    if (!employees || employees.length === 0) {
      employees = [
        { id: 1, name: "Administrator", phone: "9876543210", role: "admin" },
        { id: 2, name: "Rahul Sharma", phone: "9876543211", role: "employee" },
      ];
    }

    return jsonResponse({ success: true, employees });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// POST: Add new Employee (Admin Only)
export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);
  if (user.role !== "admin") return errorResponse("Only administrators can add staff members.", 403);

  try {
    const { name, phone, pin } = await request.json();
    if (!name || !phone || !pin) {
      return errorResponse("Full name, phone number, and 4-digit PIN are required.", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanPin = String(pin).trim();
    const cleanName = String(name).trim();

    const newEmp = {
      id: Date.now(),
      name: cleanName,
      phone: cleanPhone,
      pin: cleanPin,
      role: "employee",
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    // Save into KV
    if (env.KV) {
      await env.KV.put(`user:${cleanPhone}`, JSON.stringify(newEmp));
      const list = (await env.KV.get("users_list", "json")) || [
        { id: 1, name: "Administrator", phone: "9876543210", role: "admin", is_active: 1 },
        { id: 2, name: "Rahul Sharma", phone: "9876543211", role: "employee", is_active: 1 },
      ];
      list.push(newEmp);
      await env.KV.put("users_list", JSON.stringify(list));
    }

    // Save into D1
    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO users (name, phone, pin, role) VALUES (?, ?, ?, 'employee')"
        ).bind(cleanName, cleanPhone, cleanPin).run();
      } catch (e) {
        console.warn("D1 insert warning:", e);
      }
    }

    return jsonResponse({
      success: true,
      message: "Employee added successfully.",
      id: newEmp.id,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// DELETE: Remove Employee (Admin Only)
export async function onRequestDelete({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);
  if (user.role !== "admin") return errorResponse("Only administrators can remove staff members.", 403);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const phone = url.searchParams.get("phone");
    if (!id && !phone) return errorResponse("Employee ID or phone number is required.", 400);

    if (env.KV) {
      if (phone) await env.KV.delete(`user:${phone}`);
      let list = (await env.KV.get("users_list", "json")) || [];
      list = list.filter((e) => String(e.id) !== String(id) && e.phone !== phone);
      await env.KV.put("users_list", JSON.stringify(list));
    }

    if (env.DB && id) {
      try {
        await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(id).run();
      } catch (e) {
        console.warn("D1 delete warning:", e);
      }
    }

    return jsonResponse({ success: true, message: "Employee removed successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
