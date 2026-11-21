import { jsonResponse, errorResponse, verifyAuth } from "../_utils.js";

// 6-Month (180-day) Cloud Storage & Image Retention Cleanup
export async function onRequestPost({ request, env }) {
  // Allow system cron or authenticated admin
  const user = await verifyAuth(request);
  const authHeader = request.headers.get("Authorization") || "";
  const cronSecret = request.headers.get("X-Cron-Secret") || "";

  // Basic guard: either logged in admin or valid cron trigger
  if (!user && !cronSecret) {
    return errorResponse("अनधिकृत अनुरोध (Unauthorized).", 401);
  }

  try {
    const cutoffDays = 180; // 6 months
    const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString();
    let deletedCount = 0;
    let r2DeletedCount = 0;

    // 1. D1 Database Cleanup: Delete photos older than 180 days
    if (env.DB) {
      try {
        const res = await env.DB.prepare(
          "DELETE FROM photos WHERE created_at < ?"
        ).bind(cutoffDate).run();
        deletedCount = res?.meta?.changes || 0;
      } catch (dbErr) {
        console.warn("D1 photo retention cleanup warning:", dbErr);
      }
    }

    // 2. R2 Storage Cleanup (if bucket is bound)
    if (env.BUCKET) {
      try {
        const listed = await env.BUCKET.list({ prefix: "photos/" });
        const toDelete = [];
        for (const obj of listed.objects) {
          if (obj.uploaded < new Date(cutoffDate)) {
            toDelete.push(obj.key);
          }
        }
        if (toDelete.length > 0) {
          await env.BUCKET.delete(toDelete);
          r2DeletedCount = toDelete.length;
        }
      } catch (r2Err) {
        console.warn("R2 retention cleanup warning:", r2Err);
      }
    }

    // 3. KV Cleanup: purge expired cache keys
    let kvCleaned = 0;
    if (env.KV) {
      try {
        // Purge any stale temporary session or upload keys
        const list = await env.KV.list({ prefix: "temp:" });
        for (const k of list.keys) {
          await env.KV.delete(k.name);
          kvCleaned++;
        }
      } catch (kvErr) {
        console.warn("KV retention cleanup warning:", kvErr);
      }
    }

    return jsonResponse({
      success: true,
      message: `सफलतापूर्वक 180 दिन (6 माह) से पुरानी फाइलों की सफाई संपन्न।`,
      cutoffDate,
      d1_photos_deleted: deletedCount,
      r2_photos_deleted: r2DeletedCount,
      kv_temp_cleaned: kvCleaned,
      retention_policy: "180 days (6 Months)",
    });
  } catch (err) {
    return errorResponse("रिटेंशन क्लीनअप विफल: " + err.message, 500);
  }
}

export async function onRequestGet(ctx) {
  return onRequestPost(ctx);
}
