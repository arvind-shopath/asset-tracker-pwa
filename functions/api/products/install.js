import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

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
      return errorResponse("Serial number, customer name, and phone number are required.", 400);
    }

    if (!photoKey) {
      return errorResponse("Live installation photo is required.", 400);
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

    product.current_status = "installed";
    product.customer_name = customerName;
    product.customer_phone = customerPhone;
    product.customer_address = customerAddress || "";
    product.gps_lat = gpsLat || null;
    product.gps_lng = gpsLng || null;
    product.installed_photo_key = photoKey;
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
           SET current_status = 'installed', customer_name = ?, customer_phone = ?, customer_address = ?, gps_lat = ?, gps_lng = ?, installed_photo_key = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE serial_number = ?`
        ).bind(customerName, customerPhone, customerAddress || "", gpsLat || null, gpsLng || null, photoKey, cleanSerial).run();
      } catch (e) {}
    }

    await recordAudit(env, {
      productId: product.id,
      serialNumber: cleanSerial,
      action: "MARK_INSTALLED",
      actor: user,
      details: {
        customerName,
        customerPhone,
        customerAddress,
        message: `Successfully installed for ${customerName}.`,
      },
      photoKey,
      gpsLat: gpsLat || null,
      gpsLng: gpsLng || null,
    });

    return jsonResponse({
      success: true,
      message: "Installation recorded successfully.",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
