/**
 * PRML RECORDS — Media Add-on for apps-script.gs (view counts + moderated comments)
 * ─────────────────────────────────────────────────────────────────────────
 * MERGE THESE into the existing deployed apps-script.gs (the one media.html's
 * ENDPOINT points to), then Deploy → Manage deployments → Edit → New version.
 *
 * 1) In doPost(e)'s switch, add:
 *        case 'VIEW':    handleView(ss, data);    break;
 *        case 'COMMENT': handleComment(ss, data); break;
 * 2) In doGet(e)'s switch, add:
 *        case 'getViews':    result = getViews(ss);              break;
 *        case 'getComments': result = getComments(ss, e.parameter); break;
 * 3) Paste the functions below anywhere in the file.
 *
 * MODERATION: comments land in the "Comments" sheet with Approved = FALSE.
 * They do NOT appear on the site until you set Approved = TRUE in the sheet.
 * (Optional next step: a one-tap approve page like reply-queue.)
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ── VIEW / PLAY COUNT ──────────────────────────────────────── */
function handleView(ss, data) {
  var id = String(data.mediaId || '').trim();
  if (!id) return;
  var sh = getOrCreateSheet(ss, 'MediaViews', ['Media ID', 'Views', 'Last Played']);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      sh.getRange(i + 1, 2).setValue((Number(rows[i][1]) || 0) + 1);
      sh.getRange(i + 1, 3).setValue(formatDate(data.ts));
      return;
    }
  }
  sh.appendRow([id, 1, formatDate(data.ts)]);
}

function getViews(ss) {
  var sh = ss.getSheetByName('MediaViews');
  if (!sh) return { views: {} };
  var rows = sh.getDataRange().getValues(), out = {};
  for (var i = 1; i < rows.length; i++) { out[String(rows[i][0])] = Number(rows[i][1]) || 0; }
  return { views: out };
}

/* ── COMMENTS (public submit, moderated display) ────────────── */
function handleComment(ss, data) {
  var sh = getOrCreateSheet(ss, 'Comments', ['Date', 'Media ID', 'Name', 'Comment', 'Approved', 'IP/Source']);
  var name = String(data.name || 'Guest').slice(0, 60);
  var body = String(data.comment || '').slice(0, 800);
  if (!body.trim()) return;
  sh.appendRow([formatDate(data.ts), String(data.mediaId || ''), name, body, false, String(data.source || '')]);

  // notify owner there's a comment to approve
  try {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: 'New PRML media comment to approve — ' + name,
      body: 'A comment is pending approval on the media hub.\n\n' +
            'On: ' + (data.mediaId || '') + '\nFrom: ' + name + '\n\n"' + body + '"\n\n' +
            'Approve it by setting Approved = TRUE in the "Comments" sheet:\n' +
            'https://docs.google.com/spreadsheets/d/' + SHEET_ID
    });
  } catch (e) { Logger.log('comment notify error: ' + e); }
}

function getComments(ss, params) {
  var sh = ss.getSheetByName('Comments');
  if (!sh) return { comments: [] };
  var mediaId = String((params && params.mediaId) || '');
  var rows = sh.getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var approved = rows[i][4] === true || String(rows[i][4]).toUpperCase() === 'TRUE';
    if (!approved) continue;                                  // moderation gate
    if (mediaId && String(rows[i][1]) !== mediaId) continue;  // filter to one item
    out.push({ date: rows[i][0], mediaId: rows[i][1], name: rows[i][2], comment: rows[i][3] });
  }
  return { comments: out.reverse() };   // newest first
}
