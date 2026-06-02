# Tokenia Launch Kit

> All files are **drafts only**. Review, personalize, and post manually.
> Do NOT automate any posting. Do NOT create accounts or accept terms on my behalf.

---

## Files

| File | Platform | Status |
|------|----------|--------|
| `product-hunt.md` | Product Hunt | Draft |
| `hacker-news.md` | Hacker News (Show HN) | Draft |
| `reddit.md` | r/SideProject, r/LocalLLaMA, r/OpenAI | Draft |
| `devto-article.md` | dev.to / Hashnode | Draft |
| `social-posts.md` | X (Twitter) × 3, LinkedIn × 1 | Draft |

---

## Your action checklist before launch

### Accounts (you must create/own these)
- [ ] Product Hunt account — create at producthunt.com if you don't have one
- [ ] dev.to account — devto.to/enter
- [ ] Hashnode (optional alternative to dev.to)
- [ ] X/Twitter account if you don't have one linked to Tokenia

### Assets needed
- [ ] Screenshot of the analyzer results (multiple models side by side) — for all posts
- [ ] Short screen recording (15–30 sec) — great for X/LinkedIn engagement
- [ ] og-image.png is already at tokenia.live/og-image.png — use for PH gallery

### Technical before launch
- [ ] Set `RESEND_AUDIENCE_ID` in Railway env vars (for newsletter → Resend Audiences)
- [ ] Rotate Resend API key (old one was in git history — get new one from Resend dashboard)
- [ ] Run `git push origin main` to deploy all Fase A + B1 changes
- [ ] Smoke test: paste text → get results → upload a PDF → check privacy page loads at /privacy

### Sequencing (recommended)
1. Deploy to production first (git push)
2. Smoke test live site
3. Post dev.to article (builds credibility before PH launch)
4. Post Show HN (good for technical audience feedback)
5. Post reddit r/SideProject
6. Product Hunt launch (needs more prep — gallery images, scheduling)
7. Reddit r/LocalLLaMA and r/OpenAI as follow-up
8. X posts (space 2–3 days apart)
9. LinkedIn

---

## Key messaging pillars (use these, don't improvise numbers)

✅ True and usable:
- "30+ models" — countable in the code
- "Official tokenizers (tiktoken)" — verified
- "5 languages (EN/ES/PT/ZH/DE)" — verified
- "Text never stored" — verified in code
- "No signup required" — true
- "Free, no plans to paywall core features" — your commitment
- "No Google Analytics, no ad trackers" — verified
- "HTTPS enforced, hardened security headers" — verified

❌ Do NOT use:
- "trusted by X developers in Y countries" — you don't have this data yet
- "100% in your browser" — not accurate (server-side tokenization)
- "1,200+ users" or any user count — not real yet
- "99.9% uptime" — not monitored yet
- GDPR Compliant / CCPA Compliant — no legal basis yet

---

## What you need to do that Claude cannot do for you

- Create accounts on Product Hunt, Reddit, dev.to
- Accept terms of service on any platform
- Actually publish any of these posts
- Schedule the Product Hunt launch
- Post to X/LinkedIn from your personal account
