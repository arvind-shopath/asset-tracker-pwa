import { jsonResponse, errorResponse, verifyAuth } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const contentType = request.headers.get("content-type") || "";
    let fileBuffer;
    let mimeType = "image/jpeg";
    let extension = "jpg";
    let rawBase64 = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("photo");
      if (!file) return errorResponse("कोई फोटो नहीं भेजी गई।", 400);

      mimeType = file.type || "image/jpeg";
      extension = mimeType.includes("webp") ? "webp" : "jpg";
      fileBuffer = await file.arrayBuffer();
      // Also get base64 for fallback
      const bytes = new Uint8Array(fileBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      rawBase64 = btoa(binary);
    } else {
      // Direct binary or base64 JSON
      const body = await request.json();
      if (!body.image) return errorResponse("कोई फोटो डेटा नहीं भेजा गया।", 400);

      rawBase64 = body.image.replace(/^data:image\/\w+;base64,/, "");
      mimeType = body.mimeType || "image/jpeg";
      extension = mimeType.includes("webp") ? "webp" : "jpg";

      const binaryStr = atob(rawBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    }

    const uniqueId = crypto.randomUUID();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const objectKey = `photos/${datePrefix}/${uniqueId}.${extension}`;

    // If R2 Bucket is bound and active
    if (env.BUCKET) {
      try {
        await env.BUCKET.put(objectKey, fileBuffer, {
          httpMetadata: {
            contentType: mimeType,
            cacheControl: "public, max-age=31536000",
          },
          customMetadata: {
            uploadedBy: user.phone,
            uploaderName: user.name,
            uploadedAt: new Date().toISOString(),
          },
        });
      } catch (r2Err) {
        console.warn("R2 upload fallback to D1:", r2Err);
      }
    }

    // Always ensure D1 has fallback storage table ready
    try {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, mime_type TEXT NOT NULL, data TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      await env.DB.prepare(
        "INSERT INTO photos (id, mime_type, data) VALUES (?, ?, ?)"
      ).bind(objectKey, mimeType, rawBase64).run();
    } catch (dbErr) {
      console.warn("D1 photo save notice:", dbErr);
    }

    return jsonResponse({
      success: true,
      key: objectKey,
      url: `/api/photo/${objectKey}`,
    });
  } catch (err) {
    return errorResponse("फोटो अपलोड विफल: " + err.message, 500);
  }
}
