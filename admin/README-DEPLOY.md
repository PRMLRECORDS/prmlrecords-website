# PRML Records — Deployment Checklist
> Last updated for: Render.com + GitHub + Google Apps Script setup

---

## ✅ Already Done
- [x] Domain bought: prmlrecords.com (Namecheap)
- [x] DNS: www CNAME → prmlrecords-website.onrender.com
- [x] DNS: @ redirect → https://www.prmlrecords.com
- [x] Render static site: prmlrecords
- [x] GitHub repo: PRMLRECORDS/prmlrecords-website
- [x] Git push → auto deploy to Render
- [x] Google Sheet ID: 10hOO67uBb5rPpoFrXaW9sLm04hJSY_8yTwDb3XgUlMA
- [x] Apps Script deployed as web app (anyone access)

---

## 🔧 One Step Remaining — Wire the Apps Script URL

Your Apps Script is deployed but the URL hasn't been pasted into the site yet.

**Do this:**
1. Go to script.google.com
2. Open your Apps Script project
3. Click Deploy → Manage Deployments
4. Copy the Web App URL (looks like: https://script.google.com/macros/s/XXXXX/exec)
5. Open `js/main.js` in your code editor
6. Find line 19:
   ```
   const GAS_URL = 'https://script.google.com/macros/s/AKfycbzlXsUJFb36zh58jc2-N54Cmfhgh4EC478OzKehJG56qeNcZRSzFmOAU4PBHEgVdzsLyQ/exec';
   ```
7. Replace the placeholder with your actual URL
8. Save, commit, push:
   ```
   git add js/main.js
   git commit -m "Wire in Apps Script URL"
   git push
   ```
9. Render auto-deploys in ~60 seconds. Done.

---

## 🔄 Optional — Update the Apps Script Code

If you want the improved Apps Script (handles support tickets, order logs, 
duplicate email prevention, styled sheet headers, proper timezone):

1. Go to script.google.com → your project
2. Select all code → delete it
3. Paste the contents of admin/apps-script.gs
4. Click Save (disk icon)
5. Click Deploy → New Deployment → Web app
   - Execute as: Me
   - Who has access: Anyone
   - Click Deploy
6. Copy the new URL → paste into js/main.js line 19
7. git add, commit, push

---

## 💳 When You're Ready for Stripe

1. Create account at stripe.com
2. Dashboard → Payment Links → Create Payment Link
3. Set it as "Customer chooses price" / custom amount
4. Copy the link (https://buy.stripe.com/xxxxx)
5. Open js/main.js, find STRIPE_URL on line 20
6. Paste your link, save, commit, push

---

## 📊 Google Sheets CMS (for testimonials, products, FAQ)

To use the live Google Sheets content system:
1. Open your Google Sheet
2. Add tabs named: Testimonials, Products, FAQ
3. Add column headers (see admin/dashboard.html for exact columns)
4. Get a free API key at console.cloud.google.com → Enable Sheets API
5. Open js/sheets-fetcher.js → paste API key on line 16
6. Commit and push

Sheet ID is already wired in: 10hOO67uBb5rPpoFrXaW9sLm04hJSY_8yTwDb3XgUlMA

---

## 🛠 Making Updates

Edit files → git add → git commit -m "your message" → git push
Render picks it up automatically within 60–90 seconds.

---

## 📂 File Structure
```
prml-site/
├── index.html              Homepage
├── services.html           Services overview
├── sound.html              Sound Production
├── film.html               Film & Video
├── photography.html        Photography
├── web-dev.html            Web Development
├── product-design.html     Product Design & Manufacturing
├── consulting.html         Consulting
├── faq.html                FAQ (accordion)
├── testimonials.html       Reviews
├── contact.html            Contact + quote form
├── support.html            Customer support
├── render.yaml             Render.com config
├── _redirects              Clean URL routing
├── css/styles.css          All shared styles (fonts embedded)
├── js/main.js              Cart, forms, nav ← EDIT GAS_URL HERE
├── js/sheets-fetcher.js    CMS from Google Sheets
└── admin/
    ├── dashboard.html      Password-protected backend
    ├── apps-script.gs      Paste into script.google.com
    ├── documentation.html  Full setup guide
    ├── email-branding-guide.html
    └── README-DEPLOY.md    This file
```
