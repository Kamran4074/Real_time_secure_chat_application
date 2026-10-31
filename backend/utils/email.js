import logger from "./logger.js";

// Transactional email through Brevo's HTTP API (works on hosts that block SMTP ports, e.g. Render free).
// Needs BREVO_API_KEY and EMAIL_FROM (a sender verified in Brevo -> Senders, Domains & Dedicated IPs).
// Without them (local dev, tests) nothing is sent and the email is only logged in development.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const isEmailEnabled = ()=> Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);

export const sendEmail = async({to, subject, html, text})=>{
    if(!isEmailEnabled()){
        // dev convenience: the reset link shows up in the server log instead of an inbox
        if(process.env.NODE_ENV !== 'production') logger.info('Email not sent (BREVO_API_KEY not set)', {subject, text});
        else logger.error('Email not sent: BREVO_API_KEY / EMAIL_FROM missing', {subject});
        return false;
    }

    const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            sender: {email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || 'ChatWave'},
            to: [{email: to}],
            subject,
            htmlContent: html,
            textContent: text
        }),
        signal: AbortSignal.timeout(10000)
    });
    if(!res.ok){
        // Brevo's body explains the problem (bad key, unverified sender, ...); it never contains the key
        throw new Error(`Brevo responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return true;
};

const escapeHtml = (s)=> String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

export const passwordResetEmail = ({name, link, minutes})=> ({
    subject: 'Reset your ChatWave password',
    text: `Hi ${name},\n\nUse this link to set a new password (valid for ${minutes} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a">
  <h2 style="color:#4f46e5">Reset your password</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>We got a request to reset your ChatWave password. This link is valid for ${minutes} minutes and can be used once.</p>
  <p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Set a new password</a></p>
  <p style="font-size:13px;color:#64748b">If the button doesn't work, open this link:<br>${escapeHtml(link)}</p>
  <p style="font-size:13px;color:#64748b">If you didn't ask for this, ignore this email. Your password stays the same.</p>
</div>`
});
