# Tokenia Roadmap

## Current: v8.0 (May 2026) ✅
- Free forever — no pricing plans
- 30+ models across 6 providers
- Token Visualizer (unique)
- Prompt Optimizer (unique)
- Side-by-side model comparison (unique)
- Monthly cost projection calculator (unique)
- Public API /api/v1/count (rate-limited, no auth)
- Internal analytics (privacy-first JSONL logs)
- Admin dashboard /admin/stats
- Internal heartbeat monitoring with email alerts
- Dark mode (system-detected + toggle)
- Keyboard shortcuts
- Onboarding tour
- 5 languages: EN, ES, PT, ZH, DE
- Blog with 15 SEO posts
- PWA (installable, offline support)
- OG image, OpenAPI spec, Postman collection
- Email templates (Resend)

## Next: v8.1 (June 2026)
- [ ] Activate Cloudflare CDN (see SETUP-CLOUDFLARE.md)
- [ ] Activate Plausible analytics (see SETUP-PLAUSIBLE.md)
- [ ] Set RESEND_AUDIENCE_ID in Railway env vars
- [ ] Set ADMIN_PASSWORD in Railway env vars
- [ ] Add Search Console verification (google/bing)
- [ ] Submit sitemap to Google Search Console
- [ ] Write 5 more blog posts in ZH and DE
- [ ] Browser extension (Chrome + Firefox) MVP

## v9.0 (Q3 2026)
- [ ] User accounts: save analysis history (Supabase, optional)
- [ ] Shareable analysis URLs (/share/XXXXX) with pre-filled state
- [ ] Dynamic OG images per analysis (/api/og?text=X)
- [ ] Token budget calculator (set a budget, see how many requests you can make)
- [ ] Team workspaces (shared history)
- [ ] Webhook notifications when prices change
- [ ] SDK: npm install @tokenia/sdk

## v10.0 (Q4 2026)
- [ ] Real-time pricing alerts via email/Slack
- [ ] Cost anomaly detection (usage spike alerts)
- [ ] Batch analysis API (process multiple texts at once)
- [ ] Chrome extension: select text → instant token count
- [ ] VS Code extension: token count in status bar
- [ ] API: exact tiktoken counts for Anthropic models
- [ ] Mobile apps (React Native)

## Metrics targets (end of 2026)
- 10,000+ unique visitors/month
- 1,000+ newsletter subscribers  
- 50+ inbound links from developer blogs
- 4.9/5.0 Lighthouse score
- Featured in at least 3 "best AI tools" roundup articles

## Contributing
Email info@tokenia.live with feature requests or bug reports.
