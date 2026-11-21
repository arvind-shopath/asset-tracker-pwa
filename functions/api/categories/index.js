import { jsonResponse, errorResponse, verifyAuth, getCategories, saveCategory } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  try {
    const list = await getCategories(env);
    return jsonResponse({ success: true, categories: list });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can create categories.", 403);
  }

  try {
    const body = await request.json();
    const { name_en, name_hi } = body;
    if (!name_en) {
      return errorResponse("Category name in English is required.", 400);
    }
    const cat = await saveCategory(env, {
      id: Date.now(),
      name_en: String(name_en).trim(),
      name_hi: String(name_hi || name_en).trim(),
    });
    return jsonResponse({ success: true, category: cat, message: "Category created successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
