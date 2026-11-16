import { jsonResponse, errorResponse, verifyAuth } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("लॉगिन आवश्यक है।", 401);

  try {
    const contentType = request.headers.get("content-type") || "";
    let fileBuffer;
    let mimeType = "image/jpeg";
    let extension = "jpg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("photo");
      if (!file) return errorResponse("कोई फोटो नहीं भेजी गई।", 400);

      mimeType = file.type || "image/jpeg";
      extension = mimeType.includes("webp") ? "webp" : "jpg";
      fileBuffer = await file.arrayBuffer();
    } else {
      // Direct binary or base64
      const body = await request.json();
      if (!body.image) return errorResponse("कोई फोटो डेटा नहीं भेजा गया।", 400);

      const base64Data = body.image.replace(/^data:image\/\w+;base64,/, "");
      mimeType = body.mimeType || "image/jpeg";
      extension = mimeType.includes("webp") ? "webp" : "jpg";

      const binaryStr = atob(base64Data);
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

    // Put into Cloudflare R2 Bucket
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

    return jsonResponse({
      success: true,
      key: objectKey,
      url: `/api/photo/${objectKey}`,
    });
  } catch (err) {
    return errorResponse("फोटो अपलोड विफल: " + err.message, 500);
  }
}
