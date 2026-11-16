import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    // Aggregated product counts by status
    const statusCounts = await env.DB.prepare(
      `SELECT current_status, COUNT(*) as count FROM products GROUP BY current_status`
    ).all();

    const counts = {
      total: 0,
      received: 0,
      in_storage: 0,
      handed_over: 0,
      installed: 0,
      rejected: 0,
      picked_up: 0,
    };

    (statusCounts.results || []).forEach((row) => {
      counts[row.current_status] = row.count;
      counts.total += row.count;
    });

    // Recent 10 audit activity logs
    const recentActivity = await env.DB.prepare(
      `SELECT a.*, p.name as product_name 
       FROM audit_trail a 
       LEFT JOIN products p ON a.product_id = p.id 
       ORDER BY a.timestamp DESC LIMIT 10`
    ).all();

    return jsonResponse({
      success: true,
      stats: counts,
      recentActivity: recentActivity.results || [],
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
