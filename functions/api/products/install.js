import { jsonResponse, errorResponse, verifyAuth, recordAudit, findProduct, saveProduct } from "../_utils.js";

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
    let product = await findProduct(env, cleanSerial);

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

    await saveProduct(env, product);

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
