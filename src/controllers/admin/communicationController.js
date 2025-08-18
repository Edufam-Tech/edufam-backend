const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const { query } = require('../../config/database');
const CommunicationController = require('../communicationController');

class AdminCommunicationController {
  // Create announcement for a specific school (admin context)
  static async createAnnouncementForSchool(req, res, next) {
    try {
      const {
        schoolId,
        title,
        content,
        targetAudience = 'all',
        priority = 'normal',
        isUrgent = false,
        expiresAt = null,
      } = req.body || {};

      if (!schoolId) throw new ValidationError('schoolId is required');
      if (!title || !content) throw new ValidationError('Title and content are required');

      // Ensure school exists
      const schoolCheck = await query('SELECT id FROM schools WHERE id = $1', [schoolId]);
      if (schoolCheck.rows.length === 0) throw new NotFoundError('School not found');

      const result = await query(
        `INSERT INTO announcements (
          school_id, title, content, target_audience, priority,
          is_urgent, expires_at, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          schoolId,
          title,
          content,
          targetAudience,
          priority,
          isUrgent,
          expiresAt,
          req.user?.userId || null,
        ]
      );

      const announcement = result.rows[0];

      // Reuse existing helper to send notifications to the target audience
      try {
        await CommunicationController.notifyTargetAudience(announcement);
      } catch (notifyErr) {
        // Don't fail the request if notifications fail; just log
        console.error('Admin announcement notify error:', notifyErr);
      }

      res.status(201).json({
        success: true,
        message: 'Announcement created and dispatched',
        data: announcement,
      });
    } catch (error) {
      next(error);
    }
  }

  // List announcements for a selected school
  static async getAnnouncementsForSchool(req, res, next) {
    try {
      const { schoolId } = req.query;
      if (!schoolId) throw new ValidationError('schoolId is required');

      const result = await query(
        `SELECT a.*, u.first_name || ' ' || u.last_name as created_by_name
         FROM announcements a
         LEFT JOIN users u ON a.created_by = u.id
         WHERE a.school_id = $1
         ORDER BY a.is_urgent DESC, a.created_at DESC
         LIMIT 100`,
        [schoolId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminCommunicationController;


