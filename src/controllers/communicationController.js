const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');
const { query } = require('../config/database');

class CommunicationController {
  // List eligible messaging users for the current school (exclude directors)
  static async getMessagingUsers(req, res, next) {
    try {
      const result = await query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.role
        FROM users u
        WHERE u.school_id = $1
          AND u.role IN ('principal','teacher','hr','finance','parent')
          AND COALESCE(u.is_active, true) = true
        ORDER BY u.first_name, u.last_name
      `, [req.user.schoolId || req.user.school_id]);

      // Optionally filter out the requester from recipients list on frontend, but keep all here
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
  // Conversations API (threads)
  static async getConversations(req, res, next) {
    try {
      const result = await query(`
        SELECT mt.id, mt.title, mt.type, mt.created_at,
               ARRAY_AGG(u.first_name || ' ' || u.last_name ORDER BY u.first_name) AS participants
        FROM message_threads mt
        JOIN thread_participants tp ON mt.id = tp.thread_id
        JOIN users u ON tp.user_id = u.id
        WHERE mt.school_id = $1 AND tp.user_id = $2 AND (tp.left_at IS NULL)
        GROUP BY mt.id
        ORDER BY mt.updated_at DESC NULLS LAST, mt.created_at DESC
        LIMIT 50
      `, [req.user.schoolId, req.user.userId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      if (error && (error.code === '42P01' || error.code === '42501')) {
        return res.json({ success: true, data: [] });
      }
      next(error);
    }
  }

  static async createConversation(req, res, next) {
    try {
      const { title, type = 'direct', participantIds = [] } = req.body || {};
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        throw new ValidationError('participantIds array is required');
      }
      const thread = await query(`
        INSERT INTO message_threads (school_id, title, type, created_by)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [req.user.schoolId, title || null, type, req.user.userId]);
      const threadId = thread.rows[0].id;
      const allParticipants = Array.from(new Set([req.user.userId, ...participantIds]));
      for (const uid of allParticipants) {
        // eslint-disable-next-line no-await-in-loop
        await query(`
          INSERT INTO thread_participants (thread_id, user_id, role)
          VALUES ($1, $2, 'member')
          ON CONFLICT (thread_id, user_id) DO NOTHING
        `, [threadId, uid]);
      }
      res.status(201).json({ success: true, data: thread.rows[0] });
    } catch (error) { next(error); }
  }

  static async getConversationDetails(req, res, next) {
    try {
      const { conversationId } = req.params;
      const thread = await query(`
        SELECT * FROM message_threads WHERE id = $1 AND school_id = $2
      `, [conversationId, req.user.schoolId]);
      if (thread.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Conversation not found' } });
      const participants = await query(`
        SELECT u.id, u.first_name, u.last_name
        FROM thread_participants tp JOIN users u ON tp.user_id = u.id
        WHERE tp.thread_id = $1 AND (tp.left_at IS NULL)
        ORDER BY u.first_name
      `, [conversationId]);
      res.json({ success: true, data: { conversation: thread.rows[0], participants: participants.rows } });
    } catch (error) { next(error); }
  }

  static async sendThreadMessage(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { content, title } = req.body || {};
      if (!content) throw new ValidationError('content is required');
      const inserted = await query(`
        INSERT INTO messages (school_id, sender_id, title, content, type, thread_id)
        VALUES ($1, $2, $3, $4, 'message', $5) RETURNING *
      `, [req.user.schoolId, req.user.userId, title || null, content, conversationId]);
      // ensure all thread participants become recipients for tracking
      const participants = await query(`SELECT user_id FROM thread_participants WHERE thread_id = $1 AND (left_at IS NULL)`, [conversationId]);
      for (const row of participants.rows) {
        // eslint-disable-next-line no-await-in-loop
        await query(`
          INSERT INTO message_recipients (message_id, recipient_id, recipient_type, status)
          VALUES ($1, $2, 'user', 'delivered')
          ON CONFLICT (message_id, recipient_id) DO NOTHING
        `, [inserted.rows[0].id, row.user_id]);
      }
      res.status(201).json({ success: true, data: inserted.rows[0] });
    } catch (error) { next(error); }
  }

  static async addParticipant(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { userId } = req.body || {};
      if (!userId) throw new ValidationError('userId is required');
      await query(`
        INSERT INTO thread_participants (thread_id, user_id, role)
        VALUES ($1, $2, 'member') ON CONFLICT (thread_id, user_id) DO NOTHING
      `, [conversationId, userId]);
      res.json({ success: true, message: 'Participant added' });
    } catch (error) { next(error); }
  }

  static async removeParticipant(req, res, next) {
    try {
      const { conversationId, userId } = req.params;
      await query(`
        UPDATE thread_participants SET left_at = NOW() WHERE thread_id = $1 AND user_id = $2
      `, [conversationId, userId]);
      res.json({ success: true, message: 'Participant removed' });
    } catch (error) { next(error); }
  }

  static async getConversationHistory(req, res, next) {
    try {
      const { conversationId } = req.params;
      const result = await query(`
        SELECT m.id, m.title, m.content, m.type, m.created_at, m.sender_id,
               u.first_name, u.last_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.thread_id = $1
        ORDER BY m.created_at DESC
        LIMIT 200
      `, [conversationId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      if (error && (error.code === '42P01' || error.code === '42501')) {
        return res.json({ success: true, data: [] });
      }
      next(error);
    }
  }
  // Send message/notification
  static async sendMessage(req, res, next) {
    try {
      const messageData = {
        ...req.body,
        senderId: req.user.userId,
        schoolId: req.user.schoolId
      };

      // Validate required fields
      if (!messageData.title || !messageData.content || !messageData.type) {
        throw new ValidationError('Title, content, and type are required');
      }

      // Validate recipients
      if (!messageData.recipients || messageData.recipients.length === 0) {
        throw new ValidationError('At least one recipient is required');
      }

      // Create message
      const messageResult = await query(`
        INSERT INTO messages (
          school_id, sender_id, title, content, type, priority,
          scheduled_for, is_urgent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `, [
        messageData.schoolId,
        messageData.senderId,
        messageData.title,
        messageData.content,
        messageData.type,
        messageData.priority || 'normal',
        messageData.scheduledFor || null,
        messageData.isUrgent || false
      ]);

      const message = messageResult.rows[0];

      // Create message recipients
      const recipientPromises = messageData.recipients.map(recipientId => 
        query(`
          INSERT INTO message_recipients (
            message_id, recipient_id, recipient_type, status
          ) VALUES ($1, $2, $3, 'pending')
        `, [message.id, recipientId, messageData.recipientType || 'user'])
      );

      await Promise.all(recipientPromises);

      // Send notifications if not scheduled
      if (!messageData.scheduledFor) {
        await this.deliverMessage(message.id);
      }

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Get messages (inbox/outbox)
  static async getMessages(req, res, next) {
    try {
      const { type = 'inbox' } = req.params;
      const filters = {
        status: req.query.status,
        messageType: req.query.messageType,
        priority: req.query.priority,
        isUrgent: req.query.isUrgent === 'true',
        isRead: req.query.isRead === 'true',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql;
      let params;

      if (type === 'inbox') {
        sql = `
          SELECT 
            m.*,
            mr.status as recipient_status,
            mr.read_at,
            mr.delivered_at,
            u.first_name || ' ' || u.last_name as sender_name,
            u.email as sender_email
          FROM messages m
          JOIN message_recipients mr ON m.id = mr.message_id
          JOIN users u ON m.sender_id = u.id
          WHERE mr.recipient_id = $1
        `;
        params = [req.user.userId];
      } else {
        sql = `
          SELECT 
            m.*,
            COUNT(mr.id) as total_recipients,
            COUNT(mr.id) FILTER (WHERE mr.status = 'delivered') as delivered_count,
            COUNT(mr.id) FILTER (WHERE mr.read_at IS NOT NULL) as read_count
          FROM messages m
          LEFT JOIN message_recipients mr ON m.id = mr.message_id
          WHERE m.sender_id = $1
          GROUP BY m.id
        `;
        params = [req.user.userId];
      }

      // Apply filters
      let paramCount = 1;
      if (filters.status) {
        paramCount++;
        sql += ` AND mr.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.messageType) {
        paramCount++;
        sql += ` AND m.type = $${paramCount}`;
        params.push(filters.messageType);
      }

      if (filters.priority) {
        paramCount++;
        sql += ` AND m.priority = $${paramCount}`;
        params.push(filters.priority);
      }

      if (filters.isUrgent !== undefined) {
        paramCount++;
        sql += ` AND m.is_urgent = $${paramCount}`;
        params.push(filters.isUrgent);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND m.created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND m.created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      sql += ` ORDER BY m.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get message by ID
  static async getMessage(req, res, next) {
    try {
      const { id } = req.params;

      const messageResult = await query(`
        SELECT 
          m.*,
          u.first_name || ' ' || u.last_name as sender_name,
          u.email as sender_email
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1
      `, [id]);

      if (messageResult.rows.length === 0) {
        throw new NotFoundError('Message not found');
      }

      const message = messageResult.rows[0];

      // Get recipients
      const recipientsResult = await query(`
        SELECT 
          mr.*,
          u.first_name || ' ' || u.last_name as recipient_name,
          u.email as recipient_email
        FROM message_recipients mr
        JOIN users u ON mr.recipient_id = u.id
        WHERE mr.message_id = $1
      `, [id]);

      message.recipients = recipientsResult.rows;

      // Mark as read if user is recipient
      if (message.recipients.some(r => r.recipient_id === req.user.userId)) {
        await query(`
          UPDATE message_recipients 
          SET read_at = NOW() 
          WHERE message_id = $1 AND recipient_id = $2 AND read_at IS NULL
        `, [id, req.user.userId]);
      }

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark message as read/unread
  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const { isRead = true } = req.body;

      const readAt = isRead ? 'NOW()' : 'NULL';
      
      await query(`
        UPDATE message_recipients 
        SET read_at = ${readAt}
        WHERE message_id = $1 AND recipient_id = $2
      `, [id, req.user.userId]);

      res.json({
        success: true,
        message: `Message marked as ${isRead ? 'read' : 'unread'}`
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete message
  static async deleteMessage(req, res, next) {
    try {
      const { id } = req.params;

      // Check if user is sender or recipient
      const checkResult = await query(`
        SELECT m.sender_id, mr.recipient_id
        FROM messages m
        LEFT JOIN message_recipients mr ON m.id = mr.message_id
        WHERE m.id = $1 AND (m.sender_id = $2 OR mr.recipient_id = $2)
      `, [id, req.user.id]);

      if (checkResult.rows.length === 0) {
        throw new NotFoundError('Message not found or access denied');
      }

      const isSender = checkResult.rows.some(row => row.sender_id === req.user.userId);

      if (isSender) {
        // Delete entire message if sender
        await query('DELETE FROM messages WHERE id = $1', [id]);
      } else {
        // Delete only recipient record
        await query(`
          DELETE FROM message_recipients 
          WHERE message_id = $1 AND recipient_id = $2
        `, [id, req.user.userId]);
      }

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Create announcement
  static async createAnnouncement(req, res, next) {
    try {
      const announcementData = {
        ...req.body,
        schoolId: req.user.schoolId,
        createdBy: req.user.userId
      };

      // Validate required fields
      if (!announcementData.title || !announcementData.content) {
        throw new ValidationError('Title and content are required');
      }

      const result = await query(`
        INSERT INTO announcements (
          school_id, title, content, target_audience, priority,
          is_urgent, expires_at, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `, [
        announcementData.schoolId,
        announcementData.title,
        announcementData.content,
        announcementData.targetAudience || 'all',
        announcementData.priority || 'normal',
        announcementData.isUrgent || false,
        announcementData.expiresAt || null,
        announcementData.createdBy
      ]);

      const announcement = result.rows[0];

      // Send notifications to target audience
      await this.notifyTargetAudience(announcement);

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: announcement
      });
    } catch (error) {
      next(error);
    }
  }

  // Get announcements
  static async getAnnouncements(req, res, next) {
    try {
      const filters = {
        targetAudience: req.query.targetAudience,
        priority: req.query.priority,
        isUrgent: req.query.isUrgent === 'true',
        isActive: req.query.isActive !== 'false',
        adminOnly: req.query.admin_only === 'true',
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql = `
        SELECT 
          a.*,
          u.first_name || ' ' || u.last_name as created_by_name,
          u.role as created_by_role
        FROM announcements a
        JOIN users u ON a.created_by = u.id
        WHERE a.school_id = $1
      `;
      
      const params = [req.user.schoolId];
      let paramCount = 1;

      // Filter for admin announcements only if requested
      if (filters.adminOnly) {
        paramCount++;
        sql += ` AND u.role = $${paramCount}`;
        params.push('super_admin');
      }

      // Apply filters
      if (filters.targetAudience) {
        paramCount++;
        sql += ` AND (a.target_audience = $${paramCount} OR a.target_audience = 'all')`;
        params.push(filters.targetAudience);
      }

      if (filters.priority) {
        paramCount++;
        sql += ` AND a.priority = $${paramCount}`;
        params.push(filters.priority);
      }

      if (filters.isUrgent !== undefined) {
        paramCount++;
        sql += ` AND a.is_urgent = $${paramCount}`;
        params.push(filters.isUrgent);
      }

      if (filters.isActive) {
        sql += ` AND (a.expires_at IS NULL OR a.expires_at > NOW())`;
      }

      sql += ` ORDER BY a.is_urgent DESC, a.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update announcement
  static async updateAnnouncement(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await query(`
        UPDATE announcements 
        SET 
          title = COALESCE($2, title),
          content = COALESCE($3, content),
          target_audience = COALESCE($4, target_audience),
          priority = COALESCE($5, priority),
          is_urgent = COALESCE($6, is_urgent),
          expires_at = COALESCE($7, expires_at),
          updated_at = NOW()
        WHERE id = $1 AND school_id = $8
        RETURNING *
      `, [
        id,
        updateData.title,
        updateData.content,
        updateData.targetAudience,
        updateData.priority,
        updateData.isUrgent,
        updateData.expiresAt,
        req.user.schoolId
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Announcement not found');
      }

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete announcement
  static async deleteAnnouncement(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        DELETE FROM announcements 
        WHERE id = $1 AND school_id = $2
        RETURNING id
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Announcement not found');
      }

      res.json({
        success: true,
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Send notification
  static async sendNotification(req, res, next) {
    try {
      const notificationData = {
        ...req.body,
        schoolId: req.user.schoolId,
        createdBy: req.user.userId
      };

      // Validate required fields
      if (!notificationData.title || !notificationData.content || !notificationData.recipients) {
        throw new ValidationError('Title, content, and recipients are required');
      }

      // Create notification
      const notificationResult = await query(`
        INSERT INTO notifications (
          school_id, title, content, type, priority, 
          action_url, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `, [
        notificationData.schoolId,
        notificationData.title,
        notificationData.content,
        notificationData.type || 'general',
        notificationData.priority || 'normal',
        notificationData.actionUrl || null,
        notificationData.createdBy
      ]);

      const notification = notificationResult.rows[0];

      // Create notification recipients
      const recipientPromises = notificationData.recipients.map(recipientId => 
        query(`
          INSERT INTO notification_recipients (
            notification_id, recipient_id, status
          ) VALUES ($1, $2, 'pending')
        `, [notification.id, recipientId])
      );

      await Promise.all(recipientPromises);

      // Deliver notifications
      await this.deliverNotifications(notification.id);

      res.status(201).json({
        success: true,
        message: 'Notification sent successfully',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  // Get notifications
  static async getNotifications(req, res, next) {
    try {
      const filters = {
        type: req.query.type,
        priority: req.query.priority,
        isRead: req.query.isRead === 'true',
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      let sql = `
        SELECT 
          n.*,
          nr.read_at,
          nr.delivered_at,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        JOIN users u ON n.created_by = u.id
        WHERE nr.recipient_id = $1
      `;
      
      const params = [req.user.userId];
      let paramCount = 1;

      // Apply filters
      if (filters.type) {
        paramCount++;
        sql += ` AND n.type = $${paramCount}`;
        params.push(filters.type);
      }

      if (filters.priority) {
        paramCount++;
        sql += ` AND n.priority = $${paramCount}`;
        params.push(filters.priority);
      }

      if (filters.isRead !== undefined) {
        if (filters.isRead) {
          sql += ` AND nr.read_at IS NOT NULL`;
        } else {
          sql += ` AND nr.read_at IS NULL`;
        }
      }

      sql += ` ORDER BY n.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      let result;
      try {
        result = await query(sql, params);
      } catch (error) {
        // If table or permission missing in some deployments, return empty list instead of 500
        if (error && (error.code === '42P01' || error.code === '42501' || error.code === '42703')) {
          return res.json({ success: true, data: [], pagination: { limit: filters.limit, offset: filters.offset, total: 0 } });
        }
        throw error;
      }

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(req, res, next) {
    try {
      const { id } = req.params;

      await query(`
        UPDATE notification_recipients 
        SET read_at = NOW() 
        WHERE notification_id = $1 AND recipient_id = $2
      `, [id, req.user.userId]);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get communication settings
  static async getCommunicationSettings(req, res, next) {
    try {
      const result = await query(`
        SELECT * FROM communication_settings 
        WHERE school_id = $1
      `, [req.user.schoolId]);

      const settings = result.rows[0] || {};

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  // Update communication settings
  static async updateCommunicationSettings(req, res, next) {
    try {
      const updateData = req.body;

      const result = await query(`
        INSERT INTO communication_settings (
          school_id, email_notifications, sms_notifications,
          push_notifications, auto_reminders, reminder_frequency,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (school_id) DO UPDATE SET
          email_notifications = $2,
          sms_notifications = $3,
          push_notifications = $4,
          auto_reminders = $5,
          reminder_frequency = $6,
          updated_at = NOW()
        RETURNING *
      `, [
        req.user.schoolId,
        updateData.emailNotifications || true,
        updateData.smsNotifications || false,
        updateData.pushNotifications || true,
        updateData.autoReminders || true,
        updateData.reminderFrequency || 'daily'
      ]);

      res.json({
        success: true,
        message: 'Communication settings updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to deliver messages
  static async deliverMessage(messageId) {
    try {
      // Get message recipients
      const recipientsResult = await query(`
        SELECT mr.recipient_id, u.email, u.phone_number
        FROM message_recipients mr
        JOIN users u ON mr.recipient_id = u.id
        WHERE mr.message_id = $1
      `, [messageId]);

      // Update status to delivered
      await query(`
        UPDATE message_recipients 
        SET status = 'delivered', delivered_at = NOW()
        WHERE message_id = $1
      `, [messageId]);

      // Here you would integrate with email/SMS services
      console.log(`Message ${messageId} delivered to ${recipientsResult.rows.length} recipients`);
    } catch (error) {
      console.error('Error delivering message:', error);
    }
  }

  // Helper method to notify target audience
  static async notifyTargetAudience(announcement) {
    try {
      // Determine audience filter
      // Special audience: dashboard users (users with school dashboard access)
      const dashboardRoles = [
        'school_director',
        'principal',
        'teacher',
        'hr',
        'finance'
      ];

      let usersSql = `
        SELECT u.id
        FROM users u
        WHERE u.school_id = $1
      `;
      const usersParams = [announcement.school_id];

      if (announcement.target_audience && announcement.target_audience !== 'all') {
        if (announcement.target_audience === 'dashboard_users') {
          usersSql += ` AND u.role = ANY($2)`;
          usersParams.push(dashboardRoles);
        } else {
          usersSql += ` AND u.role = $2`;
          usersParams.push(announcement.target_audience);
        }
      }

      const usersResult = await query(usersSql, usersParams);

      // If no recipients, nothing to do
      if (usersResult.rows.length === 0) {
        console.warn('notifyTargetAudience: no recipients found for announcement');
        return;
      }

      // Create a single notification and recipient rows for all users
      const notificationInsert = await query(`
        INSERT INTO notifications (
          school_id, title, content, type, priority,
          created_by, created_at
        ) VALUES ($1, $2, $3, 'announcement', $4, $5, NOW())
        RETURNING id
      `, [
        announcement.school_id,
        announcement.title,
        // Use content field from announcements table
        announcement.content || '',
        announcement.priority || 'normal',
        announcement.created_by || null,
      ]);

      const notificationId = notificationInsert.rows[0]?.id;

      if (notificationId) {
        for (const row of usersResult.rows) {
          // eslint-disable-next-line no-await-in-loop
          await query(`
            INSERT INTO notification_recipients (
              notification_id, recipient_id, status
            ) VALUES ($1, $2, 'delivered')
            ON CONFLICT DO NOTHING
          `, [notificationId, row.id]);
        }
      }

      console.log(`Announcement notification ${notificationId} sent to ${usersResult.rows.length} users`);
    } catch (error) {
      console.error('Error notifying target audience:', error);
    }
  }

  // Helper method to deliver notifications
  static async deliverNotifications(notificationId) {
    try {
      // Update status to delivered
      await query(`
        UPDATE notification_recipients 
        SET delivered_at = NOW()
        WHERE notification_id = $1
      `, [notificationId]);

      console.log(`Notifications ${notificationId} delivered`);
    } catch (error) {
      console.error('Error delivering notifications:', error);
    }
  }
}

module.exports = CommunicationController;