import { jsonResponse, errorResponse, DEFAULT_USERS, DEFAULT_CATEGORIES, DEFAULT_RATE_CARDS } from "./_utils.js";

export async function onRequest({ request, env }) {
  try {
    // 1. Users
    const users = [
      { id: 1, name: "Administrator", mobile: "9876543210", phone: "9876543210", pin_or_password: "1234", pin: "1234", role: "admin", is_active: 1, created_at: "2026-11-20T08:00:00Z" },
      { id: 2, name: "Production Admin", mobile: "8400600379", phone: "8400600379", pin_or_password: "Ait@600379", pin: "Ait@600379", role: "admin", is_active: 1, created_at: "2026-11-20T08:00:00Z" },
      { id: 3, name: "Rahul Sharma", mobile: "9876543211", phone: "9876543211", pin_or_password: "1234", pin: "1234", role: "in_house_staff", is_active: 1, created_at: "2026-11-20T08:10:00Z" },
      { id: 4, name: "Amit Verma", mobile: "9876543212", phone: "9876543212", pin_or_password: "1234", pin: "1234", role: "in_house_staff", is_active: 1, created_at: "2026-11-20T08:15:00Z" },
      { id: 5, name: "Vishal Kumar", mobile: "9876543213", phone: "9876543213", pin_or_password: "1234", pin: "1234", role: "third_party_tech", is_active: 1, created_at: "2026-11-20T08:20:00Z" },
      { id: 6, name: "Sonu Singh", mobile: "9876543214", phone: "9876543214", pin_or_password: "1234", pin: "1234", role: "third_party_tech", is_active: 1, created_at: "2026-11-20T08:25:00Z" },
      { id: 7, name: "Deepak Gupta", mobile: "9876543215", phone: "9876543215", pin_or_password: "1234", pin: "1234", role: "third_party_tech", is_active: 1, created_at: "2026-11-20T08:30:00Z" },
    ];

    // 2. Categories
    const categories = [
      { id: 1, name_en: "Television (TV)", name_hi: "टेलीविज़न (TV)" },
      { id: 2, name_en: "Refrigerator / Fridge", name_hi: "रेफ्रिजरेटर / फ्रिज" },
      { id: 3, name_en: "Air Conditioner (AC)", name_hi: "एयर कंडीशनर (AC)" },
      { id: 4, name_en: "Washing Machine", name_hi: "वाशिंग मशीन" },
      { id: 5, name_en: "Microwave Oven", name_hi: "माइक्रोवेव ओवन" },
      { id: 6, name_en: "Air Cooler", name_hi: "एयर कूलर" },
      { id: 7, name_en: "Spare Parts & PCB", name_hi: "स्पेयर पार्ट्स एवं पीसीबी" },
    ];

    // 3. Company Assets
    const companyAssets = [
      { id: 1, user_id: 3, asset_name: "TCR Receipt Book", asset_code: "TCR-BK-01", status: "active", assigned_date: "2026-11-15T10:00:00Z" },
      { id: 2, user_id: 3, asset_name: "Digital Multimeter Fluke", asset_code: "DMM-RHL-01", status: "active", assigned_date: "2026-11-15T10:05:00Z" },
      { id: 3, user_id: 4, asset_name: "Digital POS Bill Machine", asset_code: "DBM-POS-02", status: "active", assigned_date: "2026-11-16T11:00:00Z" },
      { id: 4, user_id: 5, asset_name: "Master Tool Bag Set", asset_code: "TB-VISH-01", status: "active", assigned_date: "2026-11-17T09:30:00Z" },
      { id: 5, user_id: 5, asset_name: "Gas Charging Manifold Gauge", asset_code: "GCM-VISH-02", status: "active", assigned_date: "2026-11-17T09:35:00Z" },
      { id: 6, user_id: 6, asset_name: "Heavy Duty Tool Kit", asset_code: "TB-SONU-03", status: "active", assigned_date: "2026-11-18T10:15:00Z" },
      { id: 7, user_id: 6, asset_name: "TCR Official Book", asset_code: "TCR-BK-SONU-04", status: "active", assigned_date: "2026-11-18T10:20:00Z" },
      { id: 8, user_id: 7, asset_name: "AC Flaring & Swaging Kit", asset_code: "FLR-DPK-05", status: "active", assigned_date: "2026-11-19T09:00:00Z" },
      { id: 9, user_id: 7, asset_name: "Digital Clamp Meter", asset_code: "CLM-DPK-06", status: "active", assigned_date: "2026-11-19T09:05:00Z" },
    ];

    // 4. Rate Cards
    const rateCards = [
      { id: 1, service_title_en: "32\" TV Standard Wall Mount Installation", service_title_hi: "32\" टीवी वाल माउंट इंस्टॉलेशन", fixed_amount: 300 },
      { id: 2, service_title_en: "43\" - 55\" Smart 4K TV Installation", service_title_hi: "43\" - 55\" स्मार्ट 4K टीवी इंस्टॉलेशन", fixed_amount: 450 },
      { id: 3, service_title_en: "Split AC General Service & Jet Wash", service_title_hi: "स्प्लिट एसी सर्विस एवं जेट वाश", fixed_amount: 600 },
      { id: 4, service_title_en: "Double Door Refrigerator Gas Charging", service_title_hi: "डबल डोर फ्रिज गैस चार्जिंग", fixed_amount: 850 },
      { id: 5, service_title_en: "Fully Automatic Washing Machine Motor Fix", service_title_hi: "फुल्ली ऑटोमैटिक वाशिंग मशीन मोटर रिपेयर", fixed_amount: 500 },
      { id: 6, service_title_en: "Microwave High-Voltage Magnetron Replacement", service_title_hi: "माइक्रोवेव मैग्नेट्रॉन रिप्लेसमेंट", fixed_amount: 400 },
    ];

    // 5. Inventory Items (22 items across categories and statuses)
    const inventory = [
      // Status: received (awaiting bucket placement)
      { id: 1, category_id: null, part_name: "Universal Smart TV Main Motherboard", model_number: "TP-MS358-PC821", serial_number: "SN-PCB-2026-901", status: "received", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-21T09:00:00Z" },
      { id: 2, category_id: null, part_name: "Inverter AC Outdoor Copper Condenser Coil", model_number: "CD-CU-15TR", serial_number: "SN-AC-2026-902", status: "received", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-21T09:15:00Z" },
      { id: 3, category_id: null, part_name: "Double Door Refrigerator Defrost Timer Relay", model_number: "RLY-TM-220V", serial_number: "SN-FR-2026-903", status: "received", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-21T09:30:00Z" },
      { id: 4, category_id: null, part_name: "Top Load Washing Machine Drain Pump Motor", model_number: "DP-WM-45W", serial_number: "SN-WM-2026-904", status: "received", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-21T09:45:00Z" },

      // Status: in_storage (categorized in buckets/racks)
      { id: 5, category_id: 1, part_name: "Samsung 43\" UHD LED Backlight Strips Set", model_number: "BN96-45952A", serial_number: "SN-TV-2026-101", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T10:00:00Z" },
      { id: 6, category_id: 1, part_name: "LG 55\" 4K Power Supply SMPS Board", model_number: "EAX68284201", serial_number: "SN-TV-2026-102", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T10:15:00Z" },
      { id: 7, category_id: 2, part_name: "Whirlpool Refrigerator Inverter Compressor", model_number: "VFL110CY1", serial_number: "SN-FR-2026-201", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T11:00:00Z" },
      { id: 8, category_id: 2, part_name: "Haier Double Door Electronic Thermostat Sensor", model_number: "TH-HR-04", serial_number: "SN-FR-2026-202", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T11:20:00Z" },
      { id: 9, category_id: 3, part_name: "Daikin 1.5 Ton AC Indoor Blower Motor", model_number: "KFD-280-35", serial_number: "SN-AC-2026-301", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T12:00:00Z" },
      { id: 10, category_id: 3, part_name: "Voltas Split AC PCB Controller Kit", model_number: "VT-PCB-INV15", serial_number: "SN-AC-2026-302", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T12:15:00Z" },
      { id: 11, category_id: 4, part_name: "IFB Front Load Suspension Struts Dampers", model_number: "SUS-IFB-100N", serial_number: "SN-WM-2026-401", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T13:00:00Z" },
      { id: 12, category_id: 5, part_name: "Galanz Microwave Oven High Voltage Magnetron", model_number: "M24FB-610A", serial_number: "SN-MW-2026-501", status: "in_storage", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T13:30:00Z" },

      // Status: assigned_to_tech (in technician custody)
      { id: 13, category_id: 1, part_name: "Universal 32\" Wall Mount Heavy Bracket Stand", model_number: "WM-STAND-32", serial_number: "SN-TV-2026-103", status: "assigned_to_tech", current_holder_id: 5, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-20T10:00:00Z" },
      { id: 14, category_id: 3, part_name: "R-32 Refrigerant Gas Canister (3KG)", model_number: "GAS-R32-03", serial_number: "SN-AC-2026-303", status: "assigned_to_tech", current_holder_id: 5, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-20T10:15:00Z" },
      { id: 15, category_id: 2, part_name: "Godrej Double Door Bi-Metal Thermostat", model_number: "BM-GD-09", serial_number: "SN-FR-2026-203", status: "assigned_to_tech", current_holder_id: 6, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-20T10:30:00Z" },
      { id: 16, category_id: 4, part_name: "Samsung Washing Machine Water Inlet Valve", model_number: "WV-SM-DC12V", serial_number: "SN-WM-2026-402", status: "assigned_to_tech", current_holder_id: 7, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-20T11:00:00Z" },

      // Status: installed (fitted at customer site)
      { id: 17, category_id: 1, part_name: "Sony 55\" Bravia Display T-Con Logic Board", model_number: "TC-SNY-55U", serial_number: "SN-TV-2026-104", status: "installed", current_holder_id: 5, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-18T11:00:00Z" },
      { id: 18, category_id: 2, part_name: "LG Double Door PTC Starter Relay & OLP", model_number: "PTC-LG-6701", serial_number: "SN-FR-2026-204", status: "installed", current_holder_id: 6, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-18T14:30:00Z" },
      { id: 19, category_id: 3, part_name: "1.5 Ton AC Copper Flare Piping Kit (4M)", model_number: "CU-KIT-15M", serial_number: "SN-AC-2026-304", status: "installed", current_holder_id: 7, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-19T16:00:00Z" },
      { id: 20, category_id: 5, part_name: "Panasonic High Voltage Capacitor 1.0uF", model_number: "CAP-HV-2100V", serial_number: "SN-MW-2026-502", status: "installed", current_holder_id: 6, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-20T12:00:00Z" },

      // Status: rejected_defective (awaiting return to company)
      { id: 21, category_id: 1, part_name: "OnePlus 50\" 4K Screen Panel Assembly (Glass Cracked)", model_number: "PNL-1P-50UHD", serial_number: "SN-REJ-2026-001", status: "rejected_defective", current_holder_id: null, invoice_image_url: null, challan_number: null, return_slip_url: null, created_at: "2026-11-20T14:00:00Z" },

      // Status: returned_to_company (dispatched with return challan)
      { id: 22, category_id: 3, part_name: "Hitachi AC Inverter Compressor (Internal Coil Burnt)", model_number: "CMP-HT-15INV", serial_number: "SN-RET-2026-002", status: "returned_to_company", current_holder_id: null, invoice_image_url: null, challan_number: "CHAL-2026-881", return_slip_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=300", created_at: "2026-11-17T09:00:00Z" },
    ];

    // 6. Service Calls (16 calls with realistic Indian workflow, extra collections, admin edits, payout statuses)
    const serviceCalls = [
      // Call 1: Completed, Paid (Vishal)
      {
        id: 1,
        complaint_number: "CMP-2026-1001",
        customer_name: "Arvind Shukla",
        customer_mobile: "9876543210",
        customer_address: "56, Rajajipuram, Lucknow, UP",
        rate_card_id: 1, // 32" TV Install (₹300)
        assigned_tech_id: 5, // Vishal
        used_part_id: 13,
        tech_payout_amount: 300,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 500,
        customer_extra_remark: "TV Wall Mount Bracket Stand",
        status: "completed",
        payout_status: "paid",
        payment_batch_id: 1,
        completed_at: "2026-11-19T14:00:00Z",
        created_at: "2026-11-19T09:30:00Z",
      },
      // Call 2: Completed, Paid with Admin Extra Conveyance Edit (Vishal)
      {
        id: 2,
        complaint_number: "CMP-2026-1002",
        customer_name: "Sunil Mehrotra",
        customer_mobile: "9415012345",
        customer_address: "Plot 12, Gomti Nagar Extension, Lucknow",
        rate_card_id: 2, // 43-55" TV Install (₹450)
        assigned_tech_id: 5, // Vishal
        used_part_id: null,
        tech_payout_amount: 450,
        admin_edited_amount: 600,
        admin_edit_remark: "Extra Conveyance +₹150 (Long distance 22KM travel)",
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "completed",
        payout_status: "paid",
        payment_batch_id: 1,
        completed_at: "2026-11-19T17:30:00Z",
        created_at: "2026-11-19T11:00:00Z",
      },
      // Call 3: Completed, Paid (Vishal)
      {
        id: 3,
        complaint_number: "CMP-2026-1003",
        customer_name: "Pooja Saxena",
        customer_mobile: "9839098765",
        customer_address: "Flat 402, Eldeco Greens, Gomti Nagar",
        rate_card_id: 4, // Fridge Gas Charging (₹850)
        assigned_tech_id: 5, // Vishal
        used_part_id: null,
        tech_payout_amount: 850,
        admin_edited_amount: 750,
        admin_edit_remark: "Late Penalty -₹100 (Customer reported 2 hour delay)",
        customer_extra_collected: 250,
        customer_extra_remark: "Compressor Copper Relay Socket",
        status: "completed",
        payout_status: "paid",
        payment_batch_id: 1,
        completed_at: "2026-11-20T11:00:00Z",
        created_at: "2026-11-20T08:30:00Z",
      },

      // Call 4: Completed, Unpaid (Vishal) - ready for admin to pay!
      {
        id: 4,
        complaint_number: "CMP-2026-1004",
        customer_name: "Rameshwar Prasad",
        customer_mobile: "9450123890",
        customer_address: "House 28, Indira Nagar Sector 14, Lucknow",
        rate_card_id: 2, // 43-55" TV Install (₹450)
        assigned_tech_id: 5, // Vishal
        used_part_id: null,
        tech_payout_amount: 450,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 600,
        customer_extra_remark: "Heavy Heavy-Gauge Tilting TV Stand",
        status: "completed",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: "2026-11-21T10:30:00Z",
        created_at: "2026-11-21T08:00:00Z",
      },
      // Call 5: Completed, Unpaid (Vishal)
      {
        id: 5,
        complaint_number: "CMP-2026-1005",
        customer_name: "Dr. Alok Srivastava",
        customer_mobile: "9918273645",
        customer_address: "Aliganj Sector B, Near Post Office",
        rate_card_id: 3, // AC Jet Wash (₹600)
        assigned_tech_id: 5, // Vishal
        used_part_id: null,
        tech_payout_amount: 600,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "completed",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: "2026-11-21T13:00:00Z",
        created_at: "2026-11-21T09:00:00Z",
      },
      // Call 6: Pending (Vishal)
      {
        id: 6,
        complaint_number: "CMP-2026-1006",
        customer_name: "Meenakshi Mishra",
        customer_mobile: "9838112233",
        customer_address: "B-24, Mahanagar Extension, Lucknow",
        rate_card_id: 1, // 32" TV Install (₹300)
        assigned_tech_id: 5, // Vishal
        used_part_id: null,
        tech_payout_amount: 300,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "pending",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: null,
        created_at: "2026-11-21T11:30:00Z",
      },

      // Call 7: Completed, Paid (Sonu Singh)
      {
        id: 7,
        complaint_number: "CMP-2026-1007",
        customer_name: "Virendra Yadav",
        customer_mobile: "9792001122",
        customer_address: "Kalyanpur, Ring Road, Lucknow",
        rate_card_id: 4, // Fridge Gas (₹850)
        assigned_tech_id: 6, // Sonu
        used_part_id: 18,
        tech_payout_amount: 850,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 300,
        customer_extra_remark: "Anti-Moisture Filter Dryer",
        status: "completed",
        payout_status: "paid",
        payment_batch_id: 2,
        completed_at: "2026-11-20T12:00:00Z",
        created_at: "2026-11-20T08:00:00Z",
      },
      // Call 8: Completed, Paid (Sonu Singh)
      {
        id: 8,
        complaint_number: "CMP-2026-1008",
        customer_name: "Anjali Gupta",
        customer_mobile: "9415556677",
        customer_address: "Ashiyana Colony, Sector K, Lucknow",
        rate_card_id: 5, // Washing Machine Motor (₹500)
        assigned_tech_id: 6, // Sonu
        used_part_id: null,
        tech_payout_amount: 500,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "completed",
        payout_status: "paid",
        payment_batch_id: 2,
        completed_at: "2026-11-20T15:30:00Z",
        created_at: "2026-11-20T10:00:00Z",
      },
      // Call 9: Completed, Unpaid (Sonu Singh)
      {
        id: 9,
        complaint_number: "CMP-2026-1009",
        customer_name: "Harish Chandra",
        customer_mobile: "9839445566",
        customer_address: "Jankipuram Garden City, Lucknow",
        rate_card_id: 6, // Microwave Magnetron (₹400)
        assigned_tech_id: 6, // Sonu
        used_part_id: 20,
        tech_payout_amount: 400,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 150,
        customer_extra_remark: "High Voltage Fuse",
        status: "completed",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: "2026-11-21T11:00:00Z",
        created_at: "2026-11-21T08:30:00Z",
      },
      // Call 10: Pending (Sonu Singh)
      {
        id: 10,
        complaint_number: "CMP-2026-1010",
        customer_name: "Geeta Rani",
        customer_mobile: "9451223344",
        customer_address: "Vikas Nagar, Sector 4, Lucknow",
        rate_card_id: 4, // Fridge Gas (₹850)
        assigned_tech_id: 6, // Sonu
        used_part_id: null,
        tech_payout_amount: 850,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "pending",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: null,
        created_at: "2026-11-21T12:00:00Z",
      },

      // Call 11: Completed, Unpaid (Deepak Gupta)
      {
        id: 11,
        complaint_number: "CMP-2026-1011",
        customer_name: "Manish Tiwari",
        customer_mobile: "9838009988",
        customer_address: "Chowk, Near Medical College, Lucknow",
        rate_card_id: 3, // AC Jet Wash (₹600)
        assigned_tech_id: 7, // Deepak
        used_part_id: null,
        tech_payout_amount: 600,
        admin_edited_amount: 700,
        admin_edit_remark: "Extra Conveyance +₹100 (Congested old city parking)",
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "completed",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: "2026-11-20T16:00:00Z",
        created_at: "2026-11-20T12:00:00Z",
      },
      // Call 12: Completed, Unpaid (Deepak Gupta)
      {
        id: 12,
        complaint_number: "CMP-2026-1012",
        customer_name: "Sanjay Kumar",
        customer_mobile: "9415778899",
        customer_address: "Telibagh, Raebareli Road, Lucknow",
        rate_card_id: 5, // Washing Machine (₹500)
        assigned_tech_id: 7, // Deepak
        used_part_id: null,
        tech_payout_amount: 500,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 200,
        customer_extra_remark: "Vibration Rubber Pads Set",
        status: "completed",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: "2026-11-21T12:30:00Z",
        created_at: "2026-11-21T09:00:00Z",
      },
      // Call 13: Pending (Deepak Gupta)
      {
        id: 13,
        complaint_number: "CMP-2026-1013",
        customer_name: "Kavita Rastogi",
        customer_mobile: "9935123456",
        customer_address: "Hazratganj, Park Road, Lucknow",
        rate_card_id: 2, // 43-55" TV (₹450)
        assigned_tech_id: 7, // Deepak
        used_part_id: null,
        tech_payout_amount: 450,
        admin_edited_amount: null,
        admin_edit_remark: null,
        customer_extra_collected: 0,
        customer_extra_remark: null,
        status: "pending",
        payout_status: "unpaid",
        payment_batch_id: null,
        completed_at: null,
        created_at: "2026-11-21T13:00:00Z",
      },
    ];

    // 7. Payment Batches (Settlement History)
    const paymentBatches = [
      {
        id: 1,
        tech_id: 5, // Vishal
        amount_paid: 1650, // 300 + 600 + 750
        payment_screenshot_url: "https://images.unsplash.com/photo-1556742049-0a67e55722ee?w=300",
        remarks: "Settlement for 3 calls (CMP-1001, 1002, 1003) via Google Pay UPI Ref #320918273619",
        paid_at: "2026-11-20T18:00:00Z",
      },
      {
        id: 2,
        tech_id: 6, // Sonu
        amount_paid: 1350, // 850 + 500
        payment_screenshot_url: "https://images.unsplash.com/photo-1556742049-0a67e55722ee?w=300",
        remarks: "Settlement for 2 calls (CMP-1007, 1008) via PhonePe UPI Ref #491827364120",
        paid_at: "2026-11-20T18:15:00Z",
      },
    ];

    // 8. Audit Logs (English & Hindi)
    const auditLogs = [
      {
        id: 101,
        entity_type: "payment",
        entity_id: 1,
        action_by_user_id: 1,
        assigned_to_user_id: 5,
        action_description_en: "Admin processed UPI batch payout of ₹1,650 to Vishal Kumar for 3 closed calls.",
        action_description_hi: "एडमिन ने विशाल कुमार को 3 क्लोज्ड कॉल्स के लिए ₹1,650 का UPI बैच भुगतान किया।",
        is_read: 1,
        created_at: "2026-11-20T18:00:00Z",
      },
      {
        id: 102,
        entity_type: "call",
        entity_id: 3,
        action_by_user_id: 1,
        assigned_to_user_id: 5,
        action_description_en: "Admin edited payout from ₹850 to ₹750 (Remark: Late Penalty -₹100).",
        action_description_hi: "एडमिन ने भुगतान राशि ₹850 से बदलकर ₹750 की (रिमार्क: लेट पेनल्टी -₹100)।",
        is_read: 1,
        created_at: "2026-11-20T17:45:00Z",
      },
      {
        id: 103,
        entity_type: "call",
        entity_id: 2,
        action_by_user_id: 1,
        assigned_to_user_id: 5,
        action_description_en: "Admin edited payout from ₹450 to ₹600 (Remark: Extra Conveyance +₹150).",
        action_description_hi: "एडमिन ने भुगतान राशि ₹450 से बढ़ाकर ₹600 की (रिमार्क: एक्स्ट्रा कन्वेंस +₹150)।",
        is_read: 1,
        created_at: "2026-11-19T18:00:00Z",
      },
      {
        id: 104,
        entity_type: "call",
        entity_id: 1,
        action_by_user_id: 5,
        assigned_to_user_id: 5,
        action_description_en: "Vishal Kumar completed Call CMP-2026-1001. Collected extra ₹500 for 'TV Wall Mount Bracket Stand'.",
        action_description_hi: "विशाल कुमार ने कॉल CMP-2026-1001 क्लोज की। 'TV स्टैंड' के लिए एक्स्ट्रा ₹500 प्राप्त किए।",
        is_read: 1,
        created_at: "2026-11-19T14:00:00Z",
      },
      {
        id: 105,
        entity_type: "part",
        entity_id: 13,
        action_by_user_id: 3,
        assigned_to_user_id: 5,
        action_description_en: "Rahul Sharma handed over Part SN-TV-2026-103 to Technician Vishal Kumar.",
        action_description_hi: "राहुल शर्मा ने पार्ट SN-TV-2026-103 टेक्नीशियन विशाल कुमार को हैंडओवर किया।",
        is_read: 1,
        created_at: "2026-11-20T10:00:00Z",
      },
      {
        id: 106,
        entity_type: "part",
        entity_id: 22,
        action_by_user_id: 1,
        assigned_to_user_id: null,
        action_description_en: "Admin created return challan CHAL-2026-881 for defective compressor SN-RET-2026-002.",
        action_description_hi: "एडमिन ने खराब कंप्रेसर SN-RET-2026-002 के लिए रिटर्न चालान CHAL-2026-881 बनाया।",
        is_read: 1,
        created_at: "2026-11-17T09:00:00Z",
      },
      {
        id: 107,
        entity_type: "asset",
        entity_id: 4,
        action_by_user_id: 1,
        assigned_to_user_id: 5,
        action_description_en: "Admin assigned Master Tool Bag Set (TB-VISH-01) to Vishal Kumar.",
        action_description_hi: "एडमिन ने मास्टर टूल बैग (TB-VISH-01) विशाल कुमार को असाइन किया।",
        is_read: 1,
        created_at: "2026-11-17T09:30:00Z",
      },
    ];

    // SAVE INTO KV
    if (env.KV) {
      await env.KV.put("users_list", JSON.stringify(users));
      for (const u of users) {
        await env.KV.put(`user:${u.mobile}`, JSON.stringify(u));
        await env.KV.put(`user:${u.phone}`, JSON.stringify(u));
      }
      await env.KV.put("categories_list", JSON.stringify(categories));
      await env.KV.put("company_assets_list", JSON.stringify(companyAssets));
      await env.KV.put("rate_cards_list", JSON.stringify(rateCards));
      await env.KV.put("inventory_list", JSON.stringify(inventory));
      for (const item of inventory) {
        await env.KV.put(`item:${item.serial_number.toUpperCase()}`, JSON.stringify(item));
      }
      await env.KV.put("service_calls_list", JSON.stringify(serviceCalls));
      for (const call of serviceCalls) {
        await env.KV.put(`call:${call.complaint_number.toUpperCase()}`, JSON.stringify(call));
      }
      await env.KV.put("payment_batches_list", JSON.stringify(paymentBatches));
      await env.KV.put("audit_logs_list", JSON.stringify(auditLogs));
    }

    // SAVE INTO D1 (if available)
    if (env.DB) {
      try {
        await env.DB.prepare("DELETE FROM users").run();
        for (const u of users) {
          await env.DB.prepare(
            "INSERT INTO users (id, name, mobile, pin_or_password, role, is_active) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(u.id, u.name, u.mobile, u.pin_or_password, u.role, u.is_active).run();
        }

        await env.DB.prepare("DELETE FROM categories").run();
        for (const c of categories) {
          await env.DB.prepare(
            "INSERT INTO categories (id, name_en, name_hi) VALUES (?, ?, ?)"
          ).bind(c.id, c.name_en, c.name_hi).run();
        }

        await env.DB.prepare("DELETE FROM company_assets").run();
        for (const a of companyAssets) {
          await env.DB.prepare(
            "INSERT INTO company_assets (id, user_id, asset_name, asset_code, status) VALUES (?, ?, ?, ?, ?)"
          ).bind(a.id, a.user_id, a.asset_name, a.asset_code, a.status).run();
        }

        await env.DB.prepare("DELETE FROM rate_cards").run();
        for (const r of rateCards) {
          await env.DB.prepare(
            "INSERT INTO rate_cards (id, service_title_en, service_title_hi, fixed_amount) VALUES (?, ?, ?, ?)"
          ).bind(r.id, r.service_title_en, r.service_title_hi, r.fixed_amount).run();
        }

        await env.DB.prepare("DELETE FROM inventory_items").run();
        for (const i of inventory) {
          await env.DB.prepare(`
            INSERT INTO inventory_items (id, category_id, part_name, model_number, serial_number, status, current_holder_id, invoice_image_url, challan_number, return_slip_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(i.id, i.category_id, i.part_name, i.model_number, i.serial_number, i.status, i.current_holder_id, i.invoice_image_url, i.challan_number, i.return_slip_url).run();
        }

        await env.DB.prepare("DELETE FROM service_calls").run();
        for (const sc of serviceCalls) {
          await env.DB.prepare(`
            INSERT INTO service_calls (id, complaint_number, customer_name, customer_mobile, customer_address, rate_card_id, assigned_tech_id, used_part_id, tech_payout_amount, admin_edited_amount, admin_edit_remark, customer_extra_collected, customer_extra_remark, status, payout_status, payment_batch_id, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(sc.id, sc.complaint_number, sc.customer_name, sc.customer_mobile, sc.customer_address, sc.rate_card_id, sc.assigned_tech_id, sc.used_part_id, sc.tech_payout_amount, sc.admin_edited_amount, sc.admin_edit_remark, sc.customer_extra_collected, sc.customer_extra_remark, sc.status, sc.payout_status, sc.payment_batch_id, sc.completed_at).run();
        }

        await env.DB.prepare("DELETE FROM payment_batches").run();
        for (const pb of paymentBatches) {
          await env.DB.prepare(
            "INSERT INTO payment_batches (id, tech_id, amount_paid, payment_screenshot_url, remarks, paid_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(pb.id, pb.tech_id, pb.amount_paid, pb.payment_screenshot_url, pb.remarks, pb.paid_at).run();
        }

        await env.DB.prepare("DELETE FROM audit_logs").run();
        for (const al of auditLogs) {
          await env.DB.prepare(
            "INSERT INTO audit_logs (id, entity_type, entity_id, action_by_user_id, assigned_to_user_id, action_description_en, action_description_hi, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(al.id, al.entity_type, al.entity_id, al.action_by_user_id, al.assigned_to_user_id, al.action_description_en, al.action_description_hi, al.is_read).run();
        }
      } catch (dbErr) {
        console.warn("D1 seed warning:", dbErr);
      }
    }

    return jsonResponse({
      success: true,
      message: "Database successfully upgraded and seeded with Indian Service Center Workflow dataset.",
      summary: {
        usersCount: users.length,
        categoriesCount: categories.length,
        assetsCount: companyAssets.length,
        rateCardsCount: rateCards.length,
        inventoryCount: inventory.length,
        callsCount: serviceCalls.length,
        paymentBatchesCount: paymentBatches.length,
        auditLogsCount: auditLogs.length,
      },
    });
  } catch (err) {
    return errorResponse("Seed error: " + err.message, 500);
  }
}
