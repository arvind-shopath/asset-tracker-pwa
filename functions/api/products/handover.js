import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { serialNumber, assignedToPhone, assignedToName, customerName, customerPhone, customerAddress } = await request.json();

    if (!serialNumber || !assignedToPhone) {
      return errorResponse("सीरियल नंबर और असाइन करने वाले कर्मचारी का चयन अनिवार्य है।", 400);
    }

    const cleanSerial = String(serialNumber).trim();

    const product = await env.DB.prepare(
      "SELECT id, name, current_status FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (!product) {
      return errorResponse(`सीरियल नंबर (${cleanSerial}) नहीं मिला।`, 404);
    }

    if (product.current_status === "installed" || product.current_status === "rejected" || product.current_status === "picked_up") {
      return errorResponse(`यह प्रोडक्ट वर्तमान में '${product.current_status}' स्थिति में है। हैंडओवर संभव नहीं।`, 400);
    }

    await env.DB.prepare(
      `UPDATE products 
       SET current_status = 'handed_over', 
           assigned_to_phone = ?, 
           assigned_to_name = ?, 
           customer_name = ?, 
           customer_phone = ?, 
           customer_address = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(
      assignedToPhone,
      assignedToName || "",
      customerName || "",
      customerPhone || "",
      customerAddress || "",
      product.id
    ).run();

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "HANDOVER_FOR_INSTALL",
      actor: user,
      details: {
        assignedToName,
        assignedToPhone,
        customerName,
        customerPhone,
        customerAddress,
        message: `इंस्टॉलेशन के लिए ${assignedToName} (${assignedToPhone}) को सौंपा गया।`,
      },
    });

    return jsonResponse({
      success: true,
      message: "प्रोडक्ट इंस्टॉलेशन हेतु सफलतापूर्वक हैंडओवर कर दिया गया।",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
