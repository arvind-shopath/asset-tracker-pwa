import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const url = new URL(request.url);
    const serial = url.searchParams.get("serial");

    if (!serial) {
      return errorResponse("सीरियल नंबर अनिवार्य है।", 400);
    }

    const cleanSerial = String(serial).trim();

    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (!product) {
      return errorResponse(`सीरियल नंबर '${cleanSerial}' का कोई रिकॉर्ड नहीं मिला।`, 404);
    }

    const { results } = await env.DB.prepare(
      "SELECT * FROM audit_trail WHERE serial_number = ? ORDER BY timestamp ASC"
    ).bind(cleanSerial).all();

    const timeline = (results || []).map((row) => {
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(row.details_json || "{}");
      } catch (e) {
        parsedDetails = { raw: row.details_json };
      }

      return {
        id: row.id,
        action: row.action,
        actorName: row.actor_name,
        actorPhone: row.actor_phone,
        actorRole: row.actor_role,
        details: parsedDetails,
        photoKey: row.photo_key,
        photoUrl: row.photo_key ? `/api/photo/${row.photo_key}` : null,
        gpsLat: row.gps_lat,
        gpsLng: row.gps_lng,
        timestamp: row.timestamp,
      };
    });

    return jsonResponse({
      success: true,
      product,
      timeline,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
