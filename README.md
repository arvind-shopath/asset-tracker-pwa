# 📦 Asset & Installation Tracking Web App (PWA)
### Cloudflare Edge Architecture & GitHub Deployment Guide

Enterprise-grade Asset & Installation Tracking Progressive Web Application (PWA) designed with Apple SF Pro aesthetics.

---

## 👥 Default Credentials
- **Admin Login:**
  - Phone: `9876543210`
  - PIN: `1234`
- **Employee Login:**
  - Phone: `9876543211`
  - PIN: `1234`

---

## 🏗️ Project Architecture

```text
asset-tracker-pwa/
├── public/
│   ├── index.html        # Bilingual Apple-Style PWA (English primary, Hindi secondary)
│   ├── manifest.json     # PWA Web App Manifest
│   └── sw.js             # Service Worker
├── functions/
│   └── api/
│       ├── _utils.js     # Web Crypto HMAC Auth, D1 & KV storage sync
│       ├── upload.js     # Photo Upload & Archive Handling
│       ├── auth/
│       │   ├── login.js  # Phone + PIN authentication
│       │   └── me.js     # Session verification
│       ├── employees/
│       │   └── index.js  # Staff Management
│       ├── products/
│       │   ├── index.js    # Filtered products listing & search
│       │   ├── receive.js  # Step 1: Receive Inbound Product
│       │   ├── storage.js  # Step 2: Store in Rack/Shelf
│       │   ├── handover.js # Step 3: Handover to Installer
│       │   ├── install.js  # Step 4: Mark Installed (GPS + Camera Photo)
│       │   ├── reject.js   # Step 5: Reject Product (Reason + Photo)
│       │   ├── pickup.js   # Step 6: Return Pickup Handover
│       │   └── timeline.js # Complete Audit Trail Timeline
│       ├── photo/
│       │   └── [[path]].js # Serve Photos with 60-day Archive Badge
│       └── dashboard/
│           └── stats.js    # Real-time counter statistics & recent audit feed
├── schema.sql            # Database Schema & Seed Data
├── wrangler.toml         # Cloudflare Deployment Configuration
└── README.md             # Project Documentation
```
