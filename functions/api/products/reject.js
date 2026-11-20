import { jsonResponse, errorResponse, verifyAuth, recordAudit, findProduct, saveProduct } from "../_utils.js";

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
    let product = await findProduct(env, cleanSerial);

    if (!product) {
      return errorResponse(`Serial number (${cleanSerial}) not found.`, 404);
    }

    product.current_status = "rejected";
    product.rejected_reason = reason;
    product.rejected_remarks = remarks || "";
    product.rejected_photo_key = photoKey;
    product.updated_at = new Date().toISOString();

    await saveProduct(env, product);

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
