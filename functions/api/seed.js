import { jsonResponse, errorResponse } from "./_utils.js";

// Endpoint to reset and seed the realistic workflow dataset requested by user
export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);

    // 1. Five Official Staff Members
    const officialUsers = [
      { id: 1, name: "Administrator", phone: "9876543210", pin: "1234", role: "admin", is_active: 1 },
      { id: 2, name: "Rahul Sharma", phone: "9876543211", pin: "1234", role: "employee", is_active: 1 },
      { id: 3, name: "Dinesh Verma", phone: "9876543212", pin: "1234", role: "employee", is_active: 1 },
      { id: 4, name: "Manoj Singh", phone: "9876543213", pin: "1234", role: "employee", is_active: 1 },
      { id: 5, name: "Vinay Kumar", phone: "9876543214", pin: "1234", role: "employee", is_active: 1 },
    ];

    // 2. Exactly Two Real-World Lifecycle Products
    const products = [
      {
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
      },
      {
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
      },
    ];

    // 3. Timelines for both products
    const timeline1 = [
      {
        id: 101,
        productId: 1,
        serialNumber: "SN-INST-2026-01",
        action: "RECEIVE",
        actorName: "Administrator",
        actorPhone: "9876543210",
        actorRole: "admin",
        details: { supplier: "Ion Exchange Tech", model: "AquaPro-50X", notes: "Inbound consignment received at Central Warehouse" },
        photoKey: null,
        photoUrl: null,
        gpsLat: null,
        gpsLng: null,
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
        photoKey: null,
        photoUrl: null,
        gpsLat: null,
        gpsLng: null,
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
        photoKey: null,
        photoUrl: null,
        gpsLat: null,
        gpsLng: null,
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

    const timeline2 = [
      {
        id: 201,
        productId: 2,
        serialNumber: "SN-RET-2026-02",
        action: "RECEIVE",
        actorName: "Administrator",
        actorPhone: "9876543210",
        actorRole: "admin",
        details: { supplier: "Sensotech Precision", model: "FlowSense-V2", notes: "Inbound shipment from Delhi regional hub" },
        photoKey: null,
        photoUrl: null,
        gpsLat: null,
        gpsLng: null,
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
        photoKey: null,
        photoUrl: null,
        gpsLat: null,
        gpsLng: null,
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
        photoKey: null,
        photoUrl: null,
        gpsLat: null,
        gpsLng: null,
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
        gpsLat: null,
        gpsLng: null,
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
        gpsLat: null,
        gpsLng: null,
        timestamp: "2026-11-20T12:15:00.000Z",
      },
    ];

    // Combine recent activity descending by time
    const recentActivity = [...timeline1, ...timeline2].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Save to KV
    if (env.KV) {
      // 1. Staff
      await env.KV.put("users_list", JSON.stringify(officialUsers));
      for (const u of officialUsers) {
        await env.KV.put(`user:${u.phone}`, JSON.stringify(u));
      }

      // 2. Products
      await env.KV.put("products_list", JSON.stringify(products));

      // 3. Timelines
      await env.KV.put("timeline:SN-INST-2026-01", JSON.stringify(timeline1));
      await env.KV.put("timeline:SN-RET-2026-02", JSON.stringify(timeline2));

      // 4. Recent Activity
      await env.KV.put("recent_activity", JSON.stringify(recentActivity));

      // Clean old test timelines if any
      await env.KV.delete("timeline:SN-LIVE-001");
      await env.KV.delete("timeline:SN-LIVE-002");
      await env.KV.delete("timeline:SN-2026-X01");
      await env.KV.delete("timeline:SN-DUMMY-999");
    }

    // Save to D1 if available
    if (env.DB) {
      try {
        await env.DB.prepare("DELETE FROM products").run();
        await env.DB.prepare("DELETE FROM audit_trail").run();
        await env.DB.prepare("DELETE FROM users WHERE phone NOT IN ('9876543210')").run();

        // Re-insert users
        for (const u of officialUsers) {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO users (id, name, phone, pin, role, is_active) VALUES (?, ?, ?, ?, ?, 1)"
          ).bind(u.id, u.name, u.phone, u.pin, u.role).run();
        }

        // Insert products
        for (const p of products) {
          await env.DB.prepare(
            `INSERT INTO products (id, serial_number, name, model, supplier, current_status, storage_location, assigned_to_name, assigned_to_phone, customer_name, customer_phone, customer_address, gps_lat, gps_lng)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            p.id, p.serial_number, p.name, p.model, p.supplier, p.current_status,
            p.storage_location, p.assigned_to_name, p.assigned_to_phone,
            p.customer_name, p.customer_phone, p.customer_address,
            p.gps_lat, p.gps_lng
          ).run();
        }

        // Insert audit trail
        for (const a of recentActivity) {
          await env.DB.prepare(
            `INSERT INTO audit_trail (product_id, serial_number, action, actor_name, actor_phone, actor_role, details_json, photo_key, gps_lat, gps_lng, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            a.productId, a.serialNumber, a.action, a.actorName, a.actorPhone, a.actorRole,
            JSON.stringify(a.details), a.photoKey, a.gpsLat, a.gpsLng, a.timestamp
          ).run();
        }
      } catch (dbErr) {
        console.warn("D1 seed warning:", dbErr);
      }
    }

    return jsonResponse({
      success: true,
      message: "Database successfully reset and seeded with 2 authentic multi-employee lifecycles and 4 official staff logins.",
      staff: officialUsers.map((u) => ({ name: u.name, phone: u.phone, role: u.role })),
      products: products.map((p) => ({ serial: p.serial_number, name: p.name, status: p.current_status })),
    });
  } catch (err) {
    return errorResponse("Seed error: " + err.message, 500);
  }
}
