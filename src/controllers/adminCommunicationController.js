const { query } = require('../config/database');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * AdminCommunicationController
 * Super Admin endpoints for company announcements targeting schools and roles.
 * Creates per-school announcement rows so school users fetch them via /api/communication endpoints.
 */
class AdminCommunicationController {
  static async listAnnouncements(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '50', 10), 200));
      const schoolId = (req.query.schoolId || '').trim();

      const params = [];
      let where = `cu.role = 'super_admin'`;

      if (schoolId) {
        params.push(schoolId);
        where += ` AND a.school_id = $${params.length}`;
      }

      const rows = await query(
        `SELECT a.*, s.name AS school_name,
                cu.first_name || ' ' || cu.last_name AS created_by_name
         FROM announcements a
         JOIN users cu ON cu.id = a.created_by
         LEFT JOIN schools s ON s.id = a.school_id
         WHERE ${where}
         ORDER BY a.created_at DESC
         LIMIT $${params.length + 1}`,
        [...params, limit]
      );

      return res.json({ success: true, data: rows.rows });
    } catch (error) {
      next(error);
    }
  }

  static async broadcastAnnouncement(req, res, next) {
    try {
      const {
        broadcastToAll = false,
        schoolId,
        schoolIds = [],
        title,
        content,
        targetRoles = [],
        priority = 'normal',
        isUrgent = false,
        expiresAt = null,
        scheduledAt = null,
      } = req.body || {};

      if (!title || !content) {
        throw new ValidationError('Title and content are required');
      }

      // Resolve target schools
      let targets = [];
      if (broadcastToAll) {
        const all = await query(`SELECT id FROM schools WHERE COALESCE(is_active, true) = true`);
        targets = all.rows.map((r) => r.id);
      } else if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        targets = schoolIds;
      } else if (schoolId) {
        targets = [schoolId];
      } else {
        throw new ValidationError('Provide schoolId, schoolIds, or set broadcastToAll = true');
      }

      // Roles to target; if none, use 'all'
      const roles = Array.isArray(targetRoles) && targetRoles.length > 0 ? targetRoles : ['all'];

      const created = [];
      for (const sid of targets) {
        for (const role of roles) {
          // eslint-disable-next-line no-await-in-loop
          const ins = await query(
            `INSERT INTO announcements (
               school_id, title, content, target_audience, priority,
               is_urgent, expires_at, scheduled_at, created_by, created_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
             RETURNING *`,
            [
              sid,
              title,
              content,
              role,
              priority,
              !!isUrgent,
              expiresAt || null,
              scheduledAt || null,
              req.user.userId,
            ]
          );
          created.push(ins.rows[0]);
        }
      }

      // Optional: create notifications for targeted audience (best-effort)
      // We purposefully avoid hard dependency here to keep request responsive.
      try {
        const CommunicationController = require('./communicationController');
        for (const a of created) {
          // eslint-disable-next-line no-await-in-loop
          await CommunicationController.notifyTargetAudience(a);
        }
      } catch (notifyErr) {
        console.warn('Broadcast: notifyTargetAudience failed:', notifyErr?.message || notifyErr);
      }

      return res.status(201).json({ success: true, message: 'Broadcast created', data: created });
    } catch (error) {
      next(error);
    }
  }

  static async updateAnnouncement(req, res, next) {
    try {
      const { id } = req.params;
      const { title, content, priority, isUrgent, expiresAt, scheduledAt, targetAudience } = req.body || {};

      const result = await query(
        `UPDATE announcements SET
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           priority = COALESCE($4, priority),
           is_urgent = COALESCE($5, is_urgent),
           expires_at = COALESCE($6, expires_at),
           scheduled_at = COALESCE($7, scheduled_at),
           target_audience = COALESCE($8, target_audience),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, title || null, content || null, priority || null, isUrgent, expiresAt || null, scheduledAt || null, targetAudience || null]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAnnouncement(req, res, next) {
    try {
      const { id } = req.params;
      const del = await query(`DELETE FROM announcements WHERE id = $1 RETURNING id`, [id]);
      if (del.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }
      return res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminCommunicationController;


