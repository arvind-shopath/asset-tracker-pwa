import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

// GET: Filtered & Searched Products List
export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    let query = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (status && status !== "all") {
      query += " AND current_status = ?";
      params.push(status);
    }

    if (search && search.trim()) {
      query += " AND (serial_number LIKE ? OR name LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR model LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += " ORDER BY updated_at DESC LIMIT 150";

    const { results } = await env.DB.prepare(query).bind(...params).all();

    return jsonResponse({
      success: true,
      products: results || [],
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// DELETE: Delete a product (Admin only)
export async function onRequestDelete({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);
  if (user.role !== "admin") return errorResponse("केवल एडमिन प्रोडक्ट डिलीट कर सकते हैं।", 403);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Product ID अनिवार्य है।", 400);

    await env.DB.prepare("DELETE FROM audit_trail WHERE product_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();

    return jsonResponse({
      success: true,
      message: "प्रोडक्ट और उसका ऑडिट रिकॉर्ड सफलतापूर्वक हटा दिया गया।",
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
