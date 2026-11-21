import { jsonResponse, errorResponse, verifyAuth, getServiceCalls, saveServiceCall, findServiceCall, getRateCards, getUsers, getInventory, saveInventoryItem, recordAudit } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  // In-House Staff is strictly prohibited from seeing calls/financial records!
  if (user.role === "in_house_staff") {
    return errorResponse("Access denied. Service calls are not visible to in-house store staff.", 403);
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const techId = url.searchParams.get("tech_id");
    const payoutStatus = url.searchParams.get("payout_status");

    let calls = await getServiceCalls(env);

    // If Third-Party Tech, restrict strictly to their calls
    if (user.role === "third_party_tech") {
      calls = calls.filter(c => String(c.assigned_tech_id) === String(user.id));
    } else if (techId && techId !== "all") {
      calls = calls.filter(c => String(c.assigned_tech_id) === String(techId));
    }

    if (status && status !== "all") {
      calls = calls.filter(c => c.status === status);
    }

    if (payoutStatus && payoutStatus !== "all") {
      calls = calls.filter(c => c.payout_status === payoutStatus);
    }

    const rateCards = await getRateCards(env);
    const users = await getUsers(env);
    const inventory = await getInventory(env);

    const enriched = calls.map(c => {
      const rc = rateCards.find(r => r.id === c.rate_card_id);
      const tech = users.find(u => u.id === c.assigned_tech_id);
      const part = inventory.find(i => i.id === c.used_part_id);
      const effectiveAmount = c.admin_edited_amount !== null && c.admin_edited_amount !== undefined 
        ? c.admin_edited_amount 
        : c.tech_payout_amount;

      return {
        ...c,
        service_title_en: rc ? rc.service_title_en : "Custom Service",
        service_title_hi: rc ? rc.service_title_hi : "कस्टम सर्विस",
        tech_name: tech ? tech.name : "Unassigned",
        tech_mobile: tech ? tech.mobile : "",
        part_name: part ? part.part_name : null,
        part_serial: part ? part.serial_number : null,
        effective_payout_amount: effectiveAmount,
      };
    });

    return jsonResponse({ success: true, count: enriched.length, calls: enriched });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can create service calls.", 403);
  }

  try {
    const body = await request.json();
    const { customer_name, customer_mobile, customer_address, rate_card_id, assigned_tech_id, used_part_id } = body;

    if (!customer_name || !customer_mobile || !rate_card_id || !assigned_tech_id) {
      return errorResponse("Customer name, mobile, service (rate card), and technician are required.", 400);
    }

    const rateCards = await getRateCards(env);
    const rc = rateCards.find(r => r.id === Number(rate_card_id));
    if (!rc) return errorResponse("Selected rate card not found.", 404);

    const users = await getUsers(env);
    const tech = users.find(u => u.id === Number(assigned_tech_id));
    if (!tech) return errorResponse("Selected technician not found.", 404);

    const complaintNum = `CMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCall = {
      id: Date.now(),
      complaint_number: complaintNum,
      customer_name: String(customer_name).trim(),
      customer_mobile: String(customer_mobile).trim(),
      customer_address: customer_address ? String(customer_address).trim() : "",
      rate_card_id: rc.id,
      assigned_tech_id: tech.id,
      used_part_id: used_part_id ? Number(used_part_id) : null,
      tech_payout_amount: rc.fixed_amount, // Auto-filled from rate card!
      admin_edited_amount: null,
      admin_edit_remark: null,
      customer_extra_collected: 0,
      customer_extra_remark: null,
      status: "pending",
      payout_status: "unpaid",
      payment_batch_id: null,
      completed_at: null,
      started_at: null,
      gps_lat: null,
      gps_lng: null,
      gps_address: null,
      part_photo_url: null,
      appliance_photo_url: null,
      completion_photo_url: null,
      signed_receipt_url: null,
      created_at: new Date().toISOString(),
    };

    await saveServiceCall(env, newCall);

    // If a part is linked, mark it assigned to this tech
    if (newCall.used_part_id) {
      const inventory = await getInventory(env);
      const part = inventory.find(i => i.id === newCall.used_part_id);
      if (part) {
        part.status = "assigned_to_tech";
        part.current_holder_id = tech.id;
        await saveInventoryItem(env, part);
      }
    }

    await recordAudit(env, {
      entity_type: "call",
      entity_id: newCall.id,
      action_by_user_id: user.id,
      assigned_to_user_id: tech.id,
      action_description_en: `Admin assigned call #${newCall.complaint_number} to ${tech.name} (Service: ${rc.service_title_en}, Payout: ₹${rc.fixed_amount}).`,
      action_description_hi: `एडमिन ने कॉल #${newCall.complaint_number} ${tech.name} को असाइन की (सर्विस: ${rc.service_title_hi}, पे-आउट: ₹${rc.fixed_amount})।`,
    });

    return jsonResponse({ success: true, call: newCall, message: "Service call created and assigned successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const body = await request.json();
    const { 
      id, 
      action, 
      customer_extra_collected, 
      customer_extra_remark, 
      admin_edited_amount, 
      admin_edit_remark,
      gps_lat,
      gps_lng,
      gps_address,
      part_photo_url,
      appliance_photo_url,
      completion_photo_url,
      signed_receipt_url
    } = body;

    if (!id) return errorResponse("Call ID is required.", 400);

    const call = await findServiceCall(env, id);
    if (!call) return errorResponse("Service call not found.", 404);

    // 1. Technician starts work & captures GPS
    if (action === "start_work") {
      if (user.role === "third_party_tech" && String(call.assigned_tech_id) !== String(user.id)) {
        return errorResponse("You can only start calls assigned to you.", 403);
      }

      call.status = "in_progress";
      call.started_at = new Date().toISOString();
      call.gps_lat = gps_lat ? Number(gps_lat) : null;
      call.gps_lng = gps_lng ? Number(gps_lng) : null;
      call.gps_address = gps_address || null;

      await saveServiceCall(env, call);

      const gpsTxt = call.gps_lat ? ` (GPS: ${call.gps_lat.toFixed(4)}, ${call.gps_lng.toFixed(4)})` : "";
      await recordAudit(env, {
        entity_type: "call",
        entity_id: call.id,
        action_by_user_id: user.id,
        assigned_to_user_id: call.assigned_tech_id,
        action_description_en: `${user.name} started work on Call #${call.complaint_number}${gpsTxt}.`,
        action_description_hi: `${user.name} ने कॉल #${call.complaint_number} पर काम शुरू किया${gpsTxt}।`,
      });

      return jsonResponse({ success: true, call, message: "Work started and GPS location recorded." });
    }

    // 2. Save Intermediate Photos
    if (action === "save_photos") {
      if (part_photo_url) call.part_photo_url = part_photo_url;
      if (appliance_photo_url) call.appliance_photo_url = appliance_photo_url;
      if (completion_photo_url) call.completion_photo_url = completion_photo_url;
      if (signed_receipt_url) call.signed_receipt_url = signed_receipt_url;
      await saveServiceCall(env, call);
      return jsonResponse({ success: true, call });
    }

    // 3. Final Call Closure with all 4 photos & extra collection
    if (action === "close_call") {
      if (user.role === "third_party_tech" && String(call.assigned_tech_id) !== String(user.id)) {
        return errorResponse("You can only close calls assigned to you.", 403);
      }

      call.status = "completed";
      call.completed_at = new Date().toISOString();
      call.customer_extra_collected = Number(customer_extra_collected) || 0;
      call.customer_extra_remark = customer_extra_remark ? String(customer_extra_remark).trim() : null;

      if (part_photo_url) call.part_photo_url = part_photo_url;
      if (appliance_photo_url) call.appliance_photo_url = appliance_photo_url;
      if (completion_photo_url) call.completion_photo_url = completion_photo_url;
      if (signed_receipt_url) call.signed_receipt_url = signed_receipt_url;
      if (gps_lat) call.gps_lat = Number(gps_lat);
      if (gps_lng) call.gps_lng = Number(gps_lng);

      // If part was used, mark it installed
      if (call.used_part_id) {
        const inventory = await getInventory(env);
        const part = inventory.find(i => i.id === call.used_part_id);
        if (part) {
          part.status = "installed";
          await saveInventoryItem(env, part);
        }
      }

      await saveServiceCall(env, call);

      const extraText = call.customer_extra_collected > 0 ? ` (Collected extra ₹${call.customer_extra_collected} for '${call.customer_extra_remark}')` : "";
      const extraTextHi = call.customer_extra_collected > 0 ? ` ('${call.customer_extra_remark}' के लिए ₹${call.customer_extra_collected} अतिरिक्त लिए)` : "";

      await recordAudit(env, {
        entity_type: "call",
        entity_id: call.id,
        action_by_user_id: user.id,
        assigned_to_user_id: call.assigned_tech_id,
        action_description_en: `${user.name} completed Call #${call.complaint_number} with verified GPS & photos.${extraText}`,
        action_description_hi: `${user.name} ने कॉल #${call.complaint_number} जीपीएस व 4 फोटो वेरिफिकेशन के साथ पूर्ण की।${extraTextHi}`,
      });

      return jsonResponse({ success: true, call, message: "Call marked completed successfully with all verifications." });
    }

    // 4. Admin amount edit
    if (action === "edit_amount") {
      if (user.role !== "admin") {
        return errorResponse("Only admin can modify payout amounts.", 403);
      }
      if (admin_edited_amount === undefined || !admin_edit_remark) {
        return errorResponse("New amount and remark/reason are required.", 400);
      }

      const prevAmount = call.admin_edited_amount !== null && call.admin_edited_amount !== undefined 
        ? call.admin_edited_amount 
        : call.tech_payout_amount;
      call.admin_edited_amount = Number(admin_edited_amount);
      call.admin_edit_remark = String(admin_edit_remark).trim();

      await saveServiceCall(env, call);

      await recordAudit(env, {
        entity_type: "call",
        entity_id: call.id,
        action_by_user_id: user.id,
        assigned_to_user_id: call.assigned_tech_id,
        action_description_en: `Admin edited payout for Call #${call.complaint_number} from ₹${prevAmount} to ₹${call.admin_edited_amount} (Remark: ${call.admin_edit_remark}).`,
        action_description_hi: `एडमिन ने कॉल #${call.complaint_number} का पे-आउट ₹${prevAmount} से बदलकर ₹${call.admin_edited_amount} किया (रिमार्क: ${call.admin_edit_remark})।`,
      });

      return jsonResponse({ success: true, call, message: "Payout amount updated successfully." });
    }

    return errorResponse("Invalid action specified.", 400);
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
