import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, pickupPersonName, pickupPersonPhone, pickupVehicleNo, pickupRemarks } = await request.json();

    if (!serialNumber || !pickupPersonName || !pickupPersonPhone) {
      return errorResponse("Serial number, pickup person name, and phone number are required.", 400);
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

    product.current_status = "picked_up";
    product.pickup_person_name = pickupPersonName;
    product.pickup_person_phone = pickupPersonPhone;
    product.pickup_vehicle_no = pickupVehicleNo || "";
    product.pickup_remarks = pickupRemarks || "";
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
           SET current_status = 'picked_up', pickup_person_name = ?, pickup_person_phone = ?, pickup_vehicle_no = ?, pickup_remarks = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE serial_number = ?`
        ).bind(pickupPersonName, pickupPersonPhone, pickupVehicleNo || "", pickupRemarks || "", cleanSerial).run();
      } catch (e) {}
    }

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
        message: `Handed over rejected product to ${pickupPersonName} (${pickupPersonPhone}).`,
      },
    });

    return jsonResponse({
      success: true,
      message: "Rejected pickup recorded successfully.",
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
