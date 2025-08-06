const { query } = require('../config/database');
const { ValidationError, NotFoundError, DatabaseError } = require('../middleware/errorHandler');

class CommunicationService {
  // Email service integration
  static async sendEmail(to, subject, content, options = {}) {
    try {
      // Here you would integrate with email service (SendGrid, AWS SES, etc.)
      console.log(`Sending email to ${to}: ${subject}`);
      
      // Log email activity
      await query(`
        INSERT INTO communication_logs (
          school_id, type, recipient, subject, content, status, created_at
        ) VALUES ($1, 'email', $2, $3, $4, 'sent', NOW())
      `, [options.schoolId, to, subject, content]);

      return { success: true, messageId: `email_${Date.now()}` };
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new DatabaseError('Failed to send email');
    }
  }

  // SMS service integration
  static async sendSMS(to, message, options = {}) {
    try {
      // Here you would integrate with SMS service (Twilio, Africa's Talking, etc.)
      console.log(`Sending SMS to ${to}: ${message}`);
      
      // Log SMS activity
      await query(`
        INSERT INTO communication_logs (
          school_id, type, recipient, content, status, created_at
        ) VALUES ($1, 'sms', $2, $3, 'sent', NOW())
      `, [options.schoolId, to, message]);

      return { success: true, messageId: `sms_${Date.now()}` };
    } catch (error) {
      console.error('SMS sending failed:', error);
      throw new DatabaseError('Failed to send SMS');
    }
  }

  // Push notification service
  static async sendPushNotification(to, title, body, options = {}) {
    try {
      // Here you would integrate with push notification service (Firebase, OneSignal, etc.)
      console.log(`Sending push notification to ${to}: ${title}`);
      
      // Log push notification activity
      await query(`
        INSERT INTO communication_logs (
          school_id, type, recipient, subject, content, status, created_at
        ) VALUES ($1, 'push', $2, $3, $4, 'sent', NOW())
      `, [options.schoolId, to, title, body]);

      return { success: true, messageId: `push_${Date.now()}` };
    } catch (error) {
      console.error('Push notification sending failed:', error);
      throw new DatabaseError('Failed to send push notification');
    }
  }

  // Template management
  static async createTemplate(templateData, userId) {
    try {
      const result = await query(`
        INSERT INTO communication_templates (
          school_id, name, type, subject, content, variables,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `, [
        templateData.schoolId,
        templateData.name,
        templateData.type,
        templateData.subject,
        templateData.content,
        JSON.stringify(templateData.variables || []),
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create communication template');
    }
  }

  static async getTemplates(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          ct.*,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM communication_templates ct
        JOIN users u ON ct.created_by = u.id
        WHERE ct.school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      if (filters.type) {
        paramCount++;
        sql += ` AND ct.type = $${paramCount}`;
        params.push(filters.type);
      }

      if (filters.name) {
        paramCount++;
        sql += ` AND ct.name ILIKE $${paramCount}`;
        params.push(`%${filters.name}%`);
      }

      sql += ` ORDER BY ct.created_at DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get communication templates');
    }
  }

  static async updateTemplate(id, updateData, userId) {
    try {
      const result = await query(`
        UPDATE communication_templates 
        SET 
          name = COALESCE($2, name),
          type = COALESCE($3, type),
          subject = COALESCE($4, subject),
          content = COALESCE($5, content),
          variables = COALESCE($6, variables),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        id,
        updateData.name,
        updateData.type,
        updateData.subject,
        updateData.content,
        updateData.variables ? JSON.stringify(updateData.variables) : null
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Template not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update communication template');
    }
  }

  static async deleteTemplate(id, userId) {
    try {
      const result = await query(`
        DELETE FROM communication_templates 
        WHERE id = $1
        RETURNING id
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Template not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to delete communication template');
    }
  }

  // Message threading
  static async createMessageThread(participants, schoolId, userId) {
    try {
      const result = await query(`
        INSERT INTO message_threads (
          school_id, created_by, created_at
        ) VALUES ($1, $2, NOW())
        RETURNING *
      `, [schoolId, userId]);

      const thread = result.rows[0];

      // Add participants
      const participantPromises = participants.map(participantId =>
        query(`
          INSERT INTO thread_participants (
            thread_id, user_id, joined_at
          ) VALUES ($1, $2, NOW())
        `, [thread.id, participantId])
      );

      await Promise.all(participantPromises);

      return thread;
    } catch (error) {
      throw new DatabaseError('Failed to create message thread');
    }
  }

  static async getMessageThreads(userId, schoolId) {
    try {
      const result = await query(`
        SELECT 
          mt.*,
          COUNT(m.id) as message_count,
          MAX(m.created_at) as last_message_at
        FROM message_threads mt
        JOIN thread_participants tp ON mt.id = tp.thread_id
        LEFT JOIN messages m ON mt.id = m.thread_id
        WHERE tp.user_id = $1 AND mt.school_id = $2
        GROUP BY mt.id
        ORDER BY last_message_at DESC
      `, [userId, schoolId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get message threads');
    }
  }

  // Automated reminders
  static async scheduleReminder(reminderData, userId) {
    try {
      const result = await query(`
        INSERT INTO scheduled_communications (
          school_id, type, title, content, recipients,
          scheduled_for, frequency, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `, [
        reminderData.schoolId,
        reminderData.type,
        reminderData.title,
        reminderData.content,
        JSON.stringify(reminderData.recipients),
        reminderData.scheduledFor,
        reminderData.frequency,
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to schedule reminder');
    }
  }

  static async getScheduledCommunications(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT * FROM scheduled_communications 
        WHERE school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      if (filters.type) {
        paramCount++;
        sql += ` AND type = $${paramCount}`;
        params.push(filters.type);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      sql += ` ORDER BY scheduled_for ASC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get scheduled communications');
    }
  }

  // Communication analytics
  static async getCommunicationStats(schoolId, filters = {}) {
    try {
      const result = await query(`
        SELECT 
          type,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          DATE(created_at) as date
        FROM communication_logs
        WHERE school_id = $1
        AND created_at >= COALESCE($2, DATE_TRUNC('month', CURRENT_DATE))
        AND created_at <= COALESCE($3, CURRENT_DATE + INTERVAL '1 day')
        GROUP BY type, DATE(created_at)
        ORDER BY date DESC, type
      `, [schoolId, filters.startDate, filters.endDate]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get communication statistics');
    }
  }

  // Parent communication tracking
  static async getParentCommunications(studentId, filters = {}) {
    try {
      const result = await query(`
        SELECT 
          cl.*,
          s.first_name || ' ' || s.last_name as student_name
        FROM communication_logs cl
        JOIN students s ON cl.student_id = s.id
        WHERE cl.student_id = $1
        AND cl.created_at >= COALESCE($2, DATE_TRUNC('month', CURRENT_DATE))
        AND cl.created_at <= COALESCE($3, CURRENT_DATE + INTERVAL '1 day')
        ORDER BY cl.created_at DESC
      `, [studentId, filters.startDate, filters.endDate]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get parent communications');
    }
  }

  // Bulk messaging
  static async sendBulkMessage(messageData, recipients, userId) {
    try {
      const results = [];
      const errors = [];

      for (const recipient of recipients) {
        try {
          let result;
          
          switch (messageData.type) {
            case 'email':
              result = await this.sendEmail(
                recipient.email,
                messageData.subject,
                messageData.content,
                { schoolId: messageData.schoolId }
              );
              break;
            case 'sms':
              result = await this.sendSMS(
                recipient.phoneNumber,
                messageData.content,
                { schoolId: messageData.schoolId }
              );
              break;
            case 'push':
              result = await this.sendPushNotification(
                recipient.id,
                messageData.subject,
                messageData.content,
                { schoolId: messageData.schoolId }
              );
              break;
            default:
              throw new ValidationError('Invalid message type');
          }

          results.push({ recipient: recipient.id, result });
        } catch (error) {
          errors.push({ recipient: recipient.id, error: error.message });
        }
      }

      return {
        success: results,
        errors: errors,
        totalSent: results.length,
        totalFailed: errors.length
      };
    } catch (error) {
      throw new DatabaseError('Failed to send bulk messages');
    }
  }
}

module.exports = CommunicationService;