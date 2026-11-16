export async function onRequestGet({ params, env }) {
  try {
    const rawPath = params.path;
    const objectKey = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;

    if (!objectKey) {
      return new Response("Missing photo key", { status: 400 });
    }

    // 1. Try R2 if available
    if (env.BUCKET) {
      try {
        const object = await env.BUCKET.get(objectKey);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);
          headers.set("Cache-Control", "public, max-age=604800, immutable");
          headers.set("Access-Control-Allow-Origin", "*");
          return new Response(object.body, { headers });
        }
      } catch (e) {
        console.warn("R2 fetch error, checking D1:", e);
      }
    }

    // 2. Try D1 fallback
    if (env.DB) {
      try {
        const row = await env.DB.prepare(
          "SELECT data, mime_type, created_at FROM photos WHERE id = ?"
        ).bind(objectKey).first();

        if (row && row.data) {
          // Check 60 days expiry (60 * 24 * 60 * 60 * 1000)
          const createdTime = new Date(row.created_at).getTime();
          const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
          if (Date.now() - createdTime > sixtyDaysMs) {
            // Delete expired photo data from DB to save storage
            await env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(objectKey).run();
            return new Response(
              JSON.stringify({
                expired: true,
                message: "60 दिन बाद फोटो आर्काइव/डिलीट की गई (रिकॉर्ड सुरक्षित है)",
              }),
              {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "X-Photo-Expired": "true",
                  "Access-Control-Allow-Origin": "*",
                },
              }
            );
          }

          const binaryStr = atob(row.data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          return new Response(bytes.buffer, {
            headers: {
              "Content-Type": row.mime_type || "image/webp",
              "Cache-Control": "public, max-age=604800, immutable",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      } catch (dbErr) {
        console.warn("D1 photo query error:", dbErr);
      }
    }

    // If not found in either R2 or D1 (Deleted after 60 days)
    return new Response(
      JSON.stringify({
        expired: true,
        message: "60 दिन बाद फोटो आर्काइव/डिलीट की गई (रिकॉर्ड सुरक्षित है)",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "X-Photo-Expired": "true",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response("Error loading image: " + err.message, { status: 500 });
  }
}
