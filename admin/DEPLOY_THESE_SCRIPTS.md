# PRML — Deploy the 3 Backend Scripts (click-by-click)

PEACE! These three Google Apps Scripts power features that are already live on the site
but won't *do* anything until they're deployed. Do this once. ~10 minutes total.

Files (in this `admin/` folder):
- `outreach_autosend.gs` — makes Quo's Airtable **"Approve & Send"** checkbox actually send email
- `deadline_watch.gs` — weekly deadline emails + auto calendar events
- `apps-script-media-addon.gs` — media **play counts + comments** storage/moderation

---

## STEP 0 — Get an Airtable token (needed by 2 of the 3 scripts)
1. Go to **airtable.com/create/tokens** (signed in as the PRML Airtable account).
2. **Create token** → name it `PRML Apps Script`.
3. Scopes: check **data.records:read** and **data.records:write**.
4. Access: add the base **PRML RECORDS OPERATIONS**.
5. **Create token** → **copy it** (you only see it once). Keep it handy for Step 2.

---

## STEP 1 — Open your Apps Script project
1. Go to **script.google.com** — sign in as **info@prmlrecords.com** (important: emails send FROM this account).
2. Open your existing PRML project (the one the website forms use) — or **New project**.

## STEP 2 — Add the Airtable token as a Script Property
1. Left sidebar → **Project Settings** (gear icon).
2. Scroll to **Script Properties** → **Add script property**.
3. Property: `AIRTABLE_TOKEN`  ·  Value: *(paste the token from Step 0)* → **Save**.

## STEP 3 — Paste in the 3 scripts
For each file below: in the Apps Script editor, **+ (Files) → Script**, name it, then paste the whole file's contents and **Save (Ctrl+S)**.
1. `outreach_autosend.gs`
2. `deadline_watch.gs`
3. `apps-script-media-addon.gs` — **and** follow its header note: add these two lines into your existing `apps-script.gs`:
   - in `doPost(e)` switch: `case 'VIEW': handleView(ss, data); break;` and `case 'COMMENT': handleComment(ss, data); break;`
   - in `doGet(e)` switch: `case 'getViews': result = getViews(ss); break;` and `case 'getComments': result = getComments(ss, e.parameter); break;`

## STEP 4 — Turn on the timers (run each once)
In the editor's function dropdown, select and **Run** each of these one time. Google will ask for permissions the first time — **Allow** (Gmail, Calendar, external requests).
1. Run **`installTrigger`** (from outreach_autosend) → auto-send checks every 10 min.
2. Run **`installDeadlineTrigger`** (from deadline_watch) → weekly Monday deadline sweep.
3. (media addon has no trigger — it responds to the website automatically once the doPost/doGet lines are added.)

## STEP 5 — Redeploy the web app (so the website talks to the new code)
1. **Deploy → Manage deployments** → your active deployment → **pencil/edit**.
2. **Version: New version** → **Deploy**. (Keep the same URL — the site already points to it.)

## STEP 6 — Quick tests
- **Auto-send:** in Airtable Outreach Queue, make a test row (recipient = your own email, Subject "TEST", Body "test"), check **Approve & Send**. Within ~10 min it should arrive, `Sent At` stamps, Status → Sent. Then delete the test row. (Run `dryRun` first to preview without sending.)
- **Deadline watch:** Run `deadlineWatch` once → check your inbox for "PRML Deadlines This Week" + new calendar events.
- **Comments/views:** open prmlrecords.com/media.html, play a track, leave a comment → the comment appears in the Sheet's "Comments" tab (Approved=FALSE). Set Approved=TRUE to show it on the site; play counts show under each item.

---

**Done.** After this, Quo's approve button sends for real, deadlines email you weekly, and the media page counts plays + collects moderated comments.

With Gratitude,
FLY
