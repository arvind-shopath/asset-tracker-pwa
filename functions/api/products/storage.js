import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { serialNumber, storageLocation } = await request.json();

    if (!serialNumber || !storageLocation) {
      return errorResponse("सीरियल नंबर और रैक/स्टोर लोकेशन अनिवार्य है।", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    const cleanLocation = String(storageLocation).trim();

    const product = await env.DB.prepare(
      "SELECT id, name, current_status FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (!product) {
      return errorResponse(`सीरियल नंबर (${cleanSerial}) नहीं मिला। पहले इसे रिसीव करें।`, 404);
    }

    if (product.current_status === "rejected" || product.current_status === "picked_up") {
      return errorResponse(`यह प्रोडक्ट वर्तमान में '${product.current_status}' स्थिति में है। इसे स्टोरेज में नहीं रखा जा सकता।`, 400);
    }

    await env.DB.prepare(
      `UPDATE products 
       SET current_status = 'in_storage', storage_location = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(cleanLocation, product.id).run();

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "PUT_IN_STORAGE",
      actor: user,
      details: {
        storageLocation: cleanLocation,
        previousStatus: product.current_status,
        message: `स्टोरेज/रैक में सुरक्षित रखा गया: ${cleanLocation}`,
      },
    });

    return jsonResponse({
      success: true,
      message: "प्रोडक्ट स्टोरेज लोकेशन अपडेट हो गई।",
      serialNumber: cleanSerial,
      storageLocation: cleanLocation,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
