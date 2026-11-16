# 📦 Asset & Installation Tracking Web App (PWA)
### 100% Cloudflare Free Tier (Pages + Functions + D1 + R2) & GitHub Deployment Guide

यह एप्लिकेशन छोटे और मध्यम व्यवसायों के लिए डिज़ाइन किया गया एक अत्याधुनिक, Apple-शैली (SF Pro / Pastel Aesthetic) का **Asset & Installation Tracking PWA** है। यह पूरी तरह से Cloudflare के ₹0 Free Tier पर चलता है।

---

## 🏗️ प्रोजेक्ट फोल्डर स्ट्रक्चर (Folder Architecture)

```text
asset-tracker-pwa/
├── public/
│   ├── index.html        # Apple-Style PWA Frontend (Vanilla JS + Tailwind + Html5-Qrcode + Canvas Compressor)
│   ├── manifest.json     # PWA Web App Manifest (Installable on iOS & Android)
│   └── sw.js             # Service Worker (Offline shell & asset caching)
├── functions/
│   └── api/
│       ├── _utils.js     # JWT/HMAC Web Crypto, D1 Audit Helper & CORS
│       ├── upload.js     # R2 Photo Upload (Canvas compressed images)
│       ├── auth/
│       │   ├── login.js  # Mobile + PIN authentication
│       │   └── me.js     # Session verification
│       ├── employees/
│       │   └── index.js  # Employee CRUD (Admin only add/delete, all can list)
│       ├── products/
│       │   ├── index.js    # Filtered products listing & search
│       │   ├── receive.js  # Step 1: Receive Product into Inventory
│       │   ├── storage.js  # Step 2: Put in Storage Rack
│       │   ├── handover.js # Step 3: Handover for Installation
│       │   ├── install.js  # Step 4: Mark Installed (GPS + Camera Photo)
│       │   ├── reject.js   # Step 5: Reject Product (Reason + Photo)
│       │   ├── pickup.js   # Step 6: Rejected Product Return/Pickup
│       │   └── timeline.js # Complete Audit Trail Timeline
│       ├── photo/
│       │   └── [[path]].js # Serve R2 Photos with 60-day Auto-Archive Badge Handling
│       └── dashboard/
│           └── stats.js    # Real-time counter statistics & recent audit feed
├── schema.sql            # Cloudflare D1 Database Schema + Seed Data
├── wrangler.toml         # Cloudflare Pages Functions Configuration
└── README.md             # Complete Deployment & Lifecycle Guide
```

---

## 🚀 1. Cloudflare D1 (SQLite) डेटाबेस सेटअप

अपने टर्मिनल में या Cloudflare Dashboard से D1 डेटाबेस बनाएं:

### कमांड लाइन (Wrangler):
```bash
# 1. नया D1 डेटाबेस बनाएं
npx wrangler d1 create asset-tracker-db

# 2. आउटपुट में आपको database_id मिलेगा, उसे कॉपी करें और wrangler.toml में पेस्ट करें:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 3. schema.sql को अपने D1 डेटाबेस में एग्जीक्यूट करें:
npx wrangler d1 execute asset-tracker-db --remote --file=./schema.sql
```

### डिफ़ॉल्ट एडमिन क्रेडेंशियल:
- **मोबाइल नंबर:** `9876543210`
- **PIN:** `1234`
- **रोल:** `admin`

---

## 📸 2. Cloudflare R2 बकेट और 60-दिन ऑटो-डिलीट लाइफसाइकिल सेटअप

### 1. R2 बकेट बनाएं:
```bash
npx wrangler r2 bucket create asset-tracker-photos
```

### 2. 60-Day Auto-Delete Rule (Object Lifecycle Rule) सेट करना:
Cloudflare R2 में 10GB स्टोरेज प्रति माह मुफ़्त है। 60 दिन बाद फोटो को स्वचालित रूप से हटाने के लिए:
1. **Cloudflare Dashboard** पर लॉगिन करें।
2. बायीं ओर **R2** पर क्लिक करें और `asset-tracker-photos` बकेट खोलें।
3. **Settings** टैब पर जाएं और **Object Lifecycle Rules** सेक्शन तक स्क्रॉल करें।
4. **Add Rule** पर क्लिक करें:
   - **Rule Name:** `Delete photos after 60 days`
   - **Prefix:** `photos/` (या खाली छोड़ें)
   - **Action:** `Delete uploaded objects`
   - **Age in days:** `60` दिन दर्ज करें।
5. **Save** पर क्लिक करें।

> **💡 UI हैंडलिंग:** जब कोई फोटो 60 दिन बाद R2 द्वारा डिलीट हो जाएगी, तो ऐप का टाइमलाइन व्यूवर टूटे हुए इमेज आइकन की जगह यह सुंदर बैज प्रदर्शित करेगा:  
> `60 दिन बाद फोटो आर्काइव/डिलीट की गई (रिकॉर्ड सुरक्षित है)`  
> D1 डेटाबेस में उसका सीरियल नंबर, कर्मचारी का नाम, तारीख, समय और GPS हमेशा स्थायी सुरक्षित रहेगा!

---

## 🌐 3. GitHub & Cloudflare Pages ऑटो-डिप्लॉयमेंट (₹0 लागत)

### 1. GitHub रिपॉजिटरी में कोड पुश करें:
```bash
git init
git add .
git commit -m "Initial commit: Asset & Installation Tracker PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/asset-tracker-pwa.git
git push -u origin main
```

### 2. Cloudflare Pages से जोड़ें:
1. Cloudflare Dashboard में **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git** पर जाएं।
2. अपनी GitHub रिपॉजिटरी `asset-tracker-pwa` चुनें।
3. बिल्ड सेटिंग्स:
   - **Framework preset:** `None`
   - **Build command:** (खाली छोड़ें)
   - **Build output directory:** `public`
4. **Save and Deploy** पर क्लिक करें।

### 3. D1 और R2 बाइंडिंग लिंक करें:
डिप्लॉय होने के बाद:
1. Pages प्रोजेक्ट की **Settings** -> **Functions** में जाएं।
2. **D1 database bindings** में:
   - Variable name: `DB`
   - D1 Database: `asset-tracker-db` चुनें।
3. **R2 bucket bindings** में:
   - Variable name: `BUCKET`
   - R2 Bucket: `asset-tracker-photos` चुनें।
4. **Deployments** टैब में जाकर **Retry deployment** या नया कमिट पुश करें।

आपकी ऐप अब लाइव URL पर तैयार है! (उदा: `https://asset-tracker-pwa.pages.dev`)
