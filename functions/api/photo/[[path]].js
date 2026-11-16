export async function onRequestGet({ params, env }) {
  try {
    const rawPath = params.path;
    const objectKey = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;

    if (!objectKey) {
      return new Response("Missing photo key", { status: 400 });
    }

    const object = await env.BUCKET.get(objectKey);

    if (!object) {
      // Photo is missing or deleted after 60-day R2 Lifecycle
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
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=604800, immutable");
    headers.set("Access-Control-Allow-Origin": "*",

    return new Response(object.body, {
      headers,
    });
  } catch (err) {
    return new Response("Error loading image: " + err.message, { status: 500 });
  }
}
