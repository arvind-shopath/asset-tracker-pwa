import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) {
    return errorResponse("अनधिकृत सत्र। पुनः लॉगिन करें।", 401);
  }

  // Fetch latest user details from DB
  const dbUser = await env.DB.prepare(
    "SELECT id, name, phone, role FROM users WHERE id = ? AND is_active = 1"
  ).bind(user.id).first();

  if (!dbUser) {
    return errorResponse("यूजर सक्रिय नहीं है।", 401);
  }

  return jsonResponse({
    success: true,
    user: dbUser
  });
}
