import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

// GET: Filtered & Searched Products List
export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    let products = [];

    // 1. Try KV first
    if (env.KV) {
      products = (await env.KV.get("products_list", "json")) || [];
    }

    // 2. Try D1 if KV is empty
    if ((!products || products.length === 0) && env.DB) {
      try {
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
        if (results && results.length > 0) products = results;
      } catch (e) {}
    }

    // Filter in-memory if fetched from KV
    if (products && products.length > 0) {
      if (status && status !== "all") {
        products = products.filter((p) => p.current_status === status);
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        products = products.filter(
          (p) =>
            (p.serial_number && p.serial_number.toLowerCase().includes(q)) ||
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.customer_name && p.customer_name.toLowerCase().includes(q)) ||
            (p.customer_phone && p.customer_phone.includes(q)) ||
            (p.model && p.model.toLowerCase().includes(q))
        );
      }
    }

    return jsonResponse({
      success: true,
      products: products || [],
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// DELETE: Delete a product (Admin only)
export async function onRequestDelete({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);
  if (user.role !== "admin") return errorResponse("Only administrators can delete products.", 403);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const serial = url.searchParams.get("serial");
    if (!id && !serial) return errorResponse("Product ID or serial number is required.", 400);

    if (env.KV) {
      if (serial) {
        await env.KV.delete(`product:${serial}`);
        await env.KV.delete(`timeline:${serial}`);
      }
      let list = (await env.KV.get("products_list", "json")) || [];
      list = list.filter((p) => String(p.id) !== String(id) && p.serial_number !== serial);
      await env.KV.put("products_list", JSON.stringify(list));
    }

    if (env.DB && id) {
      try {
        await env.DB.prepare("DELETE FROM audit_trail WHERE product_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
      } catch (e) {}
    }

    return jsonResponse({
      success: true,
      message: "Product record removed successfully.",
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
