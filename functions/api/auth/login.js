import { jsonResponse, errorResponse, createAuthToken, findUser } from "../_utils.js";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { phone, pin, password, turnstileToken } = body;
    const submittedSecret = pin || password;

    if (!phone || !submittedSecret) {
      return errorResponse("कृपया फ़ोन नंबर और पासवर्ड दोनों दर्ज करें। (Please enter both phone number and password)", 400);
    }

    const cleanPhone = String(phone).trim();
    const cleanSecret = String(submittedSecret).trim();

    // 1. Cloudflare Turnstile Invisible Bot Challenge Verification (if configured in env)
    if (env.TURNSTILE_SECRET_KEY && turnstileToken) {
      try {
        const clientIp = request.headers.get("CF-Connecting-IP");
        const turnstileFormData = new FormData();
        turnstileFormData.append("secret", env.TURNSTILE_SECRET_KEY);
        turnstileFormData.append("response", turnstileToken);
        if (clientIp) turnstileFormData.append("remoteip", clientIp);

        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          body: turnstileFormData,
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return errorResponse("बॉट या अनधिकृत अनुरोध अस्वीकार किया गया। (Turnstile Bot verification failed)", 403);
        }
      } catch (tErr) {
        console.warn("Turnstile validation check skipped:", tErr);
      }
    }

    // 2. Brute-Force & Rate-Limiting Protection (5-Attempts Lockout)
    let attemptData = { count: 0, lastFailed: 0 };
    if (env.KV) {
      attemptData = (await env.KV.get(`login_attempts:${cleanPhone}`, "json")) || { count: 0, lastFailed: 0 };
    }

    // Check if account is currently locked
    if (attemptData.count >= LOCKOUT_THRESHOLD) {
      const elapsed = Date.now() - (attemptData.lastFailed || 0);
      if (elapsed < LOCKOUT_DURATION_MS) {
        const remainingMins = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
        return jsonResponse(
          {
            success: false,
            error: `सुरक्षा कारणों से यह खाता लॉक है। कृपया ${remainingMins} मिनट बाद पुनः प्रयास करें। (Account locked due to 5 failed attempts. Retry in ${remainingMins}m)`,
            locked: true,
            remainingMinutes: remainingMins,
          },
          429
        );
      } else {
        // Lockout period has passed; reset attempts
        attemptData = { count: 0, lastFailed: 0 };
      }
    }

    // 3. User Lookup & Authentication
    const user = await findUser(env, cleanPhone, cleanSecret);

    if (!user) {
      // Record failed attempt
      attemptData.count = (attemptData.count || 0) + 1;
      attemptData.lastFailed = Date.now();
      if (env.KV) {
        await env.KV.put(`login_attempts:${cleanPhone}`, JSON.stringify(attemptData), {
          expirationTtl: 1800, // 30 minutes TTL
        });
      }

      const remainingAttempts = Math.max(0, LOCKOUT_THRESHOLD - attemptData.count);
      if (remainingAttempts === 0) {
        return jsonResponse(
          {
            success: false,
            error: "गलत पासवर्ड! लगातार 5 गलत प्रयासों के बाद सुरक्षा हेतु यह खाता 15 मिनट के लिए लॉक कर दिया गया है। (Account locked for 15 minutes)",
            locked: true,
            remainingAttempts: 0,
          },
          429
        );
      } else {
        return jsonResponse(
          {
            success: false,
            error: `गलत फ़ोन नंबर या पासवर्ड! आपके पास केवल ${remainingAttempts} प्रयास शेष हैं। (Invalid credentials. ${remainingAttempts} attempts remaining)`,
            remainingAttempts,
          },
          401
        );
      }
    }

    // 4. Successful Authentication: Reset failed attempts counter
    if (env.KV && attemptData.count > 0) {
      await env.KV.delete(`login_attempts:${cleanPhone}`);
    }

    const token = await createAuthToken(user);

    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    return errorResponse("Login failed: " + err.message, 500);
  }
}
