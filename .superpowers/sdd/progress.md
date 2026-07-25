# PRML Consultation Booking — SDD Progress Ledger
Plan: docs/superpowers/plans/2026-06-26-prml-consultation-booking.md

- Task 1 (Stripe $75 link): COMPLETE — https://buy.stripe.com/4gMbJ22ax9NIf1I4Iy1ZS12 (redirect set, LIVE mode)
- Task 2 (Airtable Consultations table): COMPLETE — tblbFsVi2SL2fKBgk
- Task 3: folder COMPLETE 138GJotEZcOjOimzv1g2-db__ZfHyHLMH; OWNER must populate empty NDA Doc 10Yrtt... + add {{NAME}}/{{DATE}}/{{SIGNATURE}}
- Task 4-8 (Apps Script backend): COMPLETE (commits 66c51bc + fix 90c3f59, review clean). Minor open: free-slot race (Phase 2), NDA-before-Sheet order (spec).
- Task 9 (consultation.html): COMPLETE (commit 015213a, review clean). Minor: null-count→paid UX noted for final review.
- Task 10 (repoint CTAs): COMPLETE (consult CTAs -> consultation.html; 5 product/bulk left on contact.html; verified no malformed). commit below.
- Task 11 (deploy): pending [owner-gated: Apps Script redeploy + approved push]
- Task 9: COMPLETE (commit 015213a, review clean)
- Task 10: COMPLETE (commit f82582b)
- FINAL whole-branch review: PASS after honeypot fix (commit 1429c7b). Verdict: ready to deploy.
- Task 11 (deploy): PENDING owner — (1) redeploy Apps Script FIRST, (2) NDA doc, (3) approve site push
- Task 11 (deploy): COMPLETE 2026-06-27 — Apps Script redeployed (getConsultCount={remaining:2,fee:75}); site live (consultation.html 200, CTAs repointed); cache-bust 941c62b. REMAINING owner item: populate empty NDA template Doc 10Yrtt + {{NAME}}/{{DATE}}/{{SIGNATURE}} + link-view.
