const { query } = require('../config/database');
const { DatabaseError, ValidationError } = require('../middleware/errorHandler');

class GradebookController {
  static async getGradebookData(req, res, next) {
    try {
      const { classId, subjectId } = req.params;
      if (!classId || !subjectId) throw new ValidationError('classId and subjectId are required');

      // Class info
      const classRes = await query('SELECT id, name, curriculum_type FROM classes WHERE id = $1', [classId]);
      if (classRes.rows.length === 0) throw new ValidationError('Class not found');
      const cls = classRes.rows[0];

      // Subject info
      const subjRes = await query('SELECT id, name, curriculum_type FROM subjects WHERE id = $1', [subjectId]);
      if (subjRes.rows.length === 0) throw new ValidationError('Subject not found');
      const subject = subjRes.rows[0];

      // Students in class (active enrollments)
      const studentsRes = await query(`
        SELECT s.id, s.first_name, s.last_name, s.student_number as admission_number
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        WHERE e.class_id = $1 AND e.is_active = true
        ORDER BY s.first_name, s.last_name
      `, [classId]);

      // Latest grade per student for this subject (via assessments)
      const gradesRes = await query(`
        SELECT g.student_id, g.marks_obtained, g.remarks, g.status, a.id as assessment_id
        FROM grades g
        JOIN assessments a ON a.id = g.assessment_id
        WHERE a.subject_id = $1 AND g.student_id IN (
          SELECT student_id FROM enrollments WHERE class_id = $2 AND is_active = true
        )
        AND g.created_at = (
          SELECT MAX(g2.created_at) FROM grades g2 JOIN assessments a2 ON a2.id = g2.assessment_id
          WHERE g2.student_id = g.student_id AND a2.subject_id = $1
        )
      `, [subjectId, classId]);

      const existingGrades = gradesRes.rows.map((r) => ({
        studentId: r.student_id,
        percentage: r.marks_obtained,
        comments: r.remarks,
        status: r.status,
        assessmentId: r.assessment_id,
      }));

      res.json({
        success: true,
        data: {
          class: { id: cls.id, name: cls.name, curriculumType: cls.curriculum_type },
          subject: { id: subject.id, name: subject.name, curriculumType: subject.curriculum_type },
          students: studentsRes.rows.map((s) => ({
            id: s.id,
            firstName: s.first_name,
            lastName: s.last_name,
            admissionNumber: s.admission_number,
          })),
          existingGrades,
        }
      });
    } catch (error) {
      if (error.name === 'ValidationError') return next(error);
      next(new DatabaseError('Failed to load gradebook data'));
    }
  }
}

module.exports = GradebookController;


