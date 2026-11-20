# Production Admin Credentials (Reserved for Live Launch)

> **Status:** PENDING APPROVAL (DO NOT APPLY YET)  
> **Instruction from User:** "अभी ये करना नहीं है.. जब मैं कहूं तब कीजिएगा लेकिन इसे कहीं सुरक्षित रख लीजिए.. हम अप्रूवल मिलने के बाद इसे लागू करेंगे.. जब डेमो मोड से लाइव जाएंगे तब हम यही यूजरनेम पासवर्ड एडमिन का रखेंगे.."

---

### Reserved Production Super Admin Account:
- **Role:** Super Administrator
- **Mobile Number / Login ID:** `8400600379`
- **Password / Secret:** `Ait@600379`

---

### Notes for Production Rollout:
1. When instructed to go live:
   - Update `schema.sql` seed to insert this admin account.
   - Update `functions/api/_utils.js` fallback and D1/KV users table.
   - In `public/index.html`, ensure the login password input allows alphanumeric and special characters (remove any strict 4-digit numeric constraints).
   - Remove demo test account quick-fill badges from login screen for the production release.
