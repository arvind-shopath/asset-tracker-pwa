import { jsonResponse, errorResponse, verifyAuth, getInventory, saveInventoryItem, findInventoryItem, recordAudit, getCategories, getUsers } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("category_id");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q");

    let items = await getInventory(env);

    // If Third-party tech, only return items in their custody or installed by them
    if (user.role === "third_party_tech") {
      items = items.filter(i => String(i.current_holder_id) === String(user.id));
    }

    if (categoryId && categoryId !== "all") {
      items = items.filter(i => String(i.category_id) === String(categoryId));
    }

    if (status && status !== "all") {
      items = items.filter(i => i.status === status);
    }

    if (search) {
      const q = search.trim().toUpperCase();
      items = items.filter(i =>
        String(i.serial_number || "").toUpperCase().includes(q) ||
        String(i.part_name || "").toUpperCase().includes(q) ||
        String(i.model_number || "").toUpperCase().includes(q)
      );
    }

    const categories = await getCategories(env);
    const users = await getUsers(env);

    const enriched = items.map(item => {
      const cat = categories.find(c => c.id === item.category_id);
      const holder = users.find(u => u.id === item.current_holder_id);
      return {
        ...item,
        category_name_en: cat ? cat.name_en : "Unassigned Bucket",
        category_name_hi: cat ? cat.name_hi : "अवर्गीकृत बकेट",
        holder_name: holder ? holder.name : "Store / Warehouse",
        holder_mobile: holder ? holder.mobile : "",
      };
    });

    return jsonResponse({ success: true, count: enriched.length, items: enriched });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  // Both Admin and In-House Staff can receive inventory
  if (user.role === "third_party_tech") {
    return errorResponse("Technicians cannot receive new inventory items directly.", 403);
  }

  try {
    const body = await request.json();
    const { part_name, model_number, serial_number, category_id, invoice_image_url } = body;

    if (!part_name || !serial_number) {
      return errorResponse("Part name and serial number are required.", 400);
    }

    const cleanSerial = String(serial_number).trim().toUpperCase();
    const existing = await findInventoryItem(env, cleanSerial);
    if (existing) {
      return errorResponse(`Serial number ${cleanSerial} already exists in inventory.`, 409);
    }

    const newItem = {
      id: Date.now(),
      category_id: category_id ? Number(category_id) : null,
      part_name: String(part_name).trim(),
      model_number: model_number ? String(model_number).trim() : "",
      serial_number: cleanSerial,
      status: category_id ? "in_storage" : "received",
      current_holder_id: null,
      invoice_image_url: invoice_image_url || null,
      challan_number: null,
      return_slip_url: null,
      created_at: new Date().toISOString(),
    };

    await saveInventoryItem(env, newItem);

    // Audit log
    await recordAudit(env, {
      entity_type: "part",
      entity_id: newItem.id,
      action_by_user_id: user.id,
      assigned_to_user_id: null,
      action_description_en: `${user.name} received new part '${newItem.part_name}' (SN: ${newItem.serial_number}).`,
      action_description_hi: `${user.name} ने नया पार्ट '${newItem.part_name}' (सीरियल: ${newItem.serial_number}) स्टॉक में रिसीव किया।`,
    });

    return jsonResponse({ success: true, item: newItem, message: "Inventory item received successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const body = await request.json();
    const { id, serial_number, action, category_id, tech_id, challan_number, return_slip_url, remarks } = body;

    let item = null;
    if (id) {
      const all = await getInventory(env);
      item = all.find(i => i.id === Number(id));
    } else if (serial_number) {
      item = await findInventoryItem(env, serial_number);
    }

    if (!item) {
      return errorResponse("Inventory item not found.", 404);
    }

    const users = await getUsers(env);

    if (action === "put_in_storage") {
      item.category_id = category_id ? Number(category_id) : item.category_id;
      item.status = "in_storage";
      item.current_holder_id = null;

      await saveInventoryItem(env, item);
      await recordAudit(env, {
        entity_type: "part",
        entity_id: item.id,
        action_by_user_id: user.id,
        assigned_to_user_id: null,
        action_description_en: `${user.name} placed part ${item.serial_number} into storage bucket.`,
        action_description_hi: `${user.name} ने पार्ट ${item.serial_number} को स्टोरेज बकेट में रखा।`,
      });
    } else if (action === "handover_to_tech") {
      if (!tech_id) return errorResponse("Technician ID is required for handover.", 400);
      const tech = users.find(u => u.id === Number(tech_id));
      if (!tech) return errorResponse("Technician not found.", 404);

      item.status = "assigned_to_tech";
      item.current_holder_id = tech.id;

      await saveInventoryItem(env, item);
      await recordAudit(env, {
        entity_type: "part",
        entity_id: item.id,
        action_by_user_id: user.id,
        assigned_to_user_id: tech.id,
        action_description_en: `${user.name} handed over part ${item.serial_number} to Technician ${tech.name}.`,
        action_description_hi: `${user.name} ने पार्ट ${item.serial_number} टेक्नीशियन ${tech.name} को हैंडओवर किया।`,
      });
    } else if (action === "return_to_company") {
      if (!challan_number) return errorResponse("Challan number is required.", 400);
      item.status = "returned_to_company";
      item.challan_number = String(challan_number).trim();
      item.return_slip_url = return_slip_url || item.return_slip_url;

      await saveInventoryItem(env, item);
      await recordAudit(env, {
        entity_type: "part",
        entity_id: item.id,
        action_by_user_id: user.id,
        assigned_to_user_id: null,
        action_description_en: `${user.name} dispatched defective part ${item.serial_number} to company with Challan #${item.challan_number}.`,
        action_description_hi: `${user.name} ने खराब पार्ट ${item.serial_number} को चालान #${item.challan_number} के साथ कंपनी भेजा।`,
      });
    } else if (action === "mark_installed") {
      item.status = "installed";
      await saveInventoryItem(env, item);
      await recordAudit(env, {
        entity_type: "part",
        entity_id: item.id,
        action_by_user_id: user.id,
        assigned_to_user_id: null,
        action_description_en: `${user.name} recorded installation for part ${item.serial_number} (${remarks || "Installed"}).`,
        action_description_hi: `${user.name} ने पार्ट ${item.serial_number} का इंस्टॉलेशन दर्ज किया (${remarks || "सफलतापूर्वक स्थापित"})।`,
      });
    } else if (action === "mark_rejected") {
      item.status = "rejected_defective";
      await saveInventoryItem(env, item);
      await recordAudit(env, {
        entity_type: "part",
        entity_id: item.id,
        action_by_user_id: user.id,
        assigned_to_user_id: null,
        action_description_en: `${user.name} marked part ${item.serial_number} as rejected/defective (${remarks || "Defective"}).`,
        action_description_hi: `${user.name} ने पार्ट ${item.serial_number} को डिफेक्टिव/रिजेक्टेड मार्क किया (${remarks || "खराब"})।`,
      });
    }

    return jsonResponse({ success: true, item, message: "Inventory item updated successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
