import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { serialNumber, reason, remarks, photoKey } = await request.json();

    if (!serialNumber || !reason) {
      return errorResponse("सीरियल नंबर और रिजेक्शन का कारण अनिवार्य है।", 400);
    }

    if (!photoKey) {
      return errorResponse("रिजेक्टेड प्रोडक्ट की फोटो अपलोड करना अनिवार्य है।", 400);
    }

    const cleanSerial = String(serialNumber).trim();

    const product = await env.DB.prepare(
      "SELECT id, name, current_status FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (!product) {
      return errorResponse(`सीरियल नंबर (${cleanSerial}) नहीं मिला।`, 404);
    }

    if (product.current_status === "picked_up") {
      return errorResponse("यह प्रोडक्ट पहले ही वेंडर/सप्लायर द्वारा पिकअप किया जा चुका है।", 400);
    }

    await env.DB.prepare(
      `UPDATE products 
       SET current_status = 'rejected', 
           rejected_reason = ?, 
           rejected_remarks = ?, 
           rejected_photo_key = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(
      reason,
      remarks || "",
      photoKey,
      product.id
    ).run();

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "REJECT_PRODUCT",
      actor: user,
      details: {
        reason,
        remarks,
        previousStatus: product.current_status,
        message: `प्रोडक्ट रिजेक्ट किया गया: [${reason}] ${remarks || ""}`,
      },
      photoKey,
    });

    return jsonResponse({
      success: true,
      message: "प्रोडक्ट रिजेक्शन सफलतापूर्वक दर्ज किया गया।",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
