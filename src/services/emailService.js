const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Configure email transporter based on environment
      if (process.env.NODE_ENV === 'production') {
        // Production email configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        // Development email configuration (using Ethereal for testing)
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
            user: 'ethereal.user@ethereal.email',
            pass: 'ethereal.pass'
          }
        });
      }
    } catch (error) {
      console.error('Error initializing email transporter:', error);
      this.transporter = null;
    }
  }

  async sendEmail(emailData) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not configured');
      }

      const {
        to,
        subject,
        text,
        html,
        from = process.env.FROM_EMAIL || 'noreply@edufam.com',
        attachments = []
      } = emailData;

      if (!to || !subject || (!text && !html)) {
        throw new Error('Missing required email fields: to, subject, and text/html');
      }

      const mailOptions = {
        from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendBulkEmail(emailList) {
    try {
      const results = [];
      const errors = [];

      for (const emailData of emailList) {
        try {
          const result = await this.sendEmail(emailData);
          results.push(result);
        } catch (error) {
          errors.push({
            email: emailData.to,
            error: error.message
          });
        }
      }

      return {
        success: true,
        sent: results.length,
        failed: errors.length,
        results,
        errors
      };
    } catch (error) {
      console.error('Error sending bulk email:', error);
      throw error;
    }
  }

  async sendInvoiceEmail(invoiceData, studentData) {
    try {
      const { invoice, student } = invoiceData;
      
      const subject = `Invoice ${invoice.invoice_number} - ${invoice.fee_name}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .invoice-details { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice Notification</h1>
            </div>
            <div class="content">
              <p>Dear ${student.first_name} ${student.last_name},</p>
              <p>Please find below the details of your invoice:</p>
              
              <div class="invoice-details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                <p><strong>Fee Name:</strong> ${invoice.fee_name}</p>
                <p><strong>Amount:</strong> $${invoice.amount}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
                ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
              </div>
              
              <p>Please ensure payment is made by the due date to avoid any late fees.</p>
              
              <p>If you have any questions, please contact our finance department.</p>
              
              <p>Thank you for your prompt payment.</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
        Dear ${student.first_name} ${student.last_name},
        
        Please find below the details of your invoice:
        
        Invoice Number: ${invoice.invoice_number}
        Fee Name: ${invoice.fee_name}
        Amount: $${invoice.amount}
        Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
        ${invoice.notes ? `Notes: ${invoice.notes}` : ''}
        
        Please ensure payment is made by the due date to avoid any late fees.
        
        If you have any questions, please contact our finance department.
        
        Thank you for your prompt payment.
      `;

      return await this.sendEmail({
        to: student.email,
        subject,
        text,
        html
      });
    } catch (error) {
      console.error('Error sending invoice email:', error);
      throw error;
    }
  }

  async sendPaymentConfirmationEmail(paymentData, studentData) {
    try {
      const { payment, student } = paymentData;
      
      const subject = `Payment Confirmation - ${payment.payment_reference}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .payment-details { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Confirmation</h1>
            </div>
            <div class="content">
              <p>Dear ${student.first_name} ${student.last_name},</p>
              <p>We have received your payment. Thank you!</p>
              
              <div class="payment-details">
                <h3>Payment Details</h3>
                <p><strong>Payment Reference:</strong> ${payment.payment_reference}</p>
                <p><strong>Amount Paid:</strong> $${payment.amount}</p>
                <p><strong>Payment Method:</strong> ${payment.payment_method}</p>
                <p><strong>Payment Date:</strong> ${new Date(payment.payment_date).toLocaleDateString()}</p>
                ${payment.notes ? `<p><strong>Notes:</strong> ${payment.notes}</p>` : ''}
              </div>
              
              <p>Your payment has been successfully processed and recorded in our system.</p>
              
              <p>If you have any questions, please contact our finance department.</p>
              
              <p>Thank you for your payment!</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
        Dear ${student.first_name} ${student.last_name},
        
        We have received your payment. Thank you!
        
        Payment Reference: ${payment.payment_reference}
        Amount Paid: $${payment.amount}
        Payment Method: ${payment.payment_method}
        Payment Date: ${new Date(payment.payment_date).toLocaleDateString()}
        ${payment.notes ? `Notes: ${payment.notes}` : ''}
        
        Your payment has been successfully processed and recorded in our system.
        
        If you have any questions, please contact our finance department.
        
        Thank you for your payment!
      `;

      return await this.sendEmail({
        to: student.email,
        subject,
        text,
        html
      });
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  async sendFeeReminderEmail(feeData, studentData) {
    try {
      const { fee, student } = feeData;
      
      const subject = `Fee Reminder - ${fee.fee_name}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Fee Reminder</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ffc107; color: #333; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .fee-details { background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .urgent { color: #dc3545; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Fee Reminder</h1>
            </div>
            <div class="content">
              <p>Dear ${student.first_name} ${student.last_name},</p>
              <p>This is a friendly reminder about your outstanding fee payment.</p>
              
              <div class="fee-details">
                <h3>Fee Details</h3>
                <p><strong>Fee Name:</strong> ${fee.fee_name}</p>
                <p><strong>Amount Due:</strong> $${fee.amount}</p>
                <p><strong>Amount Paid:</strong> $${fee.amount_paid || 0}</p>
                <p><strong>Outstanding Amount:</strong> $${fee.amount - (fee.amount_paid || 0)}</p>
                <p><strong>Due Date:</strong> ${new Date(fee.due_date).toLocaleDateString()}</p>
                ${new Date(fee.due_date) < new Date() ? '<p class="urgent">⚠️ This fee is overdue!</p>' : ''}
              </div>
              
              <p>Please make payment as soon as possible to avoid any late fees or penalties.</p>
              
              <p>If you have already made payment, please ignore this reminder.</p>
              
              <p>If you have any questions, please contact our finance department.</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
        Dear ${student.first_name} ${student.last_name},
        
        This is a friendly reminder about your outstanding fee payment.
        
        Fee Name: ${fee.fee_name}
        Amount Due: $${fee.amount}
        Amount Paid: $${fee.amount_paid || 0}
        Outstanding Amount: $${fee.amount - (fee.amount_paid || 0)}
        Due Date: ${new Date(fee.due_date).toLocaleDateString()}
        ${new Date(fee.due_date) < new Date() ? '⚠️ This fee is overdue!' : ''}
        
        Please make payment as soon as possible to avoid any late fees or penalties.
        
        If you have already made payment, please ignore this reminder.
        
        If you have any questions, please contact our finance department.
      `;

      return await this.sendEmail({
        to: student.email,
        subject,
        text,
        html
      });
    } catch (error) {
      console.error('Error sending fee reminder email:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email service not configured');
      }

      await this.transporter.verify();
      return { success: true, message: 'Email service connection successful' };
    } catch (error) {
      console.error('Email service connection failed:', error);
      return { success: false, message: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

// Export both the class and instance
module.exports = emailService;
module.exports.EmailService = EmailService;
module.exports.sendEmail = emailService.sendEmail.bind(emailService);
module.exports.sendBulkEmail = emailService.sendBulkEmail.bind(emailService);
module.exports.sendInvoiceEmail = emailService.sendInvoiceEmail.bind(emailService);
module.exports.sendPaymentConfirmationEmail = emailService.sendPaymentConfirmationEmail.bind(emailService);
module.exports.sendFeeReminderEmail = emailService.sendFeeReminderEmail.bind(emailService);
module.exports.testConnection = emailService.testConnection.bind(emailService);
