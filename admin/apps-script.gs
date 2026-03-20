/**
 * PRML Records LLC — Google Apps Script
 * ─────────────────────────────────────────────────────────────────────────
 * This handles all form submissions from prmlrecords.com:
 *   • Contact / quote inquiries  → "Leads" sheet + email alert
 *   • Support tickets            → "Support" sheet + email alert
 *   • Email list signups         → "Email List" sheet
 *   • Cart order notifications   → "Orders" sheet
 *
 * HOW TO DEPLOY:
 *   1. Go to script.google.com
 *   2. Open your existing project (or create new one)
 *   3. Replace ALL the code with this file's contents
 *   4. Click Deploy → New Deployment
 *      - Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Click Deploy → copy the Web App URL (ends in /exec)
 *   6. Paste that URL into js/main.js on the GAS_URL line
 *   7. Commit and push to GitHub — done.
 *
 * Sheet ID (already set): 10hOO67uBb5rPpoFrXaW9sLm04hJSY_8yTwDb3XgUlMA
 * Alert email: info@prmlrecords.com
 * ─────────────────────────────────────────────────────────────────────────
 */

var SHEET_ID     = '10hOO67uBb5rPpoFrXaW9sLm04hJSY_8yTwDb3XgUlMA';
var ALERT_EMAIL  = 'info@prmlrecords.com';
var SITE_NAME    = 'PRML Records LLC';

/* ── CORS PREFLIGHT ──────────────────────────── */
function doGet(e) {

  if(data.type==='BOOKING'){
    var sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
    if(sh.getLastRow()===0) sh.appendRow(['Date','Artist','Status','ClientName','Email','Phone','Organization','EventDate','EventTime','EventType','Venue','SetLength','Attendance','Budget','Details','Source']);
    sh.appendRow([data.ts,data.artist,data.status||'Inquiry',data.name||data.client,data.email,data.phone,data.organization||data.org,data.event_date||data.date,data.event_time||data.time,data.event_type,data.venue,data.set_length,data.attendance,data.budget,data.details||data.notes,data.source||'Website']);
    if(data.email){
      try{ MailApp.sendEmail({to:data.email,subject:'Booking Request Received — PRML Records',body:'Hi '+data.name+',

We received your booking request for '+data.artist+' on '+data.event_date+'. We will confirm availability and reach out within 24 hours.

For urgent inquiries call 770-686-7726.

PRML Records LLC
info@prmlrecords.com
770-686-7726'}); }catch(e){}
    }
    MailApp.sendEmail({to:'info@prmlrecords.com',subject:'New Booking Request: '+data.artist+' — '+(data.event_date||'TBD'),body:'Artist: '+data.artist+'\nClient: '+data.name+'\nEmail: '+data.email+'\nPhone: '+data.phone+'\nDate: '+data.event_date+'\nVenue: '+data.venue+'\nType: '+data.event_type+'\nBudget: '+data.budget+'\n\nDetails: '+data.details});
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'PRML Records API — OK' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── MAIN HANDLER ────────────────────────────── */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss   = SpreadsheetApp.openById(SHEET_ID);

    switch (data.type) {
      case 'INQUIRY': handleInquiry(ss, data); break;
      case 'SUPPORT': handleSupport(ss, data); break;
      case 'EMAIL':   handleEmailSignup(ss, data); break;
      case 'ORDER':   handleOrder(ss, data); break;
      case 'INVOICE': handleInvoice(ss, data); break;
      case 'PRODUCT':      handleProduct(ss, data); break;
      case 'GOAL':         handleGoal(ss, data); break;
      case 'GRANT':        handleGrant(ss, data); break;
      case 'CREATE_POST':  handleBlogDraft(ss, data); break;
      case 'DELETE_POST':  deletePost(ss, data); break;
      case 'UPDATE_GOAL':  updateGoal(ss, data); break;
      case 'UPDATE_GRANT': updateGrant(ss, data); break;
      case 'SOCIAL_QUEUE': handleSocialQuick(ss, data); break;
      case 'SOCIAL_QUICK': handleSocialQuick(ss, data); break;
      case 'SHORTCUT':     handleShortcut(ss, data); break;
    }

  
  if(data.type==='BOOKING'){
    var sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
    if(sh.getLastRow()===0) sh.appendRow(['Date','Artist','Status','ClientName','Email','Phone','Organization','EventDate','EventTime','EventType','Venue','SetLength','Attendance','Budget','Details','Source']);
    sh.appendRow([data.ts,data.artist,data.status||'Inquiry',data.name||data.client,data.email,data.phone,data.organization||data.org,data.event_date||data.date,data.event_time||data.time,data.event_type,data.venue,data.set_length,data.attendance,data.budget,data.details||data.notes,data.source||'Website']);
    if(data.email){
      try{ MailApp.sendEmail({to:data.email,subject:'Booking Request Received — PRML Records',body:'Hi '+data.name+',

We received your booking request for '+data.artist+' on '+data.event_date+'. We will confirm availability and reach out within 24 hours.

For urgent inquiries call 770-686-7726.

PRML Records LLC
info@prmlrecords.com
770-686-7726'}); }catch(e){}
    }
    MailApp.sendEmail({to:'info@prmlrecords.com',subject:'New Booking Request: '+data.artist+' — '+(data.event_date||'TBD'),body:'Artist: '+data.artist+'\nClient: '+data.name+'\nEmail: '+data.email+'\nPhone: '+data.phone+'\nDate: '+data.event_date+'\nVenue: '+data.venue+'\nType: '+data.event_type+'\nBudget: '+data.budget+'\n\nDetails: '+data.details});
  }
  return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    Logger.log('Error: ' + err.toString());
  
  if(data.type==='BOOKING'){
    var sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
    if(sh.getLastRow()===0) sh.appendRow(['Date','Artist','Status','ClientName','Email','Phone','Organization','EventDate','EventTime','EventType','Venue','SetLength','Attendance','Budget','Details','Source']);
    sh.appendRow([data.ts,data.artist,data.status||'Inquiry',data.name||data.client,data.email,data.phone,data.organization||data.org,data.event_date||data.date,data.event_time||data.time,data.event_type,data.venue,data.set_length,data.attendance,data.budget,data.details||data.notes,data.source||'Website']);
    if(data.email){
      try{ MailApp.sendEmail({to:data.email,subject:'Booking Request Received — PRML Records',body:'Hi '+data.name+',

We received your booking request for '+data.artist+' on '+data.event_date+'. We will confirm availability and reach out within 24 hours.

For urgent inquiries call 770-686-7726.

PRML Records LLC
info@prmlrecords.com
770-686-7726'}); }catch(e){}
    }
    MailApp.sendEmail({to:'info@prmlrecords.com',subject:'New Booking Request: '+data.artist+' — '+(data.event_date||'TBD'),body:'Artist: '+data.artist+'\nClient: '+data.name+'\nEmail: '+data.email+'\nPhone: '+data.phone+'\nDate: '+data.event_date+'\nVenue: '+data.venue+'\nType: '+data.event_type+'\nBudget: '+data.budget+'\n\nDetails: '+data.details});
  }
  return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ── INQUIRY / QUOTE FORM ────────────────────── */
function handleInquiry(ss, data) {
  var sh = getOrCreateSheet(ss, 'Leads', [
    'Date','Name','Email','Phone','Business Name',
    'Service','Budget','Timeline','Details','Source','Status'
  ]);

  sh.appendRow([
    formatDate(data.ts),
    data.name    || '',
    data.email   || '',
    data.phone   || '',
    data.business|| '',
    data.service || '',
    data.budget  || '',
    data.timeline|| '',
    data.details || '',
    data.source  || '',
    'New'           // default status for easy tracking
  ]);

  // Email alert
  var subject = '🎯 New Lead: ' + (data.service || 'General Inquiry') + ' — ' + (data.name || 'Unknown');
  var body =
    'New inquiry from prmlrecords.com\n' +
    '═══════════════════════════════\n\n' +
    'Name:     ' + (data.name    || '—') + '\n' +
    'Email:    ' + (data.email   || '—') + '\n' +
    'Phone:    ' + (data.phone   || '—') + '\n' +
    'Business: ' + (data.business|| '—') + '\n\n' +
    'Service:  ' + (data.service || '—') + '\n' +
    'Budget:   ' + (data.budget  || '—') + '\n' +
    'Timeline: ' + (data.timeline|| '—') + '\n\n' +
    'Details:\n' + (data.details || '—') + '\n\n' +
    'Source:   ' + (data.source  || '—') + '\n' +
    'Submitted: ' + formatDate(data.ts) + '\n\n' +
    '─────────────────────────────────\n' +
    'View sheet: https://docs.google.com/spreadsheets/d/' + SHEET_ID;

  MailApp.sendEmail({ to: ALERT_EMAIL, subject: subject, body: body });
}

/* ── SUPPORT TICKET ──────────────────────────── */
function handleSupport(ss, data) {
  var sh = getOrCreateSheet(ss, 'Support', [
    'Date','Name','Email','Phone','Order #','Issue Type','Details','Status'
  ]);

  sh.appendRow([
    formatDate(data.ts),
    data.name   || '',
    data.email  || '',
    data.phone  || '',
    data.order  || '',
    data.issue  || '',
    data.details|| '',
    'Open'
  ]);

  var subject = '🛠 Support Ticket: ' + (data.issue || 'General') + ' — ' + (data.name || 'Unknown');
  var body =
    'Support ticket from prmlrecords.com\n' +
    '═══════════════════════════════════\n\n' +
    'Name:     ' + (data.name   || '—') + '\n' +
    'Email:    ' + (data.email  || '—') + '\n' +
    'Phone:    ' + (data.phone  || '—') + '\n' +
    'Order #:  ' + (data.order  || '—') + '\n\n' +
    'Issue:    ' + (data.issue  || '—') + '\n\n' +
    'Details:\n' + (data.details|| '—') + '\n\n' +
    'Submitted: ' + formatDate(data.ts);

  MailApp.sendEmail({ to: ALERT_EMAIL, subject: subject, body: body });
}

/* ── EMAIL LIST SIGNUP ───────────────────────── */
function handleEmailSignup(ss, data) {
  var sh = getOrCreateSheet(ss, 'Email List', ['Date Joined','Email']);

  // Prevent duplicate emails
  var emails = sh.getDataRange().getValues().map(function(r) { return r[1]; });
  if (emails.indexOf(data.email) === -1) {
    sh.appendRow([formatDate(data.ts), data.email || '']);
  }
}

/* ── ORDER NOTIFICATION ──────────────────────── */
function handleOrder(ss, data) {
  var sh = getOrCreateSheet(ss, 'Orders', [
    'Date','Items','Total','Amount Charged','Payment Type','Status'
  ]);

  sh.appendRow([
    formatDate(data.ts),
    data.items       || '',
    '$' + (data.total  || '0'),
    '$' + (data.amount || '0'),
    data.label       || (data.depositOnly ? 'Deposit' : 'Full'),
    'Pending'
  ]);

  var subject = '🛒 Order Intent: $' + (data.amount || '0') + ' — ' + (data.label || 'Payment');
  var body =
    'Cart checkout initiated on prmlrecords.com\n' +
    '══════════════════════════════════════════\n\n' +
    'Items:\n' + (data.items || '—') + '\n\n' +
    'Cart Total: $' + (data.total  || '0') + '\n' +
    'Charged:    $' + (data.amount || '0') + ' (' + (data.label || 'Payment') + ')\n\n' +
    'Date: ' + formatDate(data.ts) + '\n\n' +
    'Note: Confirm payment was received in Stripe dashboard.';

  MailApp.sendEmail({ to: ALERT_EMAIL, subject: subject, body: body });
}

/* ── HELPERS ─────────────────────────────────── */
function getOrCreateSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    // Style header row
    sh.getRange(1, 1, 1, headers.length)
      .setBackground('#0D0D0D')
      .setFontColor('#E01010')
      .setFontWeight('bold');
  }
  return sh;
}

function formatDate(isoString) {
  try {
    var d = new Date(isoString);
    return Utilities.formatDate(d, 'America/New_York', 'MM/dd/yyyy HH:mm:ss');
  } catch(e) {
    return isoString || new Date().toString();
  }
}

/* ── INVOICE ─────────────────────────────────── */
function handleInvoice(ss, data) {
  var sh = getOrCreateSheet(ss, 'Invoices', [
    'Date','Invoice #','Customer','Email','Phone','Business',
    'Items','Subtotal','Stripe Fee','Total','Amount Due',
    'Pay Type','Due Date','Notes','Status'
  ]);

  sh.appendRow([
    formatDate(data.ts),
    data.invoice_num    || '',
    data.customer_name  || '',
    data.customer_email || '',
    data.customer_phone || '',
    data.customer_biz   || '',
    data.items          || '',
    '$' + (data.subtotal    || '0'),
    '$' + (data.stripe_fee  || '6.00'),
    '$' + (data.total       || '0'),
    '$' + (data.amount_due  || '0'),
    data.pay_type       || 'full',
    data.due_date       || '',
    data.notes          || '',
    'Sent'
  ]);

  // Email the invoice HTML to the customer
  if (data.customer_email && data.invoice_html) {
    try {
      MailApp.sendEmail({
        to: data.customer_email,
        bcc: ALERT_EMAIL,
        subject: 'Invoice ' + (data.invoice_num||'') + ' from PRML Records LLC — $' + (data.amount_due||data.total||'0'),
        htmlBody: data.invoice_html + '<br><br>' + (data.stripe_url
          ? '<p style="text-align:center"><a href="' + data.stripe_url + '" style="background:#E01010;color:white;padding:14px 28px;font-family:Arial,sans-serif;font-size:14px;text-decoration:none;display:inline-block">Pay Invoice →</a></p>'
          : '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">To pay, call or text us: <strong>770-686-7726</strong> or email <a href="mailto:info@prmlrecords.com">info@prmlrecords.com</a></p>'),
        name: 'PRML Records LLC'
      });
    } catch(e) {
      Logger.log('Invoice email error: ' + e.toString());
    }
  }

  // Alert to owner
  MailApp.sendEmail({
    to: ALERT_EMAIL,
    subject: '🧾 Invoice Sent: ' + (data.invoice_num||'') + ' — ' + (data.customer_name||'Unknown') + ' — $' + (data.total||'0'),
    body: 'Invoice sent to ' + (data.customer_email||'—') + '\n' +
          'Invoice #: ' + (data.invoice_num||'—') + '\n' +
          'Total: $' + (data.total||'0') + '\n' +
          'Amount Due: $' + (data.amount_due||'0') + ' (' + (data.pay_type||'full') + ')\n' +
          'Due: ' + (data.due_date||'—') + '\n\n' +
          'Items:\n' + (data.items||'—')
  });
}

/* ── PRODUCT FROM SCANNER ────────────────────── */
function handleProduct(ss, data) {
  var sh = getOrCreateSheet(ss, 'Products', [
    'Date Added','name','category','price','description','imageurl','active'
  ]);
  sh.appendRow([
    formatDate(data.ts),
    data.name        || '',
    data.category    || '',
    data.price       || '',
    data.description || '',
    data.imageurl    || '',
    data.active      || 'TRUE'
  ]);
}

/* ── GET ENDPOINTS ──────────────────────────────── */
function doGet(e) {
  var action = e.parameter.action || '';
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var result = {};

  try {
    switch(action) {
      case 'ping':
        result = { ok: true, ts: new Date().toISOString() };
        break;
      case 'getPosts':
        result = getPosts(ss, e.parameter);
        break;
      case 'getGoals':
        result = getGoals(ss);
        break;
      case 'getGrants':
        result = getGrants(ss);
        break;
      case 'getServices':
        result = getServices(ss, e.parameter);
        break;
      case 'getSocialQueue':
        result = getSocialQueue(ss);
        break;
      default:
        result = { ok: true, message: 'PRML Records API' };
    }
  } catch(err) {
    result = { error: err.toString() };
  }


  if(data.type==='BOOKING'){
    var sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
    if(sh.getLastRow()===0) sh.appendRow(['Date','Artist','Status','ClientName','Email','Phone','Organization','EventDate','EventTime','EventType','Venue','SetLength','Attendance','Budget','Details','Source']);
    sh.appendRow([data.ts,data.artist,data.status||'Inquiry',data.name||data.client,data.email,data.phone,data.organization||data.org,data.event_date||data.date,data.event_time||data.time,data.event_type,data.venue,data.set_length,data.attendance,data.budget,data.details||data.notes,data.source||'Website']);
    if(data.email){
      try{ MailApp.sendEmail({to:data.email,subject:'Booking Request Received — PRML Records',body:'Hi '+data.name+',

We received your booking request for '+data.artist+' on '+data.event_date+'. We will confirm availability and reach out within 24 hours.

For urgent inquiries call 770-686-7726.

PRML Records LLC
info@prmlrecords.com
770-686-7726'}); }catch(e){}
    }
    MailApp.sendEmail({to:'info@prmlrecords.com',subject:'New Booking Request: '+data.artist+' — '+(data.event_date||'TBD'),body:'Artist: '+data.artist+'\nClient: '+data.name+'\nEmail: '+data.email+'\nPhone: '+data.phone+'\nDate: '+data.event_date+'\nVenue: '+data.venue+'\nType: '+data.event_type+'\nBudget: '+data.budget+'\n\nDetails: '+data.details});
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getPosts(ss, params) {
  var sh = ss.getSheetByName('Posts');
  if (!sh) return { posts: [] };
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var limit = parseInt(params.limit) || 10;
  var published = params.published === 'true';
  var posts = rows.slice(1).map(function(r) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  }).filter(function(p) {
    return published ? p.published === true || p.published === 'TRUE' : true;
  }).slice(0, limit);
  return { posts: posts };
}

function getGoals(ss) {
  var sh = ss.getSheetByName('Goals');
  if (!sh) return { goals: [] };
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var goals = rows.slice(1).map(function(r) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  });
  return { goals: goals };
}

function getGrants(ss) {
  var sh = ss.getSheetByName('Grants');
  if (!sh) return { grants: [] };
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var grants = rows.slice(1).map(function(r) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  });
  return { grants: grants };
}

function getServices(ss, params) {
  var sh = ss.getSheetByName('Services');
  if (!sh) return { services: [] };
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var category = params.category || '';
  var services = rows.slice(1).map(function(r) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  }).filter(function(s) {
    if (s.active === false || s.active === 'FALSE') return false;
    if (category) return s.category === category;
    return true;
  });
  return { services: services };
}

function getSocialQueue(ss) {
  var sh = ss.getSheetByName('SocialQueue');
  if (!sh) return { queue: [] };
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var queue = rows.slice(1).map(function(r) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  });
  return { queue: queue };
}

/* ── SHORTCUT WEBHOOK ───────────────────────────── */
function handleShortcut(ss, data) {
  // Routes iPhone Shortcut data to the right handler
  var subtype = data.subtype || data.content_type || '';
  if (subtype === 'blog' || data.title) handleBlogDraft(ss, data);
  else if (subtype === 'lead' || data.name) handleInquiry(ss, data);
  else if (subtype === 'social') handleSocialQuick(ss, data);
  else if (subtype === 'grant') handleGrant(ss, data);
}

function handleBlogDraft(ss, data) {
  var sh = getOrCreateSheet(ss, 'Posts', ['id','title','slug','excerpt','content','image','date','author','category','published']);
  var slug = (data.title||'post').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  sh.appendRow(['post-'+Date.now(), data.title||'', slug, data.excerpt||'', data.content||'', '', formatDate(data.ts), data.author||'PRML Records', data.category||'', false]);
}

function handleSocialQuick(ss, data) {
  var sh = getOrCreateSheet(ss, 'SocialQueue', ['date','platform','content','image','status','post_id']);
  sh.appendRow([formatDate(data.ts), data.platform||'ig', data.content||'', '', 'Draft', 'sq-'+Date.now()]);
}

function handleGrant(ss, data) {
  var sh = getOrCreateSheet(ss, 'Grants', ['id','name','funder','deadline','amount','status','notes','next_steps']);
  sh.appendRow([Date.now(), data.name||'', data.funder||'', data.deadline||'', data.amount||'', 'Not Started', data.notes||'', '']);
}

/* Add SHORTCUT and SOCIAL_QUEUE to the POST switch */
// (Already handled by the existing switch — SOCIAL_QUEUE maps to SocialQueue sheet via handleSocialQuick)

function handleGoal(ss, data) {
  var sh = getOrCreateSheet(ss, 'Goals', ['id','goal','category','target','progress','milestones','status']);
  sh.appendRow([data.id||Date.now(), data.goal||'', data.category||'', data.target||'', data.progress||0, data.milestones||'', data.status||'In Progress']);
}

function updateGoal(ss, data) {
  var sh = ss.getSheetByName('Goals');
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sh.getRange(i+1, 1, 1, 7).setValues([[data.id, data.goal||rows[i][1], data.category||rows[i][2], data.target||rows[i][3], data.progress!=null?data.progress:rows[i][4], data.milestones||rows[i][5], data.status||rows[i][6]]]);
      return;
    }
  }
  handleGoal(ss, data); // insert if not found
}

function updateGrant(ss, data) {
  var sh = ss.getSheetByName('Grants');
  if (!sh) return handleGrant(ss, data);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sh.getRange(i+1, 1, 1, 8).setValues([[data.id, data.name||rows[i][1], data.funder||rows[i][2], data.deadline||rows[i][3], data.amount||rows[i][4], data.status||rows[i][5], data.notes||rows[i][6], data.next_steps||rows[i][7]]]);
      return;
    }
  }
  handleGrant(ss, data);
}

function deletePost(ss, data) {
  var sh = ss.getSheetByName('Posts');
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) { sh.deleteRow(i+1); return; }
  }
}
