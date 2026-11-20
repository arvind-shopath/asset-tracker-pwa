import { jsonResponse, errorResponse, verifyAuth, recordAudit, findProduct, saveProduct } from "../_utils.js";

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

    let product = await findProduct(env, cleanSerial);

    if (!product) {
      return errorResponse(`Serial number (${cleanSerial}) not found. Please receive it first.`, 404);
    }

    product.current_status = "in_storage";
    product.storage_location = cleanLocation;
    product.updated_at = new Date().toISOString();

    await saveProduct(env, product);

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
