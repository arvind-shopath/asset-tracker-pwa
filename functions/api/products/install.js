import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { 
      serialNumber, 
      customerName, 
      customerPhone, 
      customerAddress, 
      gpsLat, 
      gpsLng, 
      photoKey 
    } = await request.json();

    if (!serialNumber || !customerName || !customerPhone) {
      return errorResponse("सीरियल नंबर, ग्राहक का नाम और मोबाइल नंबर अनिवार्य हैं।", 400);
    }

    if (!photoKey) {
      return errorResponse("इंस्टॉलेशन की लाइव फोटो अपलोड करना अनिवार्य है।", 400);
    }

    const cleanSerial = String(serialNumber).trim();

    const product = await env.DB.prepare(
      "SELECT id, name, current_status FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (!product) {
      return errorResponse(`सीरियल नंबर (${cleanSerial}) नहीं मिला।`, 404);
    }

    if (product.current_status === "installed") {
      return errorResponse("यह प्रोडक्ट पहले से ही 'Installed' मार्क किया जा चुका है।", 400);
    }

    if (product.current_status === "rejected" || product.current_status === "picked_up") {
      return errorResponse(`यह प्रोडक्ट '${product.current_status}' स्थिति में है। इंस्टॉलेशन संभव नहीं।`, 400);
    }

    await env.DB.prepare(
      `UPDATE products 
       SET current_status = 'installed', 
           customer_name = ?, 
           customer_phone = ?, 
           customer_address = ?, 
           gps_lat = ?, 
           gps_lng = ?, 
           installed_photo_key = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(
      customerName,
      customerPhone,
      customerAddress || "",
      gpsLat || null,
      gpsLng || null,
      photoKey,
      product.id
    ).run();

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "MARK_INSTALLED",
      actor: user,
      details: {
        customerName,
        customerPhone,
        customerAddress,
        message: `सफलतापूर्वक ग्राहक (${customerName}) के यहाँ इंस्टॉल किया गया।`,
      },
      photoKey,
      gpsLat: gpsLat || null,
      gpsLng: gpsLng || null,
    });

    return jsonResponse({
      success: true,
      message: "प्रोडक्ट इंस्टॉलेशन सफलतापूर्वक पूर्ण और रिकॉर्ड किया गया।",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
