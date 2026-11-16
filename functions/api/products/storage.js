import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, storageLocation } = await request.json();

    if (!serialNumber || !storageLocation) {
      return errorResponse("Serial number and storage location are required.", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    const cleanLocation = String(storageLocation).trim();

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
      return errorResponse(`Serial number (${cleanSerial}) not found. Please receive it first.`, 404);
    }

    product.current_status = "in_storage";
    product.storage_location = cleanLocation;
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
          "UPDATE products SET current_status = 'in_storage', storage_location = ?, updated_at = CURRENT_TIMESTAMP WHERE serial_number = ?"
        ).bind(cleanLocation, cleanSerial).run();
      } catch (e) {}
    }

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "PUT_IN_STORAGE",
      actor: user,
      details: {
        storageLocation: cleanLocation,
        message: `Stored in rack/shelf: ${cleanLocation}`,
      },
    });

    return jsonResponse({
      success: true,
      message: "Storage location updated successfully.",
      serialNumber: cleanSerial,
      storageLocation: cleanLocation,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
