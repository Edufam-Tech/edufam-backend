const express = require('express');
const router = express.Router();
const { authenticate, requireUserType } = require('../middleware/auth');
const { query } = require('../config/database');

// Web dashboards for role-specific summaries used by school app UI
router.use(authenticate);
router.use(requireUserType('school_user'));

// Helper: safe query wrapper returning [] on missing tables
async function safeQuery(sql, params = []) {
  try {
    const result = await query(sql, params);
    return result.rows || [];
  } catch (error) {
    if (error && (error.code === '42P01' || error.code === '42703' || error.code === '42501')) {
      return [];
    }
    throw error;
  }
}

// Teacher dashboard
router.get('/teacher/dashboard', async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.userId;

    const classes = await safeQuery(`
      SELECT c.id, c.name, c.curriculum_type as curriculumType,
             COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.is_active = true), 0)::int AS currentEnrollment,
             c.capacity,
             c.grade_level as gradeLevel,
             (SELECT COUNT(*) FROM class_subjects cs WHERE cs.class_id = c.id) AS subjects
      FROM classes c
      JOIN teacher_assignments ta ON ta.class_id = c.id AND ta.teacher_id = $2
      WHERE c.school_id = $1 AND COALESCE(c.is_active, true) = true
      ORDER BY c.name
    `, [schoolId, userId]);

    const today = await safeQuery(`
      SELECT te.id,
             te.start_time,
             te.end_time,
             c.name as class_name,
             s.name as subject_name,
             te.period_number,
             te.day_of_week
      FROM timetable_entries te
      JOIN timetable_versions tv ON te.version_id = tv.id AND tv.is_published = true AND tv.is_active = true
      LEFT JOIN classes c ON te.class_id = c.id
      LEFT JOIN subjects s ON te.subject_id = s.id
      WHERE te.school_id = $1 AND te.teacher_id = $2
      ORDER BY te.day_of_week, te.period_number
    `, [schoolId, userId]);

    res.json({
      success: true,
      data: {
        classes,
        today
      }
    });
  } catch (error) {
    next(error);
  }
});

// Principal dashboard (minimal, already used elsewhere)
router.get('/principal/dashboard', async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId;
    const metrics = await safeQuery(`
      SELECT 
        (SELECT COUNT(*) FROM students s WHERE s.school_id = $1) as total_students,
        (SELECT COUNT(*) FROM classes c WHERE c.school_id = $1) as total_classes,
        (SELECT COUNT(*) FROM staff st WHERE st.school_id = $1 AND st.role = 'teacher') as total_teachers
    `, [schoolId]);
    const m = metrics[0] || {};
    res.json({ success: true, data: { schoolMetrics: m, pendingTasks: {} } });
  } catch (error) { next(error); }
});

// HR and Finance endpoints can be expanded later if needed

module.exports = router;


