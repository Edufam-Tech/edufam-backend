const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class SupportController {
  static async listTickets(req, res, next) {
    try {
      const { status, priority, assignedTo, search, limit = 50, offset = 0 } = req.query;

      const clauses = [];
      const params = [];

      if (status) {
        params.push(status);
        clauses.push(`status = $${params.length}`);
      }
      if (priority) {
        params.push(priority);
        clauses.push(`priority = $${params.length}`);
      }
      if (assignedTo) {
        params.push(assignedTo);
        clauses.push(`assigned_to_admin = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        clauses.push(`(LOWER(title) LIKE LOWER($${params.length}) OR LOWER(description) LIKE LOWER($${params.length}))`);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      params.push(parseInt(limit));
      params.push(parseInt(offset));

      const result = await query(`
        SELECT id, title, description, priority, status, requester_email, assigned_to_admin,
               created_at, updated_at, resolved_at
        FROM support_tickets
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  static async getTicket(req, res, next) {
    try {
      const { id } = req.params;
      const result = await query(`
        SELECT * FROM support_tickets WHERE id = $1
      `, [id]);
      if (result.rows.length === 0) throw new NotFoundError('Ticket not found');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async createTicket(req, res, next) {
    try {
      const { title, description, priority = 'medium', requesterEmail } = req.body;
      if (!title || !requesterEmail) throw new ValidationError('Title and requesterEmail are required');
      const result = await query(`
        INSERT INTO support_tickets (title, description, priority, status, requester_email)
        VALUES ($1, $2, $3, 'open', $4)
        RETURNING *
      `, [title, description || '', priority, requesterEmail]);
      res.json({ success: true, data: result.rows[0], message: 'Ticket created' });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const allowed = ['open', 'in_progress', 'resolved', 'closed'];
      if (!allowed.includes(status)) throw new ValidationError('Invalid status');

      const result = await query(`
        UPDATE support_tickets
        SET status = $1,
            resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status, id]);
      if (result.rows.length === 0) throw new NotFoundError('Ticket not found');
      res.json({ success: true, data: result.rows[0], message: 'Status updated' });
    } catch (error) {
      next(error);
    }
  }

  static async assignTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { adminId } = req.body;
      if (!adminId) throw new ValidationError('adminId is required');
      const result = await query(`
        UPDATE support_tickets
        SET assigned_to_admin = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [adminId, id]);
      if (result.rows.length === 0) throw new NotFoundError('Ticket not found');
      res.json({ success: true, data: result.rows[0], message: 'Ticket assigned' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SupportController;


