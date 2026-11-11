// The only place emails leave the system (FR-14, BR-07).
// TEST_MODE=true: every email goes to TEST_EMAIL only, CC/BCC dropped. No screen or job can bypass this.
const nodemailer = require('nodemailer');

let transport;
function getTransport() {
  if (!transport) {
    transport = process.env.SMTP_USER
      ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10000,
      })
      // No SMTP account in .env: build the email but send nothing (handy offline).
      : nodemailer.createTransport({ jsonTransport: true });
    if (!process.env.SMTP_USER) console.warn('SMTP_USER not set: emails are NOT sent, only built (jsonTransport)');
  }
  return transport;
}

// Exposed so tests can see exactly who would receive the email.
function applyTestMode({ to, cc, bcc }) {
  if (process.env.TEST_MODE === 'false') return { to, cc, bcc };
  return { to: process.env.TEST_EMAIL || 'team-inbox@test.com', cc: undefined, bcc: undefined };
}

async function sendMail({ to, cc, bcc, subject, html, attachments }) {
  const addresses = applyTestMode({ to, cc, bcc });
  return getTransport().sendMail({
    from: process.env.MAIL_FROM || 'Notification Engine <noreply@test.com>',
    ...addresses,
    subject,
    html,
    attachments,
  });
}

module.exports = { sendMail, applyTestMode };
