import { jsonResponse, errorResponse, verifyAuth, recordAudit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, name, model, supplier } = await request.json();

    if (!serialNumber || !name) {
      return errorResponse("Serial number and product name are required.", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    const cleanName = String(name).trim();
    const cleanModel = (model || "").trim();
    const cleanSupplier = (supplier || "").trim();

    const productRecord = {
      id: Date.now(),
      serial_number: cleanSerial,
      name: cleanName,
      model: cleanModel,
      supplier: cleanSupplier,
      current_status: "received",
      storage_location: "",
      assigned_to_phone: "",
      assigned_to_name: "",
      customer_name: "",
      customer_phone: "",
      customer_address: "",
      gps_lat: null,
      gps_lng: null,
      installed_photo_key: null,
      rejected_reason: null,
      rejected_remarks: null,
      rejected_photo_key: null,
      pickup_person_name: null,
      pickup_person_phone: null,
      pickup_vehicle_no: null,
      pickup_remarks: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Save to KV
    if (env.KV) {
      const existing = await env.KV.get(`product:${cleanSerial}`, "json");
      if (existing) {
        return errorResponse(`Serial number (${cleanSerial}) already exists. Current status: ${existing.current_status}`, 400);
      }
      await env.KV.put(`product:${cleanSerial}`, JSON.stringify(productRecord));

      const list = (await env.KV.get("products_list", "json")) || [];
      list.unshift(productRecord);
      await env.KV.put("products_list", JSON.stringify(list));
    }

    // Try save to D1
    if (env.DB) {
      try {
        const res = await env.DB.prepare(
          `INSERT INTO products (serial_number, name, model, supplier, current_status) 
           VALUES (?, ?, ?, ?, 'received')`
        ).bind(cleanSerial, cleanName, cleanModel, cleanSupplier).run();
        productRecord.id = res.meta?.last_row_id || productRecord.id;
      } catch (e) {
        console.warn("D1 receive notice:", e);
      }
    }

    // Record Audit Log
    await recordAudit(env, {
      productId: productRecord.id,
      serialNumber: cleanSerial,
      action: "RECEIVE",
      actor: user,
      details: {
        productName: cleanName,
        model: cleanModel,
        supplier: cleanSupplier,
        message: "Product received into inventory.",
      },
    });

    return jsonResponse({
      success: true,
      message: "Product received successfully.",
      productId: productRecord.id,
      serialNumber: cleanSerial,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
