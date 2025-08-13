const { query } = require('../../config/database');

class MobileHRController {
  static async getDashboard(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE school_id = $1 AND user_type = 'staff' AND is_active = true) as total_staff,
          (SELECT COUNT(*) FROM leave_requests WHERE school_id = $1 AND status = 'pending') as pending_leave,
          (SELECT COUNT(*) FROM recruitment_requests WHERE school_id = $1 AND status = 'pending') as pending_recruitment
      `, [schoolId]);
      res.json({ success: true, data: rows.rows[0] || {} });
    } catch (e) { next(e); }
  }

  static async getPendingLeave(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, user_id, leave_type, start_date, end_date, days_requested, reason, created_at
        FROM leave_requests WHERE school_id = $1 AND status = 'pending'
        ORDER BY created_at DESC LIMIT 20
      `, [schoolId]);
      res.json({ success: true, data: { leaveRequests: rows.rows } });
    } catch (e) { next(e); }
  }

  static async getPendingRecruitment(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, position_title, department_id, priority, created_at
        FROM recruitment_requests WHERE school_id = $1 AND status = 'pending'
        ORDER BY created_at DESC LIMIT 20
      `, [schoolId]);
      res.json({ success: true, data: { recruitmentRequests: rows.rows } });
    } catch (e) { next(e); }
  }
}

module.exports = MobileHRController;


