import { jsonResponse, errorResponse, createAuthToken, findUser } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  try {
    const { phone, pin } = await request.json();
    if (!phone || !pin) {
      return errorResponse("Please enter both phone number and PIN.", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanPin = String(pin).trim();

    const user = await findUser(env, cleanPhone, cleanPin);

    if (!user) {
      return errorResponse("Invalid phone number or PIN.", 401);
    }

    const token = await createAuthToken(user);

    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    return errorResponse("Login failed: " + err.message, 500);
  }
}
