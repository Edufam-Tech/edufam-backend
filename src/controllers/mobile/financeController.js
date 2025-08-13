const { query } = require('../../config/database');

class MobileFinanceController {
  static async getDashboard(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT 
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
          (SELECT COALESCE(SUM(amount),0) FROM fee_invoices WHERE school_id = $1 AND status = 'unpaid') as outstanding
      `, [schoolId]);
      res.json({ success: true, data: rows.rows[0] || {} });
    } catch (e) { next(e); }
  }

  static async getRecentTransactions(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT id, amount, channel, status, created_at
        FROM payments WHERE school_id = $1
        ORDER BY created_at DESC LIMIT 20
      `, [schoolId]);
      res.json({ success: true, data: { transactions: rows.rows } });
    } catch (e) { next(e); }
  }
}

module.exports = MobileFinanceController;


