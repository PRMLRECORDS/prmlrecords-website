/**
 * PRML RECORDS — Outreach Auto-Sender (Airtable → Gmail)
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS THE MISSING PIECE that makes QUO's "Approve & Send" checkbox work.
 *
 * WHAT IT DOES:
 *   Every 10 minutes it scans the Airtable "Outreach Queue" and "Cold Outreach"
 *   tables for rows where  Approve & Send = TRUE  and  Sent At is empty.
 *   For each one it:
 *     1. Sends the email (Subject + Body) from info@prmlrecords.com via Gmail
 *     2. Stamps "Sent At" with the timestamp
 *     3. Sets Status = Sent/Submitted  (Outreach Queue) or Sent (Cold Outreach)
 *   Rows with a blank/"TBD"/invalid recipient are skipped and left for review.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE-TIME DEPLOYMENT (do this once — ~5 minutes):
 *   1. Go to script.google.com  → New project  → name it "PRML Outreach Sender"
 *      IMPORTANT: sign in as the info@prmlrecords.com Google account, because
 *      the emails send FROM whichever account owns this script.
 *   2. Paste ALL of this file in, and Save.
 *   3. Project Settings (gear icon) → Script Properties → Add property:
 *          Name:  AIRTABLE_TOKEN
 *          Value: <a Airtable Personal Access Token with data.records:read +
 *                  data.records:write scope on the PRML RECORDS OPERATIONS base>
 *      (Create the token at airtable.com/create/tokens — never paste it in code.)
 *   4. Run the function  installTrigger  once. Approve the Gmail + external-request
 *      permissions when Google asks. This sets up the 10-minute auto-run.
 *   5. (Optional test) Run  dryRun  — it logs what WOULD send without sending.
 *   Done. From now on, QUO just checks "Approve & Send" and it goes out.
 * ═══════════════════════════════════════════════════════════════════════════
 */

var BASE_ID   = 'app3ABwfzM6QJM7UL';        // PRML RECORDS OPERATIONS
var FROM_NAME = 'PRML RECORDS';
var REPLY_TO  = 'info@prmlrecords.com';

// CAN-SPAM footer appended to every send (physical address + opt-out).
var FOOTER =
  '\n\n—\nPRML RECORDS · Atlanta, GA\n' +
  'You are receiving this because PRML RECORDS reached out about a partnership, ' +
  'booking, or opportunity. Reply "unsubscribe" and we will not contact you again.';

/**
 * Table configs. Each maps the Airtable field NAMES this script reads/writes.
 * Add another block here if you build a third approve-and-send table.
 */
var TABLES = [
  {
    name:     'Outreach Queue',
    tableId:  'tblF75xqGIvPGgM1k',
    fTo:      'To / Recipient',
    fSubject: 'Subject',
    fBody:    'Draft / Details',
    fApprove: 'Approve & Send',
    fSentAt:  'Sent At',
    fStatus:  'Status',
    sentStatus: 'Sent/Submitted'
  },
  {
    name:     'Cold Outreach',
    tableId:  'tblcHfnxtmuwoQeoY',
    fTo:      'Email',
    fSubject: 'Subject',
    fBody:    'Email Body',
    fApprove: 'Approve & Send',
    fSentAt:  'Sent At',
    fStatus:  'Status',
    sentStatus: 'Sent'
  }
];

/* ── MAIN: runs on the timer ─────────────────────────────── */
function checkAndSend() { run_(false); }

/* ── DRY RUN: logs intended sends, sends nothing ─────────── */
function dryRun() { run_(true); }

function run_(dry) {
  var token = PropertiesService.getScriptProperties().getProperty('AIRTABLE_TOKEN');
  if (!token) { Logger.log('ERROR: AIRTABLE_TOKEN script property is not set.'); return; }

  var totalSent = 0, totalSkipped = 0;

  TABLES.forEach(function (t) {
    var records = airtableList_(token, t);
    records.forEach(function (rec) {
      var f = rec.fields || {};
      var to = String(f[t.fTo] || '').trim();
      var subject = String(f[t.fSubject] || '').trim();
      var body = String(f[t.fBody] || '').trim();

      // guardrails
      if (!isValidEmail_(to)) { Logger.log('SKIP ['+t.name+'] bad recipient: "'+to+'"'); totalSkipped++; return; }
      if (!subject || !body)  { Logger.log('SKIP ['+t.name+'] missing subject/body for '+to); totalSkipped++; return; }

      if (dry) { Logger.log('WOULD SEND ['+t.name+'] → '+to+' | '+subject); totalSent++; return; }

      try {
        GmailApp.sendEmail(to, subject, body + FOOTER, { name: FROM_NAME, replyTo: REPLY_TO });
        airtablePatch_(token, t, rec.id, buildSentPatch_(t));
        Logger.log('SENT ['+t.name+'] → '+to+' | '+subject);
        totalSent++;
      } catch (err) {
        Logger.log('FAIL ['+t.name+'] → '+to+' : '+err);
        totalSkipped++;
      }
    });
  });

  Logger.log((dry ? 'DRY RUN' : 'RUN') + ' complete. Sent/queued: ' + totalSent + ' | Skipped: ' + totalSkipped);
}

/* ── Airtable: list approved + unsent rows ───────────────── */
function airtableList_(token, t) {
  // {Approve & Send}=1  AND  {Sent At} is blank
  var formula = 'AND({' + t.fApprove + '}=1, {' + t.fSentAt + '}=BLANK())';
  var url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + t.tableId
          + '?filterByFormula=' + encodeURIComponent(formula) + '&pageSize=50';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) { Logger.log('Airtable list error ['+t.name+']: '+res.getContentText()); return []; }
  return (JSON.parse(res.getContentText()).records) || [];
}

/* ── Airtable: stamp Sent At + Status ────────────────────── */
function buildSentPatch_(t) {
  var fields = {};
  fields[t.fSentAt] = new Date().toISOString();
  fields[t.fStatus] = t.sentStatus;
  return fields;
}

function airtablePatch_(token, t, recId, fields) {
  var url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + t.tableId + '/' + recId;
  var res = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) Logger.log('Airtable patch error: ' + res.getContentText());
}

/* ── helpers ─────────────────────────────────────────────── */
function isValidEmail_(s) {
  if (!s) return false;
  if (/tbd|confirm|n\/a|none/i.test(s)) return false;   // holds like "TBD — confirm contact"
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* ── run ONCE to install the 10-minute timer ─────────────── */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'checkAndSend') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('checkAndSend').timeBased().everyMinutes(10).create();
  Logger.log('Installed: checkAndSend runs every 10 minutes.');
}
