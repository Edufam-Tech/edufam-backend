const { query } = require('../../config/database');

class HRWebController {
  async getDashboard(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const [summary] = await Promise.all([
        query(`
          SELECT 
            (SELECT COUNT(*) FROM users WHERE school_id = $1 AND user_type = 'staff' AND is_active = true) as total_staff,
            (SELECT COUNT(*) FROM leave_requests WHERE school_id = $1 AND status = 'pending') as pending_leave,
            (SELECT COUNT(*) FROM recruitment_requests WHERE school_id = $1 AND status = 'pending') as pending_recruitment
        `, [schoolId])
      ]);
      res.json({ success: true, data: summary.rows[0] || {} });
    } catch (e) {
      res.status(500).json({ success: false, error: { message: 'Failed to load HR dashboard' } });
    }
  }

  async getStaffOverview(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, first_name, last_name, role, department_id, is_active
        FROM users WHERE school_id = $1 AND user_type = 'staff'
        ORDER BY last_name
      `, [schoolId]);
      res.json({ success: true, data: { staff: rows.rows } });
    } catch (e) {
      res.status(500).json({ success: false, error: { message: 'Failed to fetch staff' } });
    }
  }

  async getPendingRecruitment(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, position_title, department_id, priority, status, requested_by, created_at
        FROM recruitment_requests WHERE school_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
      `, [schoolId]);
      res.json({ success: true, data: { requests: rows.rows } });
    } catch (e) {
      res.status(500).json({ success: false, error: { message: 'Failed to fetch recruitment requests' } });
    }
  }

  async approveRecruitment(req, res) {
    try {
      const { id } = req.params;
      const { approval_notes } = req.body || {};
      const schoolId = req.user.schoolId;
      const result = await query(`
        UPDATE recruitment_requests 
        SET status = 'approved', approval_notes = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4 AND status = 'pending'
        RETURNING id
      `, [approval_notes || null, req.user.userId, id, schoolId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Request not found' } });
      res.json({ success: true, message: 'Recruitment approved' });
    } catch (e) {
      res.status(500).json({ success: false, error: { message: 'Failed to approve recruitment' } });
    }
  }

  async rejectRecruitment(req, res) {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body || {};
      const schoolId = req.user.schoolId;
      const result = await query(`
        UPDATE recruitment_requests 
        SET status = 'rejected', rejection_reason = $1, rejected_by = $2, rejected_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND school_id = $4 AND status = 'pending'
        RETURNING id
      `, [rejection_reason || null, req.user.userId, id, schoolId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Request not found' } });
      res.json({ success: true, message: 'Recruitment rejected' });
    } catch (e) {
      res.status(500).json({ success: false, error: { message: 'Failed to reject recruitment' } });
    }
  }
}

module.exports = new HRWebController();


