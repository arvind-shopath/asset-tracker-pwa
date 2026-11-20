import { jsonResponse, errorResponse, verifyAuth, recordAudit, findProduct, saveProduct } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const { serialNumber, assignedToPhone, assignedToName, customerName, customerPhone, customerAddress } = await request.json();

    if (!serialNumber || !assignedToPhone) {
      return errorResponse("Serial number and assignee employee are required.", 400);
    }

    const cleanSerial = String(serialNumber).trim();
    let product = await findProduct(env, cleanSerial);

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

    await saveProduct(env, product);

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
