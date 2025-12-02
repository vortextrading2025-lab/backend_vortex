const Brevo = require('@getbrevo/brevo');

class EmailService {
  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.enabled = false;
      console.warn('[EmailService] BREVO_API_KEY not set. Emails are disabled.');
      console.warn('[EmailService] Please set BREVO_API_KEY in your .env file to enable email sending.');
      this.sender = null;
      this.client = null;
      return;
    }

    this.enabled = true;
    this.sender = {
      email: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com',
      name: process.env.BREVO_SENDER_NAME || 'App'
    };

    console.log('[EmailService] Initialized with sender:', this.sender.email);
    
    try {
      this.client = new Brevo.TransactionalEmailsApi();
      this.client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
      console.log('[EmailService] Brevo client initialized successfully');
    } catch (error) {
      console.error('[EmailService] Failed to initialize Brevo client:', error.message);
      this.enabled = false;
      return;
    }

    this.verificationTemplateId = Number(process.env.BREVO_VERIFICATION_TEMPLATE_ID || 0);
    this.genericTemplateId = Number(process.env.BREVO_GENERIC_TEMPLATE_ID || 0);
    
    if (this.verificationTemplateId > 0) {
      console.log('[EmailService] Verification template ID:', this.verificationTemplateId);
    }
  }

  async send({ to, subject, htmlContent, params = {} }) {
    if (!this.enabled) {
      console.warn('[EmailService] Email service is disabled. BREVO_API_KEY not set.');
      return { sent: false, reason: 'Email disabled - BREVO_API_KEY not set' };
    }

    const sendSmtpEmail = {
      sender: this.sender,
      to: Array.isArray(to) ? to : [{ email: to }],
      subject,
      htmlContent,
      params
    };

    try {
      console.log('[EmailService] Sending email to:', to);
      console.log('[EmailService] Sender:', this.sender);
      const result = await this.client.sendTransacEmail(sendSmtpEmail);
      console.log('[EmailService] Email sent successfully. Message ID:', result.messageId);
      return { sent: true, result };
    } catch (error) {
      console.error('[EmailService] send error:', error.message);
      console.error('[EmailService] Error details:', error.response?.body || error);
      return { sent: false, error: error.message, details: error.response?.body };
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

  async sendWelcomeEmail({ to, firstName, verificationUrl }) {
    console.log('[EmailService] sendWelcomeEmail called for:', to);
    const welcomeTemplateId = Number(process.env.BREVO_WELCOME_TEMPLATE_ID || 0);
    
    if (welcomeTemplateId > 0) {
      console.log('[EmailService] Using template ID:', welcomeTemplateId);
      return this.sendWithTemplate({
        to,
        templateId: welcomeTemplateId,
        params: { firstName, verificationUrl }
      });
    }
    
    console.log('[EmailService] Using HTML email (no template)');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our Platform! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName || 'there'},</p>
            <p>Thank you for registering with us! We're excited to have you on board.</p>
            <p>To get started, please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p>If you didn't create an account, please ignore this email.</p>
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({ 
      to, 
      subject: 'Welcome! Please verify your email', 
      htmlContent: html 
    });
  }
}

module.exports = new EmailService();

