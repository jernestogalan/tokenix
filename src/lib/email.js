/**
 * Tokenia — src/lib/email.js
 * Email sending via Resend (https://resend.com)
 * Requires RESEND_API_KEY env var.
 */
'use strict';

let resendClient = null;

function getResend() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) return null;
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  } catch {
    console.warn('[email] resend package not installed — run: npm install resend');
    return null;
  }
}

/**
 * Send a contact-form email to support@tokenia.live
 */
async function sendContactEmail(name, email, message) {
  const resend = getResend();
  if (!resend) {
    // Graceful fallback: log to console when Resend not configured
    console.log(`[contact] From: ${name} <${email}>\n${message}`);
    return { success: true, fallback: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from:    'Tokenia Contact <support@tokenia.live>',
      to:      ['support@tokenia.live'],
      replyTo: email,
      subject: `Contact from ${name} — tokenia.live`,
      html: `
        <h2 style="color:#FF6B2C">New Contact Form Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        <hr style="border:1px solid #eee;margin:16px 0">
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
    });
    if (error) throw new Error(error.message);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[email] sendContactEmail failed:', err.message);
    return { success: false, error: err.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendContactEmail };
