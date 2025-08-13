const { query } = require('../../config/database');

class FinanceWebController {
  async getDashboard(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT 
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
          (SELECT COUNT(*) FROM payments WHERE school_id = $1 AND status = 'failed' AND created_at >= CURRENT_DATE - INTERVAL '7 days') as failed_last_7d,
          (SELECT COALESCE(SUM(amount),0) FROM fee_invoices WHERE school_id = $1 AND status = 'unpaid') as outstanding
      `, [schoolId]);
      res.json({ success: true, data: rows.rows[0] || {} });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to load finance dashboard' } }); }
  }

  async getFinancialOverview(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as revenue
        FROM payments WHERE school_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1
      `, [schoolId]);
      res.json({ success: true, data: { revenueByMonth: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch financial overview' } }); }
  }

  async getMpesaTransactions(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, mpesa_receipt, payer_phone, amount, status, created_at
        FROM payments WHERE school_id = $1 AND channel = 'mpesa'
        ORDER BY created_at DESC LIMIT 50
      `, [schoolId]);
      res.json({ success: true, data: { transactions: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch M-Pesa transactions' } }); }
  }

  async getPendingFeeAssignments(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, template_id, class_id, total_students, status, created_at
        FROM fee_assignments WHERE school_id = $1 AND approval_status = 'pending'
        ORDER BY created_at DESC
      `, [schoolId]);
      res.json({ success: true, data: { assignments: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch fee assignments' } }); }
  }

  async approveFeeAssignment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const schoolId = req.user.schoolId;
      const result = await query(`
        UPDATE fee_assignments 
        SET approval_status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND school_id = $3 AND approval_status = 'pending'
        RETURNING id
      `, [userId, id, schoolId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Assignment not found' } });
      res.json({ success: true, message: 'Fee assignment approved' });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to approve assignment' } }); }
  }

  async rejectFeeAssignment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const schoolId = req.user.schoolId;
      const result = await query(`
        UPDATE fee_assignments 
        SET approval_status = 'rejected', approval_comments = $1, approved_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND school_id = $3 AND approval_status = 'pending'
        RETURNING id
      `, [reason || null, id, schoolId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Assignment not found' } });
      res.json({ success: true, message: 'Fee assignment rejected' });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to reject assignment' } }); }
  }
}

module.exports = new FinanceWebController();


