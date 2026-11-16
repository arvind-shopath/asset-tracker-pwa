import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { serialNumber, pickupPersonName, pickupPersonPhone, pickupVehicleNo, pickupRemarks } = await request.json();

    if (!serialNumber || !pickupPersonName || !pickupPersonPhone) {
      return errorResponse("सीरियल नंबर, पिकअप करने वाले का नाम और मोबाइल नंबर अनिवार्य हैं।", 400);
    }

    const cleanSerial = String(serialNumber).trim();

    const product = await env.DB.prepare(
      "SELECT id, name, current_status FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (!product) {
      return errorResponse(`सीरियल नंबर (${cleanSerial}) नहीं मिला।`, 404);
    }

    if (product.current_status !== "rejected") {
      return errorResponse(`केवल 'rejected' स्थिति वाले माल का ही पिकअप दर्ज किया जा सकता है। (वर्तमान स्थिति: ${product.current_status})`, 400);
    }

    await env.DB.prepare(
      `UPDATE products 
       SET current_status = 'picked_up', 
           pickup_person_name = ?, 
           pickup_person_phone = ?, 
           pickup_vehicle_no = ?, 
           pickup_remarks = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(
      pickupPersonName,
      pickupPersonPhone,
      pickupVehicleNo || "",
      pickupRemarks || "",
      product.id
    ).run();

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "REJECTED_PICKUP",
      actor: user,
      details: {
        pickupPersonName,
        pickupPersonPhone,
        pickupVehicleNo,
        pickupRemarks,
        message: `रिजेक्टेड माल पिकअप व्यक्ति (${pickupPersonName}, ${pickupPersonPhone}) को सौंपा गया।`,
      },
    });

    return jsonResponse({
      success: true,
      message: "रिजेक्टेड प्रोडक्ट पिकअप हैंडओवर सफलतापूर्वक दर्ज किया गया।",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
