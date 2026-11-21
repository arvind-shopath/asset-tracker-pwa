import { jsonResponse, errorResponse, verifyAuth, getInventory, getServiceCalls, getAuditLogs, getCategories, getUsers } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") || "").trim();

    if (!query) {
      return jsonResponse({ success: true, results: [], timeline: [] });
    }

    const cleanQ = query.toUpperCase();
    const inventory = await getInventory(env);
    const calls = await getServiceCalls(env);
    const auditLogs = await getAuditLogs(env);
    const categories = await getCategories(env);
    const users = await getUsers(env);

    // Filter calls (if user is third_party_tech, they can only see their calls)
    const accessibleCalls = user.role === "third_party_tech" 
      ? calls.filter(c => String(c.assigned_tech_id) === String(user.id))
      : (user.role === "in_house_staff" ? [] : calls);

    // 1. Check matching calls
    const matchedCalls = accessibleCalls.filter(c => 
      String(c.complaint_number || "").toUpperCase().includes(cleanQ) ||
      String(c.customer_mobile || "").includes(query) ||
      String(c.customer_name || "").toUpperCase().includes(cleanQ)
    );

    // 2. Check matching inventory items
    const matchedItems = inventory.filter(i => 
      String(i.serial_number || "").toUpperCase().includes(cleanQ) ||
      String(i.part_name || "").toUpperCase().includes(cleanQ) ||
      String(i.model_number || "").toUpperCase().includes(cleanQ)
    );

    // 3. Find matching audit logs
    const relevantAuditLogs = auditLogs.filter(log => {
      const descEn = String(log.action_description_en || "").toUpperCase();
      const descHi = String(log.action_description_hi || "").toUpperCase();
      return descEn.includes(cleanQ) || descHi.includes(cleanQ) ||
        matchedCalls.some(c => log.entity_type === "call" && log.entity_id === c.id) ||
        matchedItems.some(i => log.entity_type === "part" && log.entity_id === i.id);
    });

    return jsonResponse({
      success: true,
      query,
      calls: matchedCalls.map(c => {
        const tech = users.find(u => u.id === c.assigned_tech_id);
        const part = inventory.find(i => i.id === c.used_part_id);
        return {
          ...c,
          tech_name: tech ? tech.name : "Unassigned",
          tech_mobile: tech ? tech.mobile : "",
          part_name: part ? part.part_name : null,
          part_serial: part ? part.serial_number : null,
        };
      }),
      items: matchedItems.map(i => {
        const cat = categories.find(c => c.id === i.category_id);
        const holder = users.find(u => u.id === i.current_holder_id);
        return {
          ...i,
          category_name_en: cat ? cat.name_en : "Unassigned Bucket",
          category_name_hi: cat ? cat.name_hi : "अवर्गीकृत बकेट",
          holder_name: holder ? holder.name : "Store / Warehouse",
        };
      }),
      timeline: relevantAuditLogs,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
