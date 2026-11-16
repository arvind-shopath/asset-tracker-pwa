import { jsonResponse, errorResponse, verifyAuth, findUser } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) {
    return errorResponse("Unauthorized session. Please sign in again.", 401);
  }

  const dbUser = await findUser(env, user.phone);

  if (!dbUser) {
    return errorResponse("User account is inactive.", 401);
  }

  return jsonResponse({
    success: true,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      phone: dbUser.phone,
      role: dbUser.role,
    },
  });
}
