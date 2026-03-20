/* ════════════════════════════════════════════════════════════════
   PRML Records LLC — Google Apps Script Backend v3
   prmlrecords.com | West End Atlanta
   ────────────────────────────────────────────────────────────────
   DEPLOY:
   1. Go to script.google.com → paste this entire file
   2. Deploy → New Deployment → Web App
   3. Execute as: Me | Who has access: Anyone
   4. Copy the /exec URL → paste into admin/settings.html
════════════════════════════════════════════════════════════════ */

const SHEET_ID    = '10hOO67uBb5rPpoFrXaW9sLm04hJSY_8yTwDb3XgUlMA';
const ALERT_EMAIL = 'info@prmlrecords.com';
const SITE_URL    = 'https://prmlrecords.com';

/* ── ROUTER ──────────────────────────────────────────────────── */
function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;

  try {
    switch(action) {
      case 'ping':        result = {ok:true, ts: new Date().toISOString()}; break;
      case 'getposts':    result = getPosts(ss, e.parameter); break;
      case 'getpost':     result = getPost(ss, e.parameter); break;
      case 'getservices': result = getServices(ss, e.parameter); break;
      case 'getgoals':    result = getGoals(ss); break;
      case 'getgrants':   result = getGrants(ss); break;
      case 'getsocialqueue': result = getSocialQueue(ss); break;
      default:            result = {error: 'Unknown action: '+action};
    }
  } catch(err) {
    result = {error: err.toString()};
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let data = {};

  try {
    data = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error:'Invalid JSON'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let result = {ok: true};

  try {
    switch((data.type||'').toUpperCase()) {
      case 'INQUIRY':      handleInquiry(ss, data); break;
      case 'SUPPORT':      handleSupport(ss, data); break;
      case 'EMAIL':        handleEmailSignup(ss, data); break;
      case 'ORDER':        handleOrder(ss, data); break;
      case 'INVOICE':      handleInvoice(ss, data); break;
      case 'PRODUCT':      handleProduct(ss, data); break;
      case 'CREATE_POST':  handleCreatePost(ss, data); break;
      case 'DELETE_POST':  handleDeletePost(ss, data); break;
      case 'GOAL':         handleGoal(ss, data); break;
      case 'UPDATE_GOAL':  handleGoal(ss, data); break;
      case 'GRANT':        handleGrant(ss, data); break;
      case 'UPDATE_GRANT': handleGrant(ss, data); break;
      case 'SOCIAL_QUEUE': handleSocialQueue(ss, data); break;
      case 'SOCIAL_QUICK': handleSocialQuick(ss, data); break;
      case 'SHORTCUT':     handleShortcut(ss, data); break;
      case 'BLOG_DRAFT':   handleBlogDraft(ss, data); break;
      default:             result = {error: 'Unknown type: '+data.type};
    }
  } catch(err) {
    result = {ok: false, error: err.toString()};
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── UTILITIES ───────────────────────────────────────────────── */
function formatDate(ts) {
  try { return Utilities.formatDate(new Date(ts), 'America/New_York', 'yyyy-MM-dd HH:mm'); }
  catch(e) { return ts || new Date().toISOString(); }
}

function getOrCreateSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var hRow = sh.getRange(1, 1, 1, headers.length);
    hRow.setValues([headers]);
    hRow.setBackground('#0D0D0D').setFontColor('#E01010')
        .setFontFamily('Arial').setFontSize(10).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function sheetToObjects(sh) {
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(h => String(h).toLowerCase().replace(/\s+/g,'_'));
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/* ── GET POSTS ───────────────────────────────────────────────── */
function getPosts(ss, params) {
  var sh = ss.getSheetByName('Posts');
  if (!sh) return { posts: [] };
  var rows = sheetToObjects(sh);
  var onlyPublished = params.published === 'true';
  if (onlyPublished) rows = rows.filter(function(r) { return r.published == 'TRUE' || r.published === true || r.published === 'true'; });
  var limit = parseInt(params.limit) || 50;
  rows = rows.filter(function(r){ return r.title; }).slice(0, limit);
  return { posts: rows };
}

function getPost(ss, params) {
  var sh = ss.getSheetByName('Posts');
  if (!sh) return { post: null };
  var rows = sheetToObjects(sh);
  var post = rows.find(function(r) { return r.slug === params.slug || r.post_id === params.slug; });
  return { post: post || null };
}

/* ── GET SERVICES ────────────────────────────────────────────── */
function getServices(ss, params) {
  var sh = ss.getSheetByName('Live Services');
  if (!sh) return { services: [] };
  var rows = sheetToObjects(sh);
  if (params.category) rows = rows.filter(function(r) { return r.category === params.category; });
  rows = rows.filter(function(r) { return r.active !== 'FALSE' && r.service; });
  return { services: rows };
}

/* ── GET GOALS ───────────────────────────────────────────────── */
function getGoals(ss) {
  var sh = ss.getSheetByName('90DayGoals');
  if (!sh) return { goals: [] };
  return { goals: sheetToObjects(sh).filter(function(r){ return r.goal; }) };
}

/* ── GET GRANTS ──────────────────────────────────────────────── */
function getGrants(ss) {
  var sh = ss.getSheetByName('Grants');
  if (!sh) return { grants: [] };
  return { grants: sheetToObjects(sh).filter(function(r){ return r.name; }) };
}

/* ── GET SOCIAL QUEUE ────────────────────────────────────────── */
function getSocialQueue(ss) {
  var sh = ss.getSheetByName('Social Queue');
  if (!sh) return { queue: [] };
  return { queue: sheetToObjects(sh) };
}

/* ── CREATE / UPDATE POST ────────────────────────────────────── */
function handleCreatePost(ss, data) {
  var sh = getOrCreateSheet(ss, 'Posts', [
    'post_id','title','slug','content','excerpt','image','date','author','category','published','seo_title','seo_desc'
  ]);
  var rows = sh.getDataRange().getValues();
  // Check if post with same id exists → update it
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sh.getRange(i+1, 1, 1, 12).setValues([[
        data.id, data.title||'', data.slug||'', data.content||'', data.excerpt||'',
        data.image||'', data.date||'', data.author||'', data.category||'',
        data.published?'TRUE':'FALSE', data.seo_title||'', data.seo_desc||''
      ]]);
      return;
    }
  }
  // New row
  sh.appendRow([
    data.id||('post-'+Date.now()), data.title||'', data.slug||'', data.content||'', data.excerpt||'',
    data.image||'', data.date||formatDate(data.ts), data.author||'PRML Records', data.category||'',
    data.published?'TRUE':'FALSE', data.seo_title||'', data.seo_desc||''
  ]);

  // Auto-add to calendar if publish date set and published
  if (data.published && data.date) {
    try {
      var cal = CalendarApp.getDefaultCalendar();
      cal.createAllDayEvent('Blog Post: '+data.title, new Date(data.date));
    } catch(e) {}
  }
}

function handleDeletePost(ss, data) {
  var sh = ss.getSheetByName('Posts');
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) { sh.deleteRow(i+1); return; }
  }
}

/* ── GOAL ────────────────────────────────────────────────────── */
function handleGoal(ss, data) {
  var sh = getOrCreateSheet(ss, '90DayGoals', [
    'id','goal','category','target','progress','milestones','status','calendar_id'
  ]);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sh.getRange(i+1, 1, 1, 7).setValues([[
        data.id, data.goal||'', data.category||'', data.target||'',
        data.progress||0, data.milestones||'', data.status||'In Progress'
      ]]);
      return;
    }
  }
  sh.appendRow([
    data.id||Date.now(), data.goal||'', data.category||'', data.target||'',
    data.progress||0, data.milestones||'', data.status||'In Progress', ''
  ]);
  // Sync to calendar
  if (data.target) {
    try {
      var cal = CalendarApp.getDefaultCalendar();
      var ev = cal.createAllDayEvent('Goal Due: '+data.goal, new Date(data.target));
      ev.addEmailReminder(7*24*60); // 7 days before
    } catch(e) {}
  }
}

/* ── GRANT ───────────────────────────────────────────────────── */
function handleGrant(ss, data) {
  var sh = getOrCreateSheet(ss, 'Grants', [
    'id','name','funder','deadline','amount','status','notes','next_steps'
  ]);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sh.getRange(i+1, 1, 1, 8).setValues([[
        data.id, data.name||'', data.funder||'', data.deadline||'',
        data.amount||'', data.status||'Not Started', data.notes||'', data.next_steps||''
      ]]);
      return;
    }
  }
  sh.appendRow([
    data.id||Date.now(), data.name||'', data.funder||'', data.deadline||'',
    data.amount||'', data.status||'Not Started', data.notes||'', data.next_steps||''
  ]);
  if (data.deadline) {
    try {
      var cal = CalendarApp.getDefaultCalendar();
      var ev = cal.createAllDayEvent('Grant Deadline: '+data.name, new Date(data.deadline));
      ev.addEmailReminder(14*24*60);
      ev.addEmailReminder(7*24*60);
      ev.addEmailReminder(24*60);
    } catch(e) {}
  }
}

/* ── SOCIAL QUEUE ────────────────────────────────────────────── */
function handleSocialQueue(ss, data) {
  var sh = getOrCreateSheet(ss, 'Social Queue', [
    'Date Added','Platform','Content','Image','Scheduled Date','Status','Post ID'
  ]);
  sh.appendRow([
    formatDate(data.ts), data.platform||'', data.content||'', data.image||'',
    data.date||'', data.status||'Draft', 'post-'+Date.now()
  ]);
}

function handleSocialQuick(ss, data) {
  handleSocialQueue(ss, {...data, status:'Pending AI'});
}

/* ── IPHONE SHORTCUTS WEBHOOK ────────────────────────────────── */
function handleShortcut(ss, data) {
  // Routes based on the shortcut_type field
  switch((data.shortcut_type||'').toUpperCase()) {
    case 'LEAD':      handleInquiry(ss, {...data, source:'iPhone Shortcut'}); break;
    case 'BLOG':      handleBlogDraft(ss, data); break;
    case 'GOAL':      handleGoal(ss, data); break;
    case 'GRANT':     handleGrant(ss, data); break;
    case 'SOCIAL':    handleSocialQueue(ss, data); break;
    default:
      // Log unknown shortcut to a general sheet
      var sh = getOrCreateSheet(ss, 'Shortcut Log', ['Date','Type','Data']);
      sh.appendRow([formatDate(data.ts), data.shortcut_type||'unknown', JSON.stringify(data)]);
  }
  // Return JSON for the shortcut to show
  return {ok:true, message:'Saved at '+formatDate(new Date().toISOString())};
}

function handleBlogDraft(ss, data) {
  handleCreatePost(ss, {
    ...data,
    id: data.id || 'draft-'+Date.now(),
    published: false,
    status: 'Draft',
    author: data.author || 'PRML Records'
  });
}

/* ── INQUIRY (Contact Form) ──────────────────────────────────── */
function handleInquiry(ss, data) {
  var sh = getOrCreateSheet(ss, 'Leads', [
    'Date','Name','Email','Phone','Business','Service','Budget','Timeline','Message','Source','Status'
  ]);
  sh.appendRow([
    formatDate(data.ts||new Date().toISOString()),
    data.name||data.customer_name||'',
    data.email||data.customer_email||'',
    data.phone||'', data.business||'', data.service||'', data.budget||'',
    data.timeline||'', data.message||'',
    data.source||'Website Form', 'New'
  ]);
  MailApp.sendEmail({
    to: ALERT_EMAIL,
    subject: '🔥 New Lead: '+(data.name||'Unknown')+' — '+(data.service||'General'),
    body: 'Name: '+(data.name||'—')+'\nEmail: '+(data.email||'—')+'\nPhone: '+(data.phone||'—')+
          '\nService: '+(data.service||'—')+'\nBudget: '+(data.budget||'—')+
          '\nMessage: '+(data.message||'—')+'\nSource: '+(data.source||'Website')
  });
}

/* ── SUPPORT FORM ────────────────────────────────────────────── */
function handleSupport(ss, data) {
  var sh = getOrCreateSheet(ss, 'Support Tickets', ['Date','Name','Email','Order','Issue','Priority','Status']);
  sh.appendRow([formatDate(data.ts),data.name||'',data.email||'',data.order_number||'',data.issue||'',data.priority||'Normal','Open']);
  MailApp.sendEmail({to:ALERT_EMAIL,subject:'🎫 Support Ticket: '+(data.name||'Unknown'),body:JSON.stringify(data,null,2)});
}

/* ── EMAIL SIGNUP ────────────────────────────────────────────── */
function handleEmailSignup(ss, data) {
  var sh = getOrCreateSheet(ss, 'Email List', ['Date','Email','Source']);
  var existing = sh.getDataRange().getValues().flat().map(String);
  if (!existing.includes(data.email||'')) {
    sh.appendRow([formatDate(data.ts), data.email||'', data.source||'Website']);
  }
}

/* ── ORDER ───────────────────────────────────────────────────── */
function handleOrder(ss, data) {
  var sh = getOrCreateSheet(ss, 'Orders', ['Date','Name','Email','Items','Total','Type','Status']);
  sh.appendRow([formatDate(data.ts),data.customer_name||'',data.customer_email||'',
    data.items||'',data.total||'',data.order_type||'Full','Pending']);
  MailApp.sendEmail({to:ALERT_EMAIL,subject:'🛒 New Order: $'+(data.total||'0')+' — '+(data.customer_name||'Unknown'),body:JSON.stringify(data,null,2)});
}

/* ── INVOICE ─────────────────────────────────────────────────── */
function handleInvoice(ss, data) {
  var sh = getOrCreateSheet(ss, 'Invoices', [
    'Date','Invoice #','Customer','Email','Phone','Business','Items','Subtotal','Stripe Fee','Total','Amount Due','Pay Type','Due Date','Notes','Status'
  ]);
  sh.appendRow([
    formatDate(data.ts), data.invoice_num||'', data.customer_name||'', data.customer_email||'',
    data.customer_phone||'', data.customer_biz||'', data.items||'',
    '$'+(data.subtotal||'0'), '$'+(data.stripe_fee||'6.00'),
    '$'+(data.total||'0'), '$'+(data.amount_due||'0'),
    data.pay_type||'full', data.due_date||'', data.notes||'', 'Sent'
  ]);

  if (data.customer_email && data.invoice_html) {
    try {
      MailApp.sendEmail({
        to: data.customer_email,
        bcc: ALERT_EMAIL,
        subject: 'Invoice '+(data.invoice_num||'')+' from PRML Records LLC — $'+(data.amount_due||data.total||'0'),
        htmlBody: data.invoice_html + (data.stripe_url
          ? '<br><p style="text-align:center"><a href="'+data.stripe_url+'" style="background:#E01010;color:white;padding:14px 28px;font-family:Arial;font-size:14px;text-decoration:none;display:inline-block">Pay Invoice →</a></p>'
          : '<p style="font-family:Arial;font-size:13px;color:#555">To pay: call/text <strong>770-686-7726</strong> or email info@prmlrecords.com</p>'),
        name: 'PRML Records LLC'
      });
    } catch(e) { Logger.log('Invoice email error: '+e); }
  }
  MailApp.sendEmail({to:ALERT_EMAIL,subject:'🧾 Invoice: '+(data.invoice_num||'')+' — '+(data.customer_name||'—')+' — $'+(data.total||'0'),body:JSON.stringify(data,null,2)});
}

/* ── PRODUCT SCANNER ─────────────────────────────────────────── */
function handleProduct(ss, data) {
  var sh = getOrCreateSheet(ss, 'Products', ['Date Added','name','category','price','description','imageurl','active']);
  sh.appendRow([formatDate(data.ts),data.name||'',data.category||'',data.price||'',data.description||'',data.imageurl||'',data.active||'TRUE']);
}

