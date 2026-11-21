import { jsonResponse, errorResponse, verifyAuth, getInventory, getServiceCalls, getPaymentBatches, getAuditLogs, getUsers } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const inventory = await getInventory(env);
    const auditLogs = await getAuditLogs(env);

    // 4 Master Tiles
    const receivedCount = inventory.filter(i => i.status === "received").length;
    const inStorageCount = inventory.filter(i => i.status === "in_storage").length;
    const rejectedCount = inventory.filter(i => i.status === "rejected_defective").length;
    const installedHandoverCount = inventory.filter(i => i.status === "installed" || i.status === "assigned_to_tech").length;

    let roleSpecificData = {};

    if (user.role === "third_party_tech") {
      const myCalls = await getServiceCalls(env, user.id);
      const myBatches = await getPaymentBatches(env, user.id);

      const totalCalls = myCalls.length;
      const completedCalls = myCalls.filter(c => c.status === "completed");
      const pendingCalls = myCalls.filter(c => c.status === "pending");

      // Calculate total earnings: use admin_edited_amount if available, else tech_payout_amount
      const totalEarned = completedCalls.reduce((sum, c) => {
        const amt = c.admin_edited_amount !== null && c.admin_edited_amount !== undefined ? c.admin_edited_amount : c.tech_payout_amount;
        return sum + (Number(amt) || 0);
      }, 0);

      const totalPaid = myBatches.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);
      const pendingBalance = Math.max(0, totalEarned - totalPaid);

      const myStock = inventory.filter(i => String(i.current_holder_id) === String(user.id) && i.status === "assigned_to_tech");

      roleSpecificData = {
        totalCalls,
        completedCount: completedCalls.length,
        pendingCallsCount: pendingCalls.length,
        totalEarned,
        totalPaid,
        pendingBalance,
        stockInHandCount: myStock.length,
      };
    } else if (user.role === "in_house_staff") {
      // In-house staff strictly gets inventory numbers, no payouts or call rates!
      roleSpecificData = {
        totalInventory: inventory.length,
      };
    } else {
      // Admin gets full financial overview & call stats
      const allCalls = await getServiceCalls(env);
      const allBatches = await getPaymentBatches(env);

      const pendingCallsCount = allCalls.filter(c => c.status === "pending").length;
      const completedCallsCount = allCalls.filter(c => c.status === "completed").length;
      
      const totalPayoutDue = allCalls.filter(c => c.status === "completed").reduce((sum, c) => {
        const amt = c.admin_edited_amount !== null && c.admin_edited_amount !== undefined ? c.admin_edited_amount : c.tech_payout_amount;
        return sum + (Number(amt) || 0);
      }, 0);
      const totalPayoutPaid = allBatches.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);

      roleSpecificData = {
        totalCalls: allCalls.length,
        pendingCallsCount,
        completedCallsCount,
        totalPayoutDue,
        totalPayoutPaid,
        pendingPayoutBalance: Math.max(0, totalPayoutDue - totalPayoutPaid),
      };
    }

    const users = await getUsers(env);
    const enrichedLogs = auditLogs.slice(0, 20).map(a => {
      const actor = users.find(u => u.id === a.action_by_user_id);
      const targetUser = users.find(u => u.id === a.assigned_to_user_id);
      return {
        ...a,
        actor_name: actor ? actor.name : "Staff",
        actor_phone: actor ? actor.mobile : "",
        target_name: targetUser ? targetUser.name : null,
        target_id: targetUser ? targetUser.id : null,
      };
    });

    return jsonResponse({
      success: true,
      userRole: user.role,
      tiles: {
        received: receivedCount,
        in_storage: inStorageCount,
        rejected: rejectedCount,
        installed_handover: installedHandoverCount,
        total_items: inventory.length,
      },
      stats: roleSpecificData,
      recentActivity: enrichedLogs,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
