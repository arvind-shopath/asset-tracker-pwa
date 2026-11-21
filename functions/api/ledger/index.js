import { jsonResponse, errorResponse, verifyAuth, getServiceCalls, saveServiceCall, getPaymentBatches, savePaymentBatch, getUsers, recordAudit } from "../_utils.js";

function getBatchMode(b) {
  if (b.payment_mode) return b.payment_mode;
  const rem = String(b.remarks || "").toUpperCase();
  if (rem.includes("[CASH_DEPOSIT]") || rem.includes("COUNTER CASH") || rem.includes("CASH DEPOSIT") || rem.includes("कस्टमर कैश काउंटर")) return "customer_cash_deposit";
  if (rem.includes("[ADVANCE]") || rem.includes("ADVANCE") || rem.includes("एडवांस")) return "advance";
  if (rem.includes("[CASH]") || rem.includes("CASH") || rem.includes("नकद")) return "cash";
  return "upi";
}

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  // In-House Staff is strictly barred from seeing financial ledgers
  if (user.role === "in_house_staff") {
    return errorResponse("Access denied. Financial ledger is not accessible to in-house store staff.", 403);
  }

  try {
    const url = new URL(request.url);
    const techIdParam = url.searchParams.get("tech_id");

    const users = await getUsers(env);
    const allCalls = await getServiceCalls(env);
    const allBatches = await getPaymentBatches(env);

    // If technician, force techId to their own id
    const targetTechId = user.role === "third_party_tech" ? user.id : (techIdParam ? Number(techIdParam) : null);

    if (targetTechId) {
      const tech = users.find(u => u.id === targetTechId);
      const techCalls = allCalls.filter(c => String(c.assigned_tech_id) === String(targetTechId));
      const techBatches = allBatches.filter(b => String(b.tech_id) === String(targetTechId));

      const completedCalls = techCalls.filter(c => c.status === "completed");
      const totalEarned = completedCalls.reduce((sum, c) => {
        const amt = c.admin_edited_amount !== null && c.admin_edited_amount !== undefined ? c.admin_edited_amount : c.tech_payout_amount;
        return sum + (Number(amt) || 0);
      }, 0);

      // Customer cash collected by tech in field
      const rawCustomerCollected = completedCalls.reduce((sum, c) => {
        return sum + (Number(c.customer_extra_collected) || 0);
      }, 0);

      // Customer cash deposited by tech to service center counter
      const customerCashDeposited = techBatches
        .filter(b => getBatchMode(b) === "customer_cash_deposit")
        .reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);

      const totalCustomerCollected = Math.max(0, rawCustomerCollected - customerCashDeposited);

      // Direct payouts from admin to tech (cash, advance, upi)
      const adminPayoutBatches = techBatches.filter(b => getBatchMode(b) !== "customer_cash_deposit");
      const totalPaid = adminPayoutBatches.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);
      const pendingBalance = Math.max(0, totalEarned - totalPaid);
      const advanceBalance = Math.max(0, totalPaid - totalEarned);

      return jsonResponse({
        success: true,
        tech: { id: tech?.id, name: tech?.name, mobile: tech?.mobile },
        summary: {
          totalCalls: techCalls.length,
          completedCalls: completedCalls.length,
          pendingCalls: techCalls.filter(c => c.status === "pending").length,
          totalEarned,
          rawCustomerCollected,
          customerCashDeposited,
          totalCustomerCollected,
          totalPaid,
          pendingBalance,
          advanceBalance,
        },
        unpaidCalls: completedCalls.filter(c => c.payout_status === "unpaid"),
        paidCalls: completedCalls.filter(c => c.payout_status === "paid"),
        batches: techBatches,
      });
    }

    // Admin overview: list all technicians and their ledger summary
    const technicians = users.filter(u => u.role === "third_party_tech");
    const techSummaries = technicians.map(t => {
      const tCalls = allCalls.filter(c => String(c.assigned_tech_id) === String(t.id) && c.status === "completed");
      const tBatches = allBatches.filter(b => String(b.tech_id) === String(t.id));

      const earned = tCalls.reduce((sum, c) => {
        const amt = c.admin_edited_amount !== null && c.admin_edited_amount !== undefined ? c.admin_edited_amount : c.tech_payout_amount;
        return sum + (Number(amt) || 0);
      }, 0);

      const rawCustomerCollected = tCalls.reduce((sum, c) => sum + (Number(c.customer_extra_collected) || 0), 0);
      const customerCashDeposited = tBatches
        .filter(b => getBatchMode(b) === "customer_cash_deposit")
        .reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);
      const customerCollected = Math.max(0, rawCustomerCollected - customerCashDeposited);

      const adminPayoutBatches = tBatches.filter(b => getBatchMode(b) !== "customer_cash_deposit");
      const paid = adminPayoutBatches.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);
      const pending = Math.max(0, earned - paid);
      const advance = Math.max(0, paid - earned);

      return {
        tech_id: t.id,
        name: t.name,
        mobile: t.mobile,
        totalCompletedCalls: tCalls.length,
        totalEarned: earned,
        rawCustomerCollected,
        customerCashDeposited,
        totalCustomerCollected: customerCollected,
        totalPaid: paid,
        pendingBalance: pending,
        advanceBalance: advance,
        unpaidCallsCount: tCalls.filter(c => c.payout_status === "unpaid").length,
      };
    });

    return jsonResponse({
      success: true,
      technicians: techSummaries,
      recentBatches: allBatches.slice(0, 10),
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can record payouts or settlements.", 403);
  }

  try {
    const body = await request.json();
    const { tech_id, call_ids, amount_paid, payment_screenshot_url, remarks, payment_mode } = body;

    if (!tech_id || !amount_paid) {
      return errorResponse("Technician ID and amount paid are required.", 400);
    }

    const users = await getUsers(env);
    const tech = users.find(u => u.id === Number(tech_id));
    if (!tech) return errorResponse("Technician not found.", 404);

    const mode = payment_mode || (call_ids && call_ids.length > 0 ? "upi" : "cash");
    let modePrefix = "[UPI]";
    if (mode === "customer_cash_deposit") modePrefix = "[CASH_DEPOSIT]";
    else if (mode === "advance") modePrefix = "[ADVANCE]";
    else if (mode === "cash") modePrefix = "[CASH]";

    const userRemark = remarks ? String(remarks).trim() : "";
    const fullRemark = userRemark ? `${modePrefix} ${userRemark}` : (
      mode === "customer_cash_deposit" ? "[CASH_DEPOSIT] कस्टमर कैश काउंटर पर जमा किया" :
      mode === "advance" ? "[ADVANCE] कर्मचारी को एडवांस भुगतान" :
      mode === "cash" ? "[CASH] हाथ में नकद भुगतान" :
      `[UPI] settlement for ${call_ids ? call_ids.length : 0} calls`
    );

    const batch = {
      id: Date.now(),
      tech_id: Number(tech_id),
      amount_paid: Number(amount_paid),
      payment_mode: mode,
      payment_screenshot_url: payment_screenshot_url || null,
      remarks: fullRemark,
      paid_at: new Date().toISOString(),
    };

    await savePaymentBatch(env, batch);

    // If specific call IDs were selected, mark them as paid
    if (call_ids && Array.isArray(call_ids) && call_ids.length > 0) {
      const allCalls = await getServiceCalls(env);
      for (const cid of call_ids) {
        const c = allCalls.find(item => item.id === Number(cid));
        if (c) {
          c.payout_status = "paid";
          c.payment_batch_id = batch.id;
          await saveServiceCall(env, c);
        }
      }
    }

    await recordAudit(env, {
      entity_type: "payment",
      entity_id: batch.id,
      action_by_user_id: user.id,
      assigned_to_user_id: tech.id,
      action_description_en: mode === "customer_cash_deposit" 
        ? `Technician ${tech.name} deposited ₹${batch.amount_paid} customer cash at counter (${batch.remarks}).`
        : `Admin recorded ₹${batch.amount_paid} (${mode.toUpperCase()}) payout to ${tech.name} (${batch.remarks}).`,
      action_description_hi: mode === "customer_cash_deposit"
        ? `टेक्नीशियन ${tech.name} ने काउंटर पर ₹${batch.amount_paid} कस्टमर कैश जमा किया (${batch.remarks})।`
        : `एडमिन ने ${tech.name} को ₹${batch.amount_paid} (${mode === 'cash' ? 'नकद' : (mode === 'advance' ? 'एडवांस' : 'UPI')}) भुगतान दर्ज किया (${batch.remarks})।`,
    });

    return jsonResponse({
      success: true,
      batch,
      message: `Successfully recorded ₹${batch.amount_paid} (${mode}) for ${tech.name}.`,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
