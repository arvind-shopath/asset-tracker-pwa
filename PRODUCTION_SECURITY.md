# Enterprise Security Specification & Hardening Guide

> **Project:** Asset & Installation Tracking PWA (AIT Tracker)  
> **Target:** `https://asset-tracker-pwa.pages.dev`  
> **Status:** LIVE & ACTIVE (Implemented on Cloudflare Pages + KV + Edge Functions)

---

## 1. Strong Password Policy (कठोर पासवर्ड नीति)
साधारण 4-अंकीय पिन के स्थान पर पासवर्ड नीति अनिवार्य है ताकि ब्रूट-फ़ोर्स या डिक्शनरी अटैक से किसी भी खाते को क्रैक न किया जा सके।

### अनिवार्य मापदंड (Enforced Validation Rules):
- **न्यूनतम लंबाई (Min Length):** कम से कम 8 कैरेक्टर्स
- **कैपिटल अक्षर (Uppercase):** कम से कम 1 अक्षर (`A-Z`)
- **स्मॉल अक्षर (Lowercase):** कम से कम 1 अक्षर (`a-z`)
- **नंबर (Digit):** कम से कम 1 संख्या (`0-9`)
- **स्पेशल कैरेक्टर (Special Symbol):** कम से कम 1 सिंबल (`@, #, $, %, !, &, *, ^, -, _` आदि)
- **Regex Pattern:** `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$`

---

## 2. Brute-Force & Rate Limiting Protection (5-अटेम्पट लॉकआउट)
- **लगातार 5 गलत पासवर्ड पर लॉक:** यदि किसी फ़ोन नंबर पर 5 बार लगातार गलत पासवर्ड डाला जाता है, तो खाता स्वचालित रूप से **15 मिनट** के लिए लॉक हो जाता है।
- **अटेम्पट काउंटडाउन:** प्रत्येक गलत प्रयास पर यूज़र को शेष प्रयासों की सूचना दी जाती है (`4 प्रयास शेष`, `3 प्रयास शेष`...)।
- **सफल लॉगिन पर रीसेट:** सही क्रेडेंशियल दर्ज होते ही फेल्ड अटेम्प्ट्स काउंटर शून्य हो जाता है।
- **KV स्टोरेज:** फेल्ड अटेम्प्ट्स का डेटा Cloudflare KV में `login_attempts:<phone>` के साथ 30 मिनट TTL पर सुरक्षित रहता है।

---

## 3. Keep Me Logged In (मुझे लॉगइन रखें / Remember Me)
- **चेक होने पर (Default: Checked):** 
  - यूज़र का ऑथेंटिकेशन टोकन ब्राउज़र के `localStorage` में सुरक्षित रहता है।
  - 30 दिनों तक लगातार लॉगिन बना रहता है, ब्राउज़र या टैब बंद करने पर भी दोबारा पासवर्ड नहीं माँगता।
- **अनचेक होने पर (Shared / Borrowed Devices):**
  - ऑथेंटिकेशन टोकन केवल `sessionStorage` में रहता है।
  - जैसे ही कर्मचारी या यूज़र ब्राउज़र की टैब या विंडो बंद करता है, सत्र तुरंत समाप्त हो जाता है। शेयर किए गए कंप्यूटर या साइबर कैफ़े में सुरक्षा सुनिश्चित होती है।
- **लॉगआउट बटन:** दोनों स्टोरेज (`localStorage` और `sessionStorage`) को तुरंत शून्य कर देता है।

---

## 4. Cloudflare Turnstile - Invisible Bot Protection (अदृश्य कैप्चा)
- ऑटोमेटेड बॉट्स, क्रॉलर्स और स्क्रैपर्स को रोकने के लिए Cloudflare Turnstile का उपयोग।
- **Invisible Mode:** बिना किसी विज़ुअल पज़ल या यूज़र रुकावट के बैकग्राउंड में मानव व्यवहार का सत्यापन।
- **सर्वर-साइड वेरिफिकेशन:** लॉगिन एपीआई (`/api/auth/login`) क्लाउडफ्लेयर के `https://challenges.cloudflare.com/turnstile/v0/siteverify` से एंड-टू-एंड सत्यापित करती है।

---

## 5. Reserved Production Super Admin Credentials
- **Role:** Super Administrator
- **Mobile Number:** `8400600379`
- **Password:** `Ait@600379` *(Meets all 5 enterprise security criteria: Uppercase 'A', lowercase 'it', symbol '@', numbers '600379', length 10)*
