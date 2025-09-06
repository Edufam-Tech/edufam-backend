const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const { query } = require('../../config/database');
const CommunicationController = require('../communicationController');

class AdminCommunicationController {
  // Create announcement for schools (admin context) - Enhanced for multi-school support
  static async createAnnouncementForSchool(req, res, next) {
    try {
      const {
        schoolId,
        schoolIds,
        broadcastToAll,
        title,
        content,
        targetAudience = 'all',
        targetRoles,
        priority = 'normal',
        isUrgent = false,
        expiresAt = null,
        scheduledAt = null,
      } = req.body || {};

      // Use targetRoles if provided, otherwise use targetAudience
      // If targetRoles is an array, we'll use 'all' for the database constraint
      // and handle role-specific targeting in notifications
      const dbTargetAudience = (targetRoles && targetRoles.length > 0) ? 'all' : targetAudience;

      if (!title || !content) throw new ValidationError('Title and content are required');

      let targetSchoolIds = [];

      // Determine target schools
      if (broadcastToAll) {
        const allSchools = await query('SELECT id FROM schools WHERE is_active = true');
        targetSchoolIds = allSchools.rows.map(row => row.id);
      } else if (schoolIds && schoolIds.length > 0) {
        // Validate multiple schools
        const placeholders = schoolIds.map((_, index) => `$${index + 1}`).join(',');
        const schoolCheck = await query(
          `SELECT id FROM schools WHERE id IN (${placeholders}) AND is_active = true`,
          schoolIds
        );
        if (schoolCheck.rows.length !== schoolIds.length) {
          throw new ValidationError('One or more schools not found or inactive');
        }
        targetSchoolIds = schoolIds;
      } else if (schoolId) {
        // Single school
        const schoolCheck = await query('SELECT id FROM schools WHERE id = $1 AND is_active = true', [schoolId]);
        if (schoolCheck.rows.length === 0) throw new NotFoundError('School not found or inactive');
        targetSchoolIds = [schoolId];
      } else {
        throw new ValidationError('Must specify schoolId, schoolIds, or broadcastToAll');
      }

      const createdAnnouncements = [];
      const notifications = [];

      // Create announcement for each target school
      for (const targetSchoolId of targetSchoolIds) {
        const result = await query(
          `INSERT INTO announcements (
            school_id, title, content, target_audience, priority,
            is_urgent, expires_at, scheduled_at, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            targetSchoolId,
            title,
            content,
            dbTargetAudience,
            priority,
            isUrgent,
            expiresAt,
            scheduledAt,
            req.user?.userId || null,
          ]
        );

        const announcement = result.rows[0];
        createdAnnouncements.push(announcement);

        // Create notifications for target users
        try {
          const notificationData = await this.createNotificationsForAnnouncement(
            announcement, 
            targetRoles
          );
          notifications.push(...notificationData);
        } catch (notifyErr) {
          console.error('Notification creation error for school', targetSchoolId, ':', notifyErr);
        }
      }

      res.status(201).json({
        success: true,
        message: `Announcement created and dispatched to ${targetSchoolIds.length} school(s)`,
        data: {
          announcements: createdAnnouncements,
          notificationsCreated: notifications.length,
          targetSchools: targetSchoolIds.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to create notifications for announcement
  static async createNotificationsForAnnouncement(announcement, targetRoles = null) {
    const notifications = [];
    
    // Build user query based on target roles
    let userQuery = `
      SELECT u.id, u.role, u.first_name, u.last_name, u.email
      FROM users u
      WHERE u.school_id = $1 AND u.is_active = true
    `;
    const queryParams = [announcement.school_id];

    if (targetRoles && targetRoles.length > 0) {
      const rolePlaceholders = targetRoles.map((_, index) => `$${index + 2}`).join(',');
      userQuery += ` AND u.role IN (${rolePlaceholders})`;
      queryParams.push(...targetRoles);
    }

    const users = await query(userQuery, queryParams);

    // Create notification for each user
    for (const user of users.rows) {
      const notificationResult = await query(
        `INSERT INTO notifications (
          school_id, title, content, type, priority, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *`,
        [
          announcement.school_id,
          announcement.title,
          announcement.content,
          'announcement',
          announcement.priority,
          announcement.created_by,
        ]
      );

      const notification = notificationResult.rows[0];

      // Create notification recipient record
      await query(
        `INSERT INTO notification_recipients (notification_id, recipient_id, status)
         VALUES ($1, $2, 'pending')`,
        [notification.id, user.id]
      );

      notifications.push({
        notification,
        recipient: user,
      });
    }

    return notifications;
  }

  // List announcements for schools (admin context)
  static async getAnnouncementsForSchool(req, res, next) {
    try {
      const { schoolId, limit = 100, offset = 0 } = req.query;

      let queryText, queryParams;

      if (schoolId) {
        // Get announcements for specific school
        queryText = `
          SELECT a.*, u.first_name || ' ' || u.last_name as created_by_name,
                 s.name as school_name
          FROM announcements a
          LEFT JOIN users u ON a.created_by = u.id
          LEFT JOIN schools s ON a.school_id = s.id
          WHERE a.school_id = $1
          ORDER BY a.is_urgent DESC, a.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [schoolId, parseInt(limit), parseInt(offset)];
      } else {
        // Get announcements for all schools (admin view)
        queryText = `
          SELECT a.*, u.first_name || ' ' || u.last_name as created_by_name,
                 s.name as school_name
          FROM announcements a
          LEFT JOIN users u ON a.created_by = u.id
          LEFT JOIN schools s ON a.school_id = s.id
          ORDER BY a.is_urgent DESC, a.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        queryParams = [parseInt(limit), parseInt(offset)];
      }

      const result = await query(queryText, queryParams);

      res.json({ 
        success: true, 
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminCommunicationController;


