const express = require('express');
const router = express.Router();
const { authenticate, requireUserType } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// List events by month/year
router.get('/events', async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year are required' });

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const result = await query(
      `SELECT * FROM calendar_events
       WHERE school_id = $1
       AND ((start_at, end_at) OVERLAPS ($2::timestamptz, $3::timestamptz))
       ORDER BY start_at ASC`,
      [req.user.school_id, start.toISOString(), end.toISOString()]
    );
    res.json({ success: true, data: result.rows });
  } catch (e) { next(e); }
});

// Create event
router.post('/events', async (req, res, next) => {
  try {
    const { title, description, startDate, endDate, type, allDay, curriculum, classes } = req.body;
    const result = await query(
      `INSERT INTO calendar_events (school_id, title, description, start_at, end_at, type, all_day, curriculum, class_ids, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.school_id, title, description, startDate, endDate, type, allDay || false, curriculum || null, classes || [], req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { next(e); }
});

// Update event
router.put('/events/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, type, allDay, curriculum, classes } = req.body;
    const result = await query(
      `UPDATE calendar_events SET
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         start_at = COALESCE($4, start_at),
         end_at = COALESCE($5, end_at),
         type = COALESCE($6, type),
         all_day = COALESCE($7, all_day),
         curriculum = COALESCE($8, curriculum),
         class_ids = COALESCE($9, class_ids),
         updated_by = $10,
         updated_at = NOW()
       WHERE id = $1 AND school_id = $11
       RETURNING *`,
      [id, title, description, startDate, endDate, type, allDay, curriculum, classes, req.user.id, req.user.school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { next(e); }
});

// Delete event
router.delete('/events/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM calendar_events WHERE id = $1 AND school_id = $2 RETURNING id',
      [id, req.user.school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: { id } });
  } catch (e) { next(e); }
});

module.exports = router;


