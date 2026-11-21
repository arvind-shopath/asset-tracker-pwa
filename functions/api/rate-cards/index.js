import { jsonResponse, errorResponse, verifyAuth, getRateCards, saveRateCard } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  // In-House Staff is strictly blocked from seeing service rates and pricing!
  if (user.role === "in_house_staff") {
    return errorResponse("Access denied. Rate cards are not visible to in-house store staff.", 403);
  }

  try {
    const list = await getRateCards(env);
    return jsonResponse({ success: true, count: list.length, rateCards: list });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can create or edit rate cards.", 403);
  }

  try {
    const body = await request.json();
    const { id, service_title_en, service_title_hi, fixed_amount } = body;

    if (!service_title_en || fixed_amount === undefined) {
      return errorResponse("Service title in English and fixed amount are required.", 400);
    }

    const rc = await saveRateCard(env, {
      id: id ? Number(id) : Date.now(),
      service_title_en: String(service_title_en).trim(),
      service_title_hi: String(service_title_hi || service_title_en).trim(),
      fixed_amount: Number(fixed_amount),
    });

    return jsonResponse({ success: true, rateCard: rc, message: "Rate card saved successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
