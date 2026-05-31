# Plausible Analytics Setup for Tokenia

Plausible is a privacy-friendly analytics tool that doesn't use cookies and is GDPR-compliant. 
This aligns perfectly with Tokenia's "No Tracking" promise.

## Option A: Plausible.io (Hosted, $9/month after trial)

### Setup steps:
1. Go to [plausible.io](https://plausible.io) → Start free trial
2. Add site: `tokenia.live`
3. Copy the script tag they provide:
```html
<script defer data-domain="tokenia.live" src="https://plausible.io/js/script.js"></script>
```
4. Add it to the `<head>` of `public/index.html` and other pages

### Custom events (add to app.js):
```js
// Track key actions WITHOUT content
function track(event, props) {
  if (typeof plausible === 'function') plausible(event, { props });
}

// In analyzeTokens():
track('Analyze', { provider: _activeProvider });

// In language switch:
track('Language Switch', { lang: newLang });

// In export buttons:
track('Export', { format: 'csv' }); // or 'markdown'

// In newsletter form:
track('Newsletter Subscribe');
```

### What gets tracked (privacy-safe):
- Page views (no personal data)
- "Analyze" event count
- Language switch counts
- Export button clicks
- Newsletter signups

### What is NOT tracked:
- Any text content analyzed
- User identity
- IP addresses (hashed, not stored)
- Cookies

---

## Option B: Umami (Self-hosted, FREE)

### Deploy Umami on Railway (free):
1. Go to [umami.is](https://umami.is) → Docs → Self-hosting
2. Fork: `https://github.com/umami-software/umami`
3. Deploy to Railway (PostgreSQL addon needed):
   ```
   railway init
   railway add postgresql
   railway up
   ```
4. Set env vars: `DATABASE_URL`, `HASH_SALT`
5. Add tracking script to Tokenia's HTML

### Cost: Free (Railway free tier = 500 hours/month)

---

## Recommendation

Start with Plausible's 30-day free trial. If traffic is low (<10K page views/month), 
self-host Umami on Railway free tier instead.
