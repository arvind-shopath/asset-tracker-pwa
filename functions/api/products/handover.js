import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, assignedToPhone, assignedToName, customerName, customerPhone, customerAddress } = await request.json();

    if (!serialNumber || !assignedToPhone) {
      return errorResponse("Serial number and assignee employee are required.", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    let product = null;

    if (env.KV) {
      product = await env.KV.get(`product:${cleanSerial}`, "json");
    }

    if (!product && env.DB) {
      try {
        product = await env.DB.prepare(
          "SELECT * FROM products WHERE serial_number = ?"
        ).bind(cleanSerial).first();
      } catch (e) {}
    }

    if (!product) {
      return errorResponse(`Serial number (${cleanSerial}) not found.`, 404);
    }

    product.current_status = "handed_over";
    product.assigned_to_phone = assignedToPhone;
    product.assigned_to_name = assignedToName || "";
    product.customer_name = customerName || "";
    product.customer_phone = customerPhone || "";
    product.customer_address = customerAddress || "";
    product.updated_at = new Date().toISOString();

    if (env.KV) {
      await env.KV.put(`product:${cleanSerial}`, JSON.stringify(product));
      let list = (await env.KV.get("products_list", "json")) || [];
      list = list.map((p) => (p.serial_number === cleanSerial ? product : p));
      await env.KV.put("products_list", JSON.stringify(list));
    }

    if (env.DB) {
      try {
        await env.DB.prepare(
          `UPDATE products 
           SET current_status = 'handed_over', assigned_to_phone = ?, assigned_to_name = ?, customer_name = ?, customer_phone = ?, customer_address = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE serial_number = ?`
        ).bind(assignedToPhone, assignedToName || "", customerName || "", customerPhone || "", customerAddress || "", cleanSerial).run();
      } catch (e) {}
    }

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
        message: `Handed over to ${assignedToName} (${assignedToPhone}) for installation.`,
      },
    });

    return jsonResponse({
      success: true,
      message: "Handover recorded successfully.",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
