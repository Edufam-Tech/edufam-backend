const { query } = require('../config/database');
const { DatabaseError, ValidationError } = require('../middleware/errorHandler');

/**
 * Simple CRM Service for Sales/Marketing admin
 */
class CrmService {
  async ensureTables() {
    // Create leads table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS admin_crm_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        source VARCHAR(50) DEFAULT 'web',
        status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','lost')),
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_crm_leads_status ON admin_crm_leads(status);
      CREATE INDEX IF NOT EXISTS idx_admin_crm_leads_created ON admin_crm_leads(created_at);
    `);
  }

  async createLead({ name, email, phone, source = 'web', status = 'new', ownerId }) {
    try {
      if (!name || !name.trim()) throw new ValidationError('Lead name is required');
      await this.ensureTables();
      const res = await query(
        `INSERT INTO admin_crm_leads (name, email, phone, source, status, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name.trim(), email || null, phone || null, source || 'web', status || 'new', ownerId || null]
      );
      return res.rows[0];
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Failed to create lead', err);
    }
  }

  async getLeads({ search, status, limit = 50, page = 1 } = {}) {
    try {
      await this.ensureTables();
      let where = [];
      let params = [];
      let i = 0;
      if (status) {
        params.push(status);
        where.push(`status = $${++i}`);
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        params.push(term, term, term);
        where.push(`(name ILIKE $${++i} OR COALESCE(email,'') ILIKE $${++i} OR COALESCE(phone,'') ILIKE $${++i})`);
      }
      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const safeLimit = Math.min(parseInt(limit) || 50, 200);
      const offset = ((parseInt(page) || 1) - 1) * safeLimit;
      params.push(safeLimit, offset);
      const res = await query(
        `SELECT * FROM admin_crm_leads ${whereClause}
         ORDER BY created_at DESC LIMIT $${i + 1} OFFSET $${i + 2}`,
        params
      );
      return res.rows;
    } catch (err) {
      throw new DatabaseError('Failed to fetch leads', err);
    }
  }

  async updateLeadStatus(leadId, status) {
    try {
      await this.ensureTables();
      const allowed = ['new','contacted','qualified','won','lost'];
      if (!allowed.includes(status)) throw new ValidationError('Invalid status');
      const res = await query(
        `UPDATE admin_crm_leads SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [leadId, status]
      );
      return res.rows[0];
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Failed to update lead status', err);
    }
  }

  async getAnalytics() {
    try {
      await this.ensureTables();
      const totals = await query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN status='won' THEN 1 END)::int as won,
          COUNT(CASE WHEN status='lost' THEN 1 END)::int as lost
        FROM admin_crm_leads`);
      const trend = await query(`
        SELECT date_trunc('day', created_at) as day, COUNT(*)::int as cnt
        FROM admin_crm_leads
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1`);
      return {
        ...totals.rows[0],
        conversion: totals.rows[0].total ? Math.round((totals.rows[0].won / totals.rows[0].total) * 100) : 0,
        leadsOverTime: trend.rows,
      };
    } catch (err) {
      throw new DatabaseError('Failed to load CRM analytics', err);
    }
  }
}

module.exports = new CrmService();


