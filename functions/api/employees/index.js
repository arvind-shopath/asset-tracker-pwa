import { jsonResponse, errorResponse, verifyAuth, getUsers } from "../_utils.js";

export async function onRequestGet(context) {
  const user = await verifyAuth(context.request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const users = await getUsers(context.env);
    return jsonResponse({
      success: true,
      employees: users.map(u => ({
        id: u.id,
        name: u.name,
        phone: u.mobile || u.phone,
        mobile: u.mobile || u.phone,
        role: u.role,
        is_active: u.is_active,
      })),
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
