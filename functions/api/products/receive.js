import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const { serialNumber, name, model, supplier } = await request.json();

    if (!serialNumber || !name) {
      return errorResponse("सीरियल नंबर और प्रोडक्ट का नाम अनिवार्य है।", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    const cleanName = String(name).trim();
    const cleanModel = (model || "").trim();
    const cleanSupplier = (supplier || "").trim();

    // Check if serial already exists
    const existing = await env.DB.prepare(
      "SELECT id, current_status FROM products WHERE serial_number = ?"
    ).bind(cleanSerial).first();

    if (existing) {
      return errorResponse(`यह सीरियल नंबर (${cleanSerial}) पहले से दर्ज है। वर्तमान स्थिति: ${existing.current_status}`, 400);
    }

    const res = await env.DB.prepare(
      `INSERT INTO products (serial_number, name, model, supplier, current_status) 
       VALUES (?, ?, ?, ?, 'received')`
    ).bind(cleanSerial, cleanName, cleanModel, cleanSupplier).run();

    const productId = res.meta?.last_row_id;

    // Record Audit Log
    await recordAudit(env, {
      productId,
      serialNumber: cleanSerial,
      action: "RECEIVE",
      actor: user,
      details: {
        productName: cleanName,
        model: cleanModel,
        supplier: cleanSupplier,
        message: "माल प्राप्त किया गया (Product Received into Inventory)",
      },
    });

    return jsonResponse({
      success: true,
      message: "प्रोडक्ट सफलतापूर्वक रिसीव कर लिया गया।",
      productId,
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
