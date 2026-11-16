import { jsonResponse, errorResponse, createAuthToken } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  try {
    const { phone, pin } = await request.json();
    if (!phone || !pin) {
      return errorResponse("कृपया मोबाइल नंबर और PIN दर्ज करें।", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanPin = String(pin).trim();

    const user = await env.DB.prepare(
      "SELECT id, name, phone, role, is_active FROM users WHERE phone = ? AND pin = ? AND is_active = 1"
    ).bind(cleanPhone, cleanPin).first();

    if (!user) {
      return errorResponse("अमान्य मोबाइल नंबर या गलत PIN।", 401);
    }

    const token = await createAuthToken(user);

    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    return errorResponse("लॉगिन विफल: " + err.message, 500);
  }
}
