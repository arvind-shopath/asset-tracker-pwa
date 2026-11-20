import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const serial = url.searchParams.get("serial") || url.searchParams.get("serialNumber");

    if (!serial) {
      return errorResponse("Serial number is required.", 400);
    }

    const cleanSerial = String(serial).trim();
    let product = null;
    let timeline = [];

    // 1. Try KV first
    if (env.KV) {
      product = await env.KV.get(`product:${cleanSerial}`, "json");
      timeline = (await env.KV.get(`timeline:${cleanSerial}`, "json")) || [];
    }

    // 2. Try D1 if product not found in KV
    if (!product && env.DB) {
      try {
        product = await env.DB.prepare(
          "SELECT * FROM products WHERE serial_number = ?"
        ).bind(cleanSerial).first();

        const { results } = await env.DB.prepare(
          "SELECT * FROM audit_trail WHERE serial_number = ? ORDER BY timestamp ASC"
        ).bind(cleanSerial).all();

        if (results) {
          timeline = results.map((row) => {
            let details = {};
            try { details = JSON.parse(row.details_json || "{}"); } catch (e) { details = { raw: row.details_json }; }
            return {
              id: row.id,
              action: row.action,
              actorName: row.actor_name,
              actorPhone: row.actor_phone,
              actorRole: row.actor_role,
              details,
              photoKey: row.photo_key,
              photoUrl: row.photo_key ? `/api/photo/${row.photo_key}` : null,
              gpsLat: row.gps_lat,
              gpsLng: row.gps_lng,
              timestamp: row.timestamp,
            };
          });
        }
      } catch (e) {}
    }

    if (!product) {
      return errorResponse(`No record found for serial number '${cleanSerial}'.`, 404);
    }

    return jsonResponse({
      success: true,
      product,
      timeline: timeline || [],
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
