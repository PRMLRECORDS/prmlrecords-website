# PRML RECORDS — Serverless API

This folder will contain Vercel serverless functions.

Planned endpoints:
- api/checkout.js — Stripe Payment Intent creation (cart checkout)
- api/webhook.js  — Stripe webhook handler (order fulfillment)
- api/contact.js  — Form submission → Supabase

Deploy: Connect this GitHub repo to Vercel (vercel.com → Import Project → PRMLRECORDS/prmlrecords-website).
All /api/* routes will be served by Vercel functions. Static files served by Render as before.
