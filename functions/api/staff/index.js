import { jsonResponse, errorResponse, verifyAuth, getUsers, getCompanyAssets, recordAudit } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  // In-House and Tech cannot manage staff
  if (user.role !== "admin") {
    return errorResponse("Only admin can view and manage staff members.", 403);
  }

  try {
    const users = await getUsers(env);
    const assets = await getCompanyAssets(env);

    const enriched = users.map(u => {
      const userAssets = assets.filter(a => String(a.user_id) === String(u.id) && a.status === "active");
      return {
        id: u.id,
        name: u.name,
        mobile: u.mobile || u.phone,
        phone: u.mobile || u.phone,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        assigned_assets: userAssets,
      };
    });

    return jsonResponse({ success: true, count: enriched.length, staff: enriched });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can add new staff.", 403);
  }

  try {
    const body = await request.json();
    const { name, mobile, phone, pin, password, role } = body;
    const cleanMobile = String(mobile || phone || "").trim();
    const cleanPin = String(pin || password || "1234").trim();

    if (!name || !cleanMobile) {
      return errorResponse("Staff name and mobile number are required.", 400);
    }

    const validRoles = ["admin", "in_house_staff", "third_party_tech"];
    const assignedRole = validRoles.includes(role) ? role : "in_house_staff";

    const allUsers = await getUsers(env);
    if (allUsers.some(u => (u.mobile === cleanMobile || u.phone === cleanMobile))) {
      return errorResponse("A user with this mobile number already exists.", 409);
    }

    const newUser = {
      id: Date.now(),
      name: String(name).trim(),
      mobile: cleanMobile,
      phone: cleanMobile,
      pin_or_password: cleanPin,
      pin: cleanPin,
      role: assignedRole,
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    allUsers.push(newUser);

    if (env.KV) {
      await env.KV.put("users_list", JSON.stringify(allUsers));
      await env.KV.put(`user:${cleanMobile}`, JSON.stringify(newUser));
    }
    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO users (id, name, mobile, pin_or_password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)"
        ).bind(newUser.id, newUser.name, newUser.mobile, newUser.pin_or_password, newUser.role).run();
      } catch (e) {}
    }

    await recordAudit(env, {
      entity_type: "asset",
      entity_id: newUser.id,
      action_by_user_id: user.id,
      assigned_to_user_id: newUser.id,
      action_description_en: `Admin added new staff member ${newUser.name} (${newUser.role}).`,
      action_description_hi: `एडमिन ने नया स्टाफ सदस्य ${newUser.name} (${newUser.role}) जोड़ा।`,
    });

    return jsonResponse({ success: true, user: newUser, message: "Staff member added successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
