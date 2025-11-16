const Brevo = require('@getbrevo/brevo');

class EmailService {
  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.enabled = false;
      console.warn('[EmailService] BREVO_API_KEY not set. Emails are disabled.');
      return;
    }

    this.enabled = true;
    this.sender = {
      email: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com',
      name: process.env.BREVO_SENDER_NAME || 'App'
    };

    this.client = new Brevo.TransactionalEmailsApi();
    this.client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    this.verificationTemplateId = Number(process.env.BREVO_VERIFICATION_TEMPLATE_ID || 0);
    this.genericTemplateId = Number(process.env.BREVO_GENERIC_TEMPLATE_ID || 0);
  }

  async send({ to, subject, htmlContent, params = {} }) {
    if (!this.enabled) return { sent: false, reason: 'Email disabled' };

    const sendSmtpEmail = {
      sender: this.sender,
      to: Array.isArray(to) ? to : [{ email: to }],
      subject,
      htmlContent,
      params
    };

    try {
      const result = await this.client.sendTransacEmail(sendSmtpEmail);
      return { sent: true, result };
    } catch (error) {
      console.error('[EmailService] send error:', error.message);
      return { sent: false, error: error.message };
    }
  }

  async sendWithTemplate({ to, templateId, params = {} }) {
    if (!this.enabled) return { sent: false, reason: 'Email disabled' };

    const sendSmtpEmail = {
      sender: this.sender,
      to: Array.isArray(to) ? to : [{ email: to }],
      templateId,
      params
    };

    try {
      const result = await this.client.sendTransacEmail(sendSmtpEmail);
      return { sent: true, result };
    } catch (error) {
      console.error('[EmailService] sendWithTemplate error:', error.message);
      return { sent: false, error: error.message };
    }
  }

  async sendVerificationEmail({ to, verificationUrl, firstName }) {
    if (this.verificationTemplateId > 0) {
      return this.sendWithTemplate({
        to,
        templateId: this.verificationTemplateId,
        params: { verificationUrl, firstName }
      });
    }

    const html = `
      <p>Hi ${firstName || ''},</p>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>If you did not create an account, please ignore this email.</p>
    `;

    return this.send({ to, subject: 'Verify your email', htmlContent: html });
  }
}

module.exports = new EmailService();

