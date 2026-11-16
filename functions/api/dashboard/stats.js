import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const counts = {
      total: 0,
      received: 0,
      in_storage: 0,
      handed_over: 0,
      installed: 0,
      rejected: 0,
      picked_up: 0,
    };

    let recentActivity = [];

    // 1. From KV
    if (env.KV) {
      const list = (await env.KV.get("products_list", "json")) || [];
      list.forEach((p) => {
        if (counts[p.current_status] !== undefined) {
          counts[p.current_status]++;
        }
        counts.total++;
      });
      recentActivity = (await env.KV.get("recent_activity", "json")) || [];
    }

    // 2. From D1 fallback if KV is empty
    if (counts.total === 0 && env.DB) {
      try {
        const statusCounts = await env.DB.prepare(
          `SELECT current_status, COUNT(*) as count FROM products GROUP BY current_status`
        ).all();
        (statusCounts.results || []).forEach((row) => {
          counts[row.current_status] = row.count;
          counts.total += row.count;
        });
        const rec = await env.DB.prepare(
          `SELECT a.*, p.name as product_name 
           FROM audit_trail a 
           LEFT JOIN products p ON a.product_id = p.id 
           ORDER BY a.timestamp DESC LIMIT 10`
        ).all();
        if (rec.results) recentActivity = rec.results;
      } catch (e) {}
    }

    return jsonResponse({
      success: true,
      stats: counts,
      recentActivity: recentActivity || [],
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
