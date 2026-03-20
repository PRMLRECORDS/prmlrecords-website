# iPhone Shortcuts Webhook Guide
## PRML Records LLC — prmlrecords.com

### Setup
1. Connect your Apps Script URL in `admin/settings.html`
2. Your webhook URL is: `[YOUR_APPS_SCRIPT_URL]` (from Settings page)
3. All shortcuts POST JSON to this URL

---

### Shortcut 1: New Blog Draft (Voice)
**What it does:** Dictate a blog post → saves as draft in your admin

**JSON format to POST:**
```json
{
  "type": "BLOG_DRAFT",
  "shortcut_type": "BLOG",
  "title": "YOUR DICTATED TITLE",
  "content": "YOUR DICTATED CONTENT",
  "category": "News",
  "author": "PRML Records",
  "ts": "2025-01-01T12:00:00Z"
}
```

**Shortcuts app steps:**
1. New Shortcut
2. Add action: Ask for Input → "Post title?"
3. Add action: Dictate Text → "Dictate your post content"
4. Add action: Get Contents of URL
   - URL: [YOUR GAS URL]
   - Method: POST
   - Request Body: JSON (build from variables above)
5. Show Result: "Draft saved!"

---

### Shortcut 2: Quick Lead Capture
**JSON format:**
```json
{
  "type": "SHORTCUT",
  "shortcut_type": "LEAD",
  "name": "Client Name",
  "email": "client@email.com",
  "phone": "404-000-0000",
  "service": "Recording Studio",
  "source": "iPhone Shortcut",
  "ts": "2025-01-01T12:00:00Z"
}
```

---

### Shortcut 3: Add Grant
**JSON format:**
```json
{
  "type": "SHORTCUT",
  "shortcut_type": "GRANT",
  "name": "Grant Name",
  "funder": "Organization",
  "deadline": "2025-07-01",
  "amount": "$5,000",
  "status": "Not Started",
  "ts": "2025-01-01T12:00:00Z"
}
```

---

### Shortcut 4: Queue Social Post
**JSON format:**
```json
{
  "type": "SOCIAL_QUEUE",
  "platform": "ig",
  "content": "Your post content here #hashtag",
  "date": "2025-06-15",
  "status": "Scheduled",
  "ts": "2025-01-01T12:00:00Z"
}
```

---

### Response Format
All successful webhooks return:
```json
{"ok": true, "message": "Saved at 2025-06-01 14:30"}
```

---

### Tips
- Use **Shortcuts automation** to trigger on iPhone tap from home screen
- Add to your Lock Screen for one-tap access
- Use **Ask for Input** action for each field you need
- Use **Dictate Text** for longer content (blog posts)
- Chain shortcuts together for complex workflows
