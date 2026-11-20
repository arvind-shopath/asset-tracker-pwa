import { jsonResponse, errorResponse, verifyAuth, recordAudit, findProduct, saveProduct } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, pickupPersonName, pickupPersonPhone, pickupVehicleNo, pickupRemarks, photoKey } = await request.json();

    if (!serialNumber || !pickupPersonName || !pickupPersonPhone) {
      return errorResponse("Serial number, pickup person name, and phone number are required.", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    let product = await findProduct(env, cleanSerial);

    if (!product) {
      return errorResponse(`Serial number (${cleanSerial}) not found.`, 404);
    }

    product.current_status = "picked_up";
    product.pickup_person_name = pickupPersonName;
    product.pickup_person_phone = pickupPersonPhone;
    product.pickup_vehicle_no = pickupVehicleNo || "";
    product.pickup_remarks = pickupRemarks || "";
    product.pickup_photo_key = photoKey || "";
    product.updated_at = new Date().toISOString();

    await saveProduct(env, product);
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
      photoKey: photoKey || null,
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
