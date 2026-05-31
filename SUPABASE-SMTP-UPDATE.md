# Supabase SMTP Update

Do this **after** Resend shows `mail.tokenia.live` as **Verified** (green checkmark).

## Steps (1 minute)

1. Go to [Supabase Dashboard](https://supabase.com) → your Tokenia project
2. Click **Authentication** in the left sidebar
3. Click **Settings** tab (or "Email" settings)
4. Scroll to **SMTP Settings** section
5. Update the following fields:

| Field | Current Value | New Value |
|-------|--------------|-----------|
| **SMTP Host** | smtp.resend.com | smtp.resend.com *(no change)* |
| **SMTP Port** | 465 | 465 *(no change)* |
| **SMTP User** | resend | resend *(no change)* |
| **SMTP Password** | (your API key) | re_3A4z2c4k_FerCkBmhS3tmf1nS9cJB7CvX *(no change)* |
| **Sender name** | Tokenia | Tokenia *(no change)* |
| **Sender email** | `info@tokenia.live` | **`noreply@mail.tokenia.live`** ← CHANGE THIS |

6. Click **Save**
7. Send a test email to verify it works

## Why this change?

Supabase uses this email address when sending:
- Email confirmations to new signups
- Password reset emails
- Magic link emails

Using `noreply@mail.tokenia.live` (verified Resend subdomain) ensures these 
emails arrive reliably and don't get flagged as spam.

Users can still reply to `info@tokenia.live` because we set `reply-to` correctly.

## Does this affect info@tokenia.live?

**No.** `info@tokenia.live` continues to work normally in Outlook.
`noreply@mail.tokenia.live` is a separate sending address on a separate subdomain.

---

*Only do this after mail.tokenia.live is Verified in Resend.*
