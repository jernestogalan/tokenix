# Cloudflare Setup Guide for Tokenia

Setting up Cloudflare gives you a global CDN, automatic HTTPS, Brotli compression, and HTTP/3 — all free.

## Steps

### 1. Create free Cloudflare account
Go to [cloudflare.com](https://cloudflare.com) → Sign Up → Free plan.

### 2. Add your domain
- Click **Add a site** → enter `tokenia.live` → select **Free plan**
- Cloudflare will scan your existing DNS records (from Namecheap or your registrar)

### 3. Update nameservers at your registrar
Cloudflare will give you two nameservers like:
```
aria.ns.cloudflare.com
bob.ns.cloudflare.com
```
Go to **Namecheap → Domain → Custom DNS** → paste both nameservers → Save.
DNS propagation takes 5–30 minutes.

### 4. Configure SSL/TLS
**SSL/TLS → Overview** → set mode to **Full (strict)**

### 5. Enable performance features
Under **Speed → Optimization**:
- ✅ Auto Minify: HTML, CSS, JavaScript
- ✅ Brotli compression
- ✅ HTTP/3 (QUIC) — under **Network**
- ✅ Early Hints

### 6. Configure caching
Under **Caching → Configuration**:
- Browser Cache TTL: **4 hours** (HTML) or **1 year** (assets with version query params)

**Page Rules** (optional, free plan = 3 rules):
```
tokenia.live/css/*   → Cache Level: Cache Everything, Edge TTL: 1 month
tokenia.live/js/*    → Cache Level: Cache Everything, Edge TTL: 1 month
tokenia.live/*.html  → Cache Level: Standard, Edge TTL: 5 minutes
```

### 7. Security settings
Under **Security → Settings**:
- Security Level: **Medium**
- Bot Fight Mode: **On**

### 8. Verify
After setup, run:
```bash
curl -I https://tokenia.live
# Look for: cf-ray header (confirms Cloudflare is active)
# Look for: content-encoding: br (Brotli active)
```

## Expected performance improvement
- TTFB: 50–150ms globally (vs 300–600ms from single Railway region)
- Lighthouse Performance: 95+ (from ~85)
- CDN cached requests: free, unlimited

## Notes
- Railway origin remains `tokenia.live.up.railway.app` — Cloudflare proxies requests
- Websockets work through Cloudflare on free plan
- Analytics (Cloudflare Web Analytics) is free and privacy-friendly — no cookies
