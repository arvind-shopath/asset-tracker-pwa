import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

// Strong Password Policy Validator (Enterprise Security)
export function validateStrongPassword(password) {
  if (!password || password.length < 8) {
    return "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए। (Password must be at least 8 characters)";
  }
  if (!/[A-Z]/.test(password)) {
    return "पासवर्ड में कम से कम एक बड़ा अक्षर (A-Z) होना अनिवार्य है। (Must contain at least 1 uppercase letter)";
  }
  if (!/[a-z]/.test(password)) {
    return "पासवर्ड में कम से कम एक छोटा अक्षर (a-z) होना अनिवार्य है। (Must contain at least 1 lowercase letter)";
  }
  if (!/\d/.test(password)) {
    return "पासवर्ड में कम से कम एक नंबर (0-9) होना अनिवार्य है। (Must contain at least 1 number)";
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return "पासवर्ड में कम से कम एक स्पेशल कैरेक्टर (@, #, $, %, !, &, * आदि) होना अनिवार्य है। (Must contain at least 1 special character)";
  }
  return null;
}

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
        { id: 3, name: "Dinesh Verma", phone: "9876543212", role: "employee" },
        { id: 4, name: "Manoj Singh", phone: "9876543213", role: "employee" },
        { id: 5, name: "Vinay Kumar", phone: "9876543214", role: "employee" },
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

    const pwdErr = validateStrongPassword(cleanPin);
    if (pwdErr) {
      return errorResponse(pwdErr, 400);
    }

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

// PUT: Update Employee Name & PIN (Admin Only)
export async function onRequestPut({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);
  if (user.role !== "admin") return errorResponse("Only administrators can update employee details.", 403);

  try {
    const { phone, name, pin } = await request.json();
    if (!phone || (!name && !pin)) {
      return errorResponse("Phone number and either updated name or PIN are required.", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanName = name ? String(name).trim() : null;
    const cleanPin = pin ? String(pin).trim() : null;

    if (cleanPin) {
      const pwdErr = validateStrongPassword(cleanPin);
      if (pwdErr) {
        return errorResponse(pwdErr, 400);
      }
    }

    // Update in KV
    if (env.KV) {
      let existingUser = (await env.KV.get(`user:${cleanPhone}`, "json")) || {
        phone: cleanPhone,
        role: "employee",
        is_active: 1,
      };
      if (cleanName) existingUser.name = cleanName;
      if (cleanPin) existingUser.pin = cleanPin;
      await env.KV.put(`user:${cleanPhone}`, JSON.stringify(existingUser));

      let list = (await env.KV.get("users_list", "json")) || [];
      let found = false;
      list = list.map((emp) => {
        if (String(emp.phone).trim() === cleanPhone) {
          found = true;
          return {
            ...emp,
            name: cleanName || emp.name,
            pin: cleanPin || emp.pin,
          };
        }
        return emp;
      });
      if (!found && cleanName) {
        list.push({
          id: Date.now(),
          name: cleanName,
          phone: cleanPhone,
          pin: cleanPin || "1234",
          role: "employee",
          is_active: 1,
        });
      }
      await env.KV.put("users_list", JSON.stringify(list));
    }

    // Update in D1
    if (env.DB) {
      try {
        if (cleanName && cleanPin) {
          await env.DB.prepare("UPDATE users SET name = ?, pin = ? WHERE phone = ?").bind(cleanName, cleanPin, cleanPhone).run();
        } else if (cleanName) {
          await env.DB.prepare("UPDATE users SET name = ? WHERE phone = ?").bind(cleanName, cleanPhone).run();
        } else if (cleanPin) {
          await env.DB.prepare("UPDATE users SET pin = ? WHERE phone = ?").bind(cleanPin, cleanPhone).run();
        }
      } catch (d1Err) {
        console.warn("D1 update employee warning:", d1Err);
      }
    }

    return jsonResponse({
      success: true,
      message: "Employee details updated successfully.",
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
