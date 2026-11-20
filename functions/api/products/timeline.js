import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const serial = url.searchParams.get("serial") || url.searchParams.get("serialNumber");

    if (!serial) {
      return errorResponse("Serial number is required.", 400);
    }

    const cleanSerial = String(serial).trim();
    let product = null;
    let timeline = [];

    // 1. Try KV first
    if (env.KV) {
      // Direct product key
      product = await env.KV.get(`product:${cleanSerial}`, "json");
      timeline = (await env.KV.get(`timeline:${cleanSerial}`, "json")) || [];

      // If not found by exact key, search in products_list (case-insensitive)
      if (!product) {
        const list = (await env.KV.get("products_list", "json")) || [];
        product = list.find((p) => String(p.serial_number || "").trim().toUpperCase() === cleanSerial.toUpperCase());
        if (product && (!timeline || timeline.length === 0)) {
          timeline = (await env.KV.get(`timeline:${product.serial_number}`, "json")) || [];
        }
      }

      // If timeline has events but product object is missing, build product representation
      if (!product && timeline && timeline.length > 0) {
        const lastEv = timeline[timeline.length - 1];
        product = {
          serial_number: cleanSerial,
          name: "Asset Item " + cleanSerial,
          current_status: (lastEv.action || "received").toLowerCase(),
          updated_at: lastEv.timestamp,
        };
      }
    }

    // 2. Try D1 if product not found yet
    if (!product && env.DB) {
      try {
        product = await env.DB.prepare(
          "SELECT * FROM products WHERE UPPER(serial_number) = UPPER(?)"
        ).bind(cleanSerial).first();

        const { results } = await env.DB.prepare(
          "SELECT * FROM audit_trail WHERE UPPER(serial_number) = UPPER(?) ORDER BY timestamp ASC"
        ).bind(cleanSerial).all();

        if (results && results.length > 0) {
          timeline = results.map((row) => {
            let details = {};
            try { details = JSON.parse(row.details_json || "{}"); } catch (e) { details = { raw: row.details_json }; }
            return {
              id: row.id,
              action: row.action,
              actorName: row.actor_name,
              actorPhone: row.actor_phone,
              actorRole: row.actor_role,
              details,
              photoKey: row.photo_key,
              photoUrl: row.photo_key ? `/api/photo/${row.photo_key}` : null,
              gpsLat: row.gps_lat,
              gpsLng: row.gps_lng,
              timestamp: row.timestamp,
            };
          });
        }
      } catch (e) {
        console.warn("D1 timeline query warning:", e);
      }
    }

    // 3. Fallback for the 2 seeded demo products if DB/KV keys are cold
    if (!product) {
      if (cleanSerial.toUpperCase() === "SN-INST-2026-01") {
        product = {
          id: 1,
          serial_number: "SN-INST-2026-01",
          name: "Commercial Water Purification RO Unit",
          model: "AquaPro-50X",
          supplier: "Ion Exchange Tech",
          current_status: "installed",
          storage_location: "Rack A-04, Shelf 2",
          assigned_to_name: "Dinesh Verma",
          assigned_to_phone: "9876543212",
          customer_name: "Arvind Shukla",
          customer_phone: "9876543210",
          customer_address: "56, Rajajipuram, Lucknow, UP",
          gps_lat: 26.80976,
          gps_lng: 80.89140,
          installed_photo_key: "inst_sn_inst_2026_01.webp",
          updated_at: "2026-11-20T11:45:00.000Z",
          created_at: "2026-11-20T09:30:00.000Z",
        };
        if (!timeline || timeline.length === 0) {
          timeline = [
            {
              id: 101,
              productId: 1,
              serialNumber: "SN-INST-2026-01",
              action: "RECEIVE",
              actorName: "Administrator",
              actorPhone: "9876543210",
              actorRole: "admin",
              details: { supplier: "Ion Exchange Tech", model: "AquaPro-50X", notes: "Inbound consignment received at Central Warehouse" },
              timestamp: "2026-11-20T09:30:00.000Z",
            },
            {
              id: 102,
              productId: 1,
              serialNumber: "SN-INST-2026-01",
              action: "PUT_IN_STORAGE",
              actorName: "Rahul Sharma",
              actorPhone: "9876543211",
              actorRole: "employee",
              details: { location: "Rack A-04, Shelf 2", notes: "Barcodes verified and stacked in Storage" },
              timestamp: "2026-11-20T09:50:00.000Z",
            },
            {
              id: 103,
              productId: 1,
              serialNumber: "SN-INST-2026-01",
              action: "HANDOVER_FOR_INSTALL",
              actorName: "Rahul Sharma",
              actorPhone: "9876543211",
              actorRole: "employee",
              details: { assignedTo: "Dinesh Verma (9876543212)", customer: "Arvind Shukla (9876543210)", notes: "Issued to Dinesh Verma for site installation at Rajajipuram" },
              timestamp: "2026-11-20T10:20:00.000Z",
            },
            {
              id: 104,
              productId: 1,
              serialNumber: "SN-INST-2026-01",
              action: "MARK_INSTALLED",
              actorName: "Dinesh Verma",
              actorPhone: "9876543212",
              actorRole: "employee",
              details: { customerName: "Arvind Shukla", customerPhone: "9876543210", address: "56, Rajajipuram, Lucknow, UP", notes: "Successfully installed and tested. Customer signature verified." },
              photoKey: "inst_sn_inst_2026_01.webp",
              photoUrl: "/api/photo/inst_sn_inst_2026_01.webp",
              gpsLat: 26.80976,
              gpsLng: 80.89140,
              timestamp: "2026-11-20T11:45:00.000Z",
            },
          ];
        }
      } else if (cleanSerial.toUpperCase() === "SN-RET-2026-02") {
        product = {
          id: 2,
          serial_number: "SN-RET-2026-02",
          name: "Industrial Digital Flow Sensor Meter",
          model: "FlowSense-V2",
          supplier: "Sensotech Precision",
          current_status: "rejected",
          storage_location: "Rack B-01, Shelf 3",
          assigned_to_name: "Manoj Singh",
          assigned_to_phone: "9876543213",
          customer_name: "Rajesh Patel",
          customer_phone: "9811223344",
          rejected_reason: "Packaging Damaged during transit / Outer casing dent",
          pickup_person_name: "Vinay Kumar",
          pickup_person_phone: "9876543214",
          pickup_remarks: "BlueDart Waybill #BD-98273619-IN returned safely to Hub",
          updated_at: "2026-11-20T12:15:00.000Z",
          created_at: "2026-11-20T09:15:00.000Z",
        };
        if (!timeline || timeline.length === 0) {
          timeline = [
            {
              id: 201,
              productId: 2,
              serialNumber: "SN-RET-2026-02",
              action: "RECEIVE",
              actorName: "Administrator",
              actorPhone: "9876543210",
              actorRole: "admin",
              details: { supplier: "Sensotech Precision", model: "FlowSense-V2", notes: "Inbound shipment from Delhi regional hub" },
              timestamp: "2026-11-20T09:15:00.000Z",
            },
            {
              id: 202,
              productId: 2,
              serialNumber: "SN-RET-2026-02",
              action: "PUT_IN_STORAGE",
              actorName: "Manoj Singh",
              actorPhone: "9876543213",
              actorRole: "employee",
              details: { location: "Rack B-01, Shelf 3", notes: "Safely kept in electronics bay" },
              timestamp: "2026-11-20T09:35:00.000Z",
            },
            {
              id: 203,
              productId: 2,
              serialNumber: "SN-RET-2026-02",
              action: "HANDOVER_FOR_INSTALL",
              actorName: "Manoj Singh",
              actorPhone: "9876543213",
              actorRole: "employee",
              details: { assignedTo: "Manoj Singh (9876543213)", customer: "Rajesh Patel (9811223344)", notes: "Dispatched for customer delivery at Gomti Nagar" },
              timestamp: "2026-11-20T10:05:00.000Z",
            },
            {
              id: 204,
              productId: 2,
              serialNumber: "SN-RET-2026-02",
              action: "REJECT_PRODUCT",
              actorName: "Manoj Singh",
              actorPhone: "9876543213",
              actorRole: "employee",
              details: { reason: "Packaging Damaged during transit / Customer refused delivery due to outer casing dent", customerName: "Rajesh Patel", customerPhone: "9811223344", notes: "Customer refused delivery due to casing damage. Return requested." },
              photoKey: "rej_sn_ret_2026_02.webp",
              photoUrl: "/api/photo/rej_sn_ret_2026_02.webp",
              timestamp: "2026-11-20T11:10:00.000Z",
            },
            {
              id: 205,
              productId: 2,
              serialNumber: "SN-RET-2026-02",
              action: "REJECTED_PICKUP",
              actorName: "Vinay Kumar",
              actorPhone: "9876543214",
              actorRole: "employee",
              details: { courier: "BlueDart Logistics", trackingNo: "BD-98273619-IN", notes: "Defective item safely collected by Vinay Kumar and handed over to courier." },
              photoKey: "pick_sn_ret_2026_02.webp",
              photoUrl: "/api/photo/pick_sn_ret_2026_02.webp",
              timestamp: "2026-11-20T12:15:00.000Z",
            },
          ];
        }
      }
    }

    if (!product) {
      return errorResponse(`No record found for serial number '${cleanSerial}'.`, 404);
    }

    // Cache in KV for fast subsequent queries
    if (env.KV) {
      try {
        await env.KV.put(`product:${cleanSerial}`, JSON.stringify(product));
      } catch (e) {}
    }

    return jsonResponse({
      success: true,
      product,
      timeline: timeline || [],
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
