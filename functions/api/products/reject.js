import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, reason, remarks, photoKey } = await request.json();

    if (!serialNumber || !reason) {
      return errorResponse("Serial number and rejection reason are required.", 400);
    }

    if (!photoKey) {
      return errorResponse("Rejection photo is required.", 400);
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

    product.current_status = "rejected";
    product.rejected_reason = reason;
    product.rejected_remarks = remarks || "";
    product.rejected_photo_key = photoKey;
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
           SET current_status = 'rejected', rejected_reason = ?, rejected_remarks = ?, rejected_photo_key = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE serial_number = ?`
        ).bind(reason, remarks || "", photoKey, cleanSerial).run();
      } catch (e) {}
    }

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "REJECT_PRODUCT",
      actor: user,
      details: {
        reason,
        remarks,
        message: `Product rejected: [${reason}] ${remarks || ""}`,
      },
      photoKey,
    });

    return jsonResponse({
      success: true,
      message: "Product rejection recorded successfully.",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
