# Uptime Monitoring Setup for Tokenia

Monitor tokenia.live 24/7 with free alerts when the site goes down.

## Option A: BetterStack (Recommended, Free tier available)

### Setup:
1. Go to [betterstack.com](https://betterstack.com) → Create free account
2. **Monitors → New Monitor**:
   - URL: `https://tokenia.live`
   - Check interval: **3 minutes** (free) or **1 minute** (paid)
   - Expected status: `200`
   - Alert via: Email to `info@tokenia.live`
3. **Also monitor the API**:
   - URL: `https://tokenia.live/api/health`
   - Expected: `{"ok":true}`
4. **Status page** (optional): Create a public status page at `status.betterstack.com/tokenia`

### Free tier includes:
- 10 monitors
- 3-minute check interval
- Email + Slack alerts
- 90-day history

---

## Option B: UptimeRobot (Free, widely used)

### Setup:
1. Go to [uptimerobot.com](https://uptimerobot.com) → Create free account
2. **Add New Monitor**:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Tokenia Production`
   - URL: `https://tokenia.live`
   - Monitoring Interval: **5 minutes**
3. Add alert contact: your email
4. Repeat for `https://tokenia.live/api/health`

### Free tier:
- 50 monitors
- 5-minute intervals
- Email alerts
- Public status page

---

## Option C: Cloudflare Health Checks (Free if using Cloudflare)

If you set up Cloudflare (see SETUP-CLOUDFLARE.md), you can use:
- **Health Checks → Create** → HTTP check on `tokenia.live`
- Alerts via email when Railway goes down

---

## Recommended monitoring checklist

| Endpoint | Check | Alert threshold |
|----------|-------|-----------------|
| `https://tokenia.live` | HTTP 200 | 2 consecutive failures |
| `https://tokenia.live/api/health` | JSON `ok:true` | 1 failure |
| `https://tokenia.live/api/v1/count` | POST, HTTP 200 | 3 consecutive failures |

## Response time targets
- Homepage: < 500ms
- API `/api/v1/count`: < 200ms
- If response time > 2s: investigate Railway scaling
