/**
 * PRML RECORDS — Deadline Watch (Airtable → Google Calendar + email)
 * ─────────────────────────────────────────────────────────────────────────
 * PERMANENT, always-on version of "never miss a deadline." Runs on Google's
 * servers on a weekly timer (no computer or Claude session needed).
 *
 * WHAT IT DOES (every Monday ~8am):
 *   1. Reads the Airtable "Opportunities Pipeline" for anything with a
 *      Deadline / Date in the next LOOKAHEAD_DAYS (default 21) that is not
 *      already Expired / Won / Skipped.
 *   2. Creates an all-day Google Calendar event on each deadline (skipping any
 *      that already exist), with an email reminder 3 days out + popup 1 day out.
 *   3. Emails info@prmlrecords.com one digest of every upcoming deadline,
 *      HIGH priority and anything due within 5 days flagged at the top.
 *
 * DEPLOY (once, ~3 min — can live in the SAME Apps Script project as
 *   outreach_autosend.gs since both use the AIRTABLE_TOKEN script property):
 *   1. script.google.com (as info@prmlrecords.com) → paste this file.
 *   2. Ensure Script Property AIRTABLE_TOKEN is set (read scope on the base).
 *   3. Run  installDeadlineTrigger  once, approve Calendar + Gmail permissions.
 *   4. (Optional) Run  deadlineWatch  now to test — check your calendar + inbox.
 * ─────────────────────────────────────────────────────────────────────────
 */

var DL_BASE_ID   = 'app3ABwfzM6QJM7UL';
var DL_TABLE_ID  = 'tblh6Vb7REZVtTkZg';      // Opportunities Pipeline
var DL_ALERT     = 'info@prmlrecords.com';
var LOOKAHEAD_DAYS = 21;
var SKIP_STATUSES  = ['Expired', 'Won', 'Skipped'];

function deadlineWatch() {
  var token = PropertiesService.getScriptProperties().getProperty('AIRTABLE_TOKEN');
  if (!token) { Logger.log('ERROR: AIRTABLE_TOKEN not set.'); return; }

  var now = new Date();
  var horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 864e5);
  var cal = CalendarApp.getDefaultCalendar();
  var records = dlFetch_(token);
  var upcoming = [];

  records.forEach(function (rec) {
    var f = rec.fields || {};
    var name = f['Opportunity']; if (!name) return;
    var dateStr = f['Deadline / Date']; if (!dateStr) return;
    var status = String(f['Status'] || '');
    if (SKIP_STATUSES.indexOf(status) !== -1) return;

    var d = new Date(dateStr + 'T09:00:00');
    if (isNaN(d) || d < stripTime_(now) || d > horizon) return;

    var priority = String(f['Priority'] || '');
    var amount = String(f['Amount / Value'] || '');
    upcoming.push({ name: name, date: d, priority: priority, amount: amount });

    // create calendar event if one with this title isn't already on that day
    var title = '⏰ DEADLINE: ' + name;
    var existing = cal.getEventsForDay(d).some(function (e) { return e.getTitle() === title; });
    if (!existing) {
      var ev = cal.createAllDayEvent(title, d, { description: 'PRML Opportunities Pipeline. Priority: ' + priority + '. ' + amount });
      try { ev.addEmailReminder(3 * 24 * 60); ev.addPopupReminder(24 * 60); } catch (e) {}
    }
  });

  upcoming.sort(function (a, b) { return a.date - b.date; });
  MailApp.sendEmail({ to: DL_ALERT, subject: 'PRML Deadlines This Week', body: buildDigest_(upcoming, now) });
  Logger.log('Deadline watch done. ' + upcoming.length + ' upcoming in next ' + LOOKAHEAD_DAYS + ' days.');
}

function buildDigest_(items, now) {
  if (!items.length) return 'PEACE! No PRML deadlines in the next ' + LOOKAHEAD_DAYS + ' days. \n\n— Deadline Watch';
  var soon = items.filter(function (i) { return (i.date - now) < 5 * 864e5; });
  var body = 'PEACE! Here are your PRML deadlines for the next ' + LOOKAHEAD_DAYS + ' days.\n\n';
  if (soon.length) {
    body += '🔴 DUE WITHIN 5 DAYS — handle first:\n';
    soon.forEach(function (i) { body += '  • ' + fmt_(i.date) + ' — ' + i.name + (i.priority ? ' [' + i.priority + ']' : '') + '\n'; });
    body += '\n';
  }
  body += 'ALL UPCOMING:\n';
  items.forEach(function (i) {
    body += '  • ' + fmt_(i.date) + ' — ' + i.name + (i.priority ? ' [' + i.priority + ']' : '') + (i.amount ? ' — ' + i.amount : '') + '\n';
  });
  body += '\nFull details in Airtable → Opportunities Pipeline.\n\nWith Gratitude,\nDeadline Watch (PRML RECORDS)';
  return body;
}

function dlFetch_(token) {
  var out = [], offset = '';
  do {
    var url = 'https://api.airtable.com/v0/' + DL_BASE_ID + '/' + DL_TABLE_ID + '?pageSize=100' + (offset ? '&offset=' + offset : '');
    var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { Logger.log('Airtable error: ' + res.getContentText()); break; }
    var j = JSON.parse(res.getContentText());
    out = out.concat(j.records || []);
    offset = j.offset || '';
  } while (offset);
  return out;
}

function stripTime_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function fmt_(d) { return Utilities.formatDate(d, 'America/New_York', 'EEE MMM d'); }

function installDeadlineTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'deadlineWatch') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('deadlineWatch').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('Installed: deadlineWatch runs every Monday ~8am.');
}
