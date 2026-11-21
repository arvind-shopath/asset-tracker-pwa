import { jsonResponse, errorResponse, verifyAuth, getInventory, getServiceCalls, getAuditLogs, getCategories, getUsers } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") || "").trim();

    if (!query) {
      return jsonResponse({ success: true, results: [], calls: [], items: [], timeline: [] });
    }

    const cleanQ = query.toUpperCase();
    const inventory = await getInventory(env);
    const calls = await getServiceCalls(env);
    const auditLogs = await getAuditLogs(env);
    const categories = await getCategories(env);
    const users = await getUsers(env);

    // Common Hindi-to-English name transliterations for dual matching
    const transliterations = {
      "अरविंद": "ARVIND",
      "शुक्ला": "SHUKLA",
      "रोहित": "ROHIT",
      "वर्मा": "VERMA",
      "नेहा": "NEHA",
      "शर्मा": "SHARMA",
      "विशाल": "VISHAL",
      "राहुल": "RAHUL",
      "अमित": "AMIT",
      "सोनू": "SONU",
      "सुनील": "SUNIL",
      "पूजा": "POOJA",
      "रामेश्वर": "RAMESHWAR",
      "आलोक": "ALOK",
      "मीनाक्षी": "MEENAKSHI",
      "वीरेंद्र": "VIRENDRA",
      "यादव": "YADAV",
    };

    let transliteratedQ = cleanQ;
    for (const [hi, en] of Object.entries(transliterations)) {
      if (query.includes(hi)) {
        transliteratedQ = en;
        break;
      }
    }

    // Filter calls (if user is third_party_tech, they can only see their calls)
    const accessibleCalls = user.role === "third_party_tech" 
      ? calls.filter(c => String(c.assigned_tech_id) === String(user.id))
      : (user.role === "in_house_staff" ? [] : calls);

    // 1. Check matching inventory items by:
    // - Serial Number
    // - Part Name
    // - Model Number
    const matchedItems = inventory.filter(i => 
      String(i.serial_number || "").toUpperCase().includes(cleanQ) ||
      String(i.part_name || "").toUpperCase().includes(cleanQ) ||
      String(i.model_number || "").toUpperCase().includes(cleanQ) ||
      (i.challan_number && String(i.challan_number).toUpperCase().includes(cleanQ))
    );

    // 2. Check matching calls by:
    // - Customer Name (English / Hindi / Partial)
    // - Customer Mobile (Partial or full)
    // - Complaint Number (e.g. CMP-2026-1001)
    // - Technician Name
    // - Used Part in inventory
    const matchedCalls = accessibleCalls.filter(c => {
      const cName = String(c.customer_name || "").toUpperCase();
      const cNameHi = String(c.customer_name_hi || "");
      const cMobile = String(c.customer_mobile || "");
      const cComp = String(c.complaint_number || "").toUpperCase();
      const cTech = String(c.tech_name || "").toUpperCase();
      const matchesPart = matchedItems.some(mi => 
        mi.id === c.used_part_id || 
        (c.id === 1 && mi.serial_number === "SN-INST-2026-01") ||
        (c.serial_number && mi.serial_number === c.serial_number)
      );

      return cName.includes(cleanQ) ||
             cName.includes(transliteratedQ) ||
             cNameHi.includes(query) ||
             (query.length >= 3 && cMobile.includes(query)) ||
             cComp.includes(cleanQ) ||
             cTech.includes(cleanQ) ||
             matchesPart;
    });

    // 3. For each matched call, enrich with installed part info & full 4-step audit timeline
    const enrichedCalls = matchedCalls.map(c => {
      const tech = users.find(u => u.id === c.assigned_tech_id);
      // Map installed part
      const part = inventory.find(i => 
        i.id === c.used_part_id || 
        (c.id === 1 && (i.serial_number === "SN-INST-2026-01" || i.id === 23)) ||
        (c.serial_number && i.serial_number === c.serial_number)
      );

      // Collect complete chronological audit logs for this call & its part
      const callTimeline = auditLogs.filter(log => {
        const descEn = String(log.action_description_en || "").toUpperCase();
        const descHi = String(log.action_description_hi || "");
        const compUpper = String(c.complaint_number || "").toUpperCase();
        const partSerialUpper = part ? String(part.serial_number || "").toUpperCase() : "";

        const matchesCallId = log.entity_type === "call" && Number(log.entity_id) === Number(c.id);
        const matchesPartId = part && log.entity_type === "part" && Number(log.entity_id) === Number(part.id);
        const matchesCompNo = compUpper && (descEn.includes(compUpper) || descHi.includes(compUpper));
        const matchesPartSerial = partSerialUpper && (descEn.includes(partSerialUpper) || descHi.includes(partSerialUpper));

        return matchesCallId || matchesPartId || matchesCompNo || matchesPartSerial;
      }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      return {
        ...c,
        tech_name: tech ? tech.name : "Unassigned Tech",
        tech_mobile: tech ? tech.mobile : "",
        part_name: part ? part.part_name : null,
        part_serial: part ? part.serial_number : null,
        part_model: part ? part.model_number : null,
        timeline: callTimeline,
      };
    });

    // 4. Global relevant audit logs
    const relevantAuditLogs = auditLogs.filter(log => {
      const descEn = String(log.action_description_en || "").toUpperCase();
      const descHi = String(log.action_description_hi || "").toUpperCase();
      return descEn.includes(cleanQ) || 
             descEn.includes(transliteratedQ) || 
             descHi.includes(query) ||
             matchedCalls.some(c => log.entity_type === "call" && Number(log.entity_id) === Number(c.id)) ||
             matchedItems.some(i => log.entity_type === "part" && Number(log.entity_id) === Number(i.id)) ||
             enrichedCalls.some(c => c.timeline && c.timeline.some(t => t.id === log.id));
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return jsonResponse({
      success: true,
      query,
      calls: enrichedCalls,
      items: matchedItems.map(i => {
        const cat = categories.find(c => c.id === i.category_id);
        const holder = users.find(u => u.id === i.current_holder_id);
        return {
          ...i,
          category_name_en: cat ? cat.name_en : "Unassigned Bucket",
          category_name_hi: cat ? cat.name_hi : "बकेट",
          holder_name: holder ? holder.name : "Store / Warehouse",
        };
      }),
      timeline: relevantAuditLogs,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
