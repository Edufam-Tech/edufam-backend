const { query } = require('../../config/database');

class TeacherWebController {
  async getDashboard(req, res) {
    try {
      const teacherId = req.user.userId;
      const [classes, today] = await Promise.all([
        query(`
          SELECT c.id, c.name, s.name as subject_name
          FROM teacher_classes tc
          JOIN classes c ON tc.class_id = c.id
          JOIN subjects s ON tc.subject_id = s.id
          WHERE tc.teacher_id = $1 AND tc.is_active = true
          ORDER BY c.name
        `, [teacherId]),
        query(`
          SELECT te.period_start, te.period_end, c.name as class_name, s.name as subject_name
          FROM timetable_entries te
          JOIN classes c ON te.class_id = c.id
          JOIN subjects s ON te.subject_id = s.id
          WHERE te.teacher_id = $1 AND te.is_active = true AND te.date = CURRENT_DATE
          ORDER BY te.period_start
        `, [teacherId])
      ]);
      res.json({ success: true, data: { classes: classes.rows, today: today.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to load teacher dashboard' } }); }
  }

  async getMyClasses(req, res) {
    try {
      const teacherId = req.user.userId;
      const rows = await query(`
        SELECT c.id, c.name, c.curriculum_type
        FROM teacher_classes tc
        JOIN classes c ON tc.class_id = c.id
        WHERE tc.teacher_id = $1 AND tc.is_active = true
        ORDER BY c.name
      `, [teacherId]);
      res.json({ success: true, data: { classes: rows.rows.map(r => ({ id: r.id, name: r.name, curriculumType: r.curriculum_type })) } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch classes' } }); }
  }

  async getClassSubjects(req, res) {
    try {
      const teacherId = req.user.userId;
      const { classId } = req.params;
      const rows = await query(`
        SELECT s.id, s.name
        FROM teacher_classes tc
        JOIN subjects s ON tc.subject_id = s.id
        WHERE tc.teacher_id = $1 AND tc.class_id = $2 AND tc.is_active = true
        ORDER BY s.name
      `, [teacherId, classId]);
      res.json({ success: true, data: rows.rows });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch class subjects' } }); }
  }

  async getClassGradebook(req, res) {
    try {
      const { classId, subjectId } = req.params;
      const classRes = await query('SELECT id, name, curriculum_type FROM classes WHERE id = $1', [classId]);
      const subjRes = await query('SELECT id, name, curriculum_type FROM subjects WHERE id = $1', [subjectId]);
      const studentsRes = await query(`
        SELECT s.id, s.first_name, s.last_name, s.student_number as admission_number
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        WHERE e.class_id = $1 AND e.is_active = true
        ORDER BY s.first_name, s.last_name
      `, [classId]);
      const gradesRes = await query(`
        SELECT g.id as grade_id, g.student_id, g.marks_obtained, g.remarks, g.status
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

      res.json({
        success: true,
        data: {
          class: { id: classRes.rows[0]?.id, name: classRes.rows[0]?.name, curriculumType: classRes.rows[0]?.curriculum_type },
          subject: { id: subjRes.rows[0]?.id, name: subjRes.rows[0]?.name },
          students: studentsRes.rows.map(s => ({ id: s.id, firstName: s.first_name, lastName: s.last_name, admissionNumber: s.admission_number })),
          existingGrades: gradesRes.rows.map(r => ({ id: r.grade_id, studentId: r.student_id, grade: undefined, percentage: r.marks_obtained, status: r.status }))
        }
      });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to load gradebook' } }); }
  }

  async getClassGradingSheet(req, res) {
    try {
      const teacherId = req.user.userId;
      const { classId } = req.params;
      const classRes = await query('SELECT id, name, curriculum_type FROM classes WHERE id = $1', [classId]);
      if (classRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Class not found' } });

      // Subjects assigned to this teacher for this class
      const subjectsRes = await query(`
        SELECT s.id, s.name
        FROM teacher_classes tc
        JOIN subjects s ON tc.subject_id = s.id
        WHERE tc.teacher_id = $1 AND tc.class_id = $2 AND tc.is_active = true
        ORDER BY s.name
      `, [teacherId, classId]);

      const studentsRes = await query(`
        SELECT s.id, s.first_name, s.last_name, s.student_number as admission_number
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        WHERE e.class_id = $1 AND e.is_active = true
        ORDER BY s.first_name, s.last_name
      `, [classId]);

      const subjectIds = subjectsRes.rows.map(r => r.id);
      let existingBySubject = {};
      if (subjectIds.length > 0) {
        const gradesRes = await query(`
          SELECT g.id as grade_id, g.student_id, a.subject_id, g.marks_obtained, g.remarks, g.status
          FROM grades g
          JOIN assessments a ON a.id = g.assessment_id
          WHERE a.subject_id = ANY($1::uuid[]) AND g.student_id IN (
            SELECT student_id FROM enrollments WHERE class_id = $2 AND is_active = true
          )
          AND g.created_at = (
            SELECT MAX(g2.created_at)
            FROM grades g2
            JOIN assessments a2 ON a2.id = g2.assessment_id
            WHERE g2.student_id = g.student_id AND a2.subject_id = a.subject_id
          )
        `, [subjectIds, classId]);

        existingBySubject = gradesRes.rows.reduce((acc, r) => {
          if (!acc[r.subject_id]) acc[r.subject_id] = {};
          acc[r.subject_id][r.student_id] = {
            id: r.grade_id,
            percentage: r.marks_obtained,
            comments: r.remarks,
            status: r.status,
          };
          return acc;
        }, {});
      }

      res.json({
        success: true,
        data: {
          class: { id: classRes.rows[0].id, name: classRes.rows[0].name, curriculumType: classRes.rows[0].curriculum_type },
          subjects: subjectsRes.rows,
          students: studentsRes.rows.map(s => ({ id: s.id, firstName: s.first_name, lastName: s.last_name, admissionNumber: s.admission_number })),
          existingGradesBySubject: existingBySubject,
        }
      });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to load grading sheet' } }); }
  }

  async saveGrades(req, res) {
    try {
      const teacherId = req.user.userId;
      const { classId } = req.params;
      const {
        subjectId,
        grades,
        gradesBySubject,
        academicYearId,
        termId,
        categoryId,
        totalMarks
      } = req.body || {};

      // Helper: find or create assessment for given subject
      const ensureAssessment = async (subject) => {
        const findRes = await query(`
          SELECT id FROM assessments
          WHERE class_id = $1 AND subject_id = $2
            AND ($3::uuid IS NULL OR academic_year_id = $3)
            AND ($4::uuid IS NULL OR academic_term_id = $4)
            AND ($5::uuid IS NULL OR category_id = $5)
          ORDER BY created_at DESC
          LIMIT 1
        `, [classId, subject, academicYearId || null, termId || null, categoryId || null]);
        if (findRes.rows[0]?.id) return findRes.rows[0].id;
        const createRes = await query(`
          INSERT INTO assessments (
            school_id, academic_year_id, academic_term_id, class_id, subject_id,
            title, description, category_id, total_marks, pass_marks, assessment_date,
            duration_minutes, grading_scale_id, allow_decimal_marks, allow_negative_marks,
            is_final, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, CURRENT_DATE,
            NULL, NULL, false, false,
            false, $11
          ) RETURNING id
        `, [
          req.user.school_id, academicYearId || null, termId || null, classId, subject,
          'Grading Sheet Entry', 'Generated by grading sheet', categoryId || null, totalMarks || 100, Math.min(40, Number(totalMarks || 100)),
          teacherId
        ]);
        return createRes.rows[0].id;
      };

      const createdOrUpdatedGradeIds = [];

      if (gradesBySubject && typeof gradesBySubject === 'object') {
        for (const [subId, list] of Object.entries(gradesBySubject)) {
          const assessmentId = await ensureAssessment(subId);
          for (const g of Array.isArray(list) ? list : []) {
            const ins = await query(`
              INSERT INTO grades (student_id, assessment_id, marks_obtained, remarks, status, created_by, school_id)
              VALUES ($1, $2, $3, $4, 'draft', $5, $6)
              ON CONFLICT (student_id, assessment_id)
              DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
              RETURNING id
            `, [g.studentId, assessmentId, g.percentage || 0, g.comments || null, teacherId, req.user.school_id]);
            createdOrUpdatedGradeIds.push(ins.rows[0].id);
          }
        }
      } else {
        if (!Array.isArray(grades) || !subjectId) return res.status(400).json({ success: false, error: { message: 'subjectId and grades are required' } });
        const assessmentId = await ensureAssessment(subjectId);
        for (const g of grades) {
          const ins = await query(`
            INSERT INTO grades (student_id, assessment_id, marks_obtained, remarks, status, created_by, school_id)
            VALUES ($1, $2, $3, $4, 'draft', $5, $6)
            ON CONFLICT (student_id, assessment_id)
            DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `, [g.studentId, assessmentId, g.percentage || 0, g.comments || null, teacherId, req.user.school_id]);
          createdOrUpdatedGradeIds.push(ins.rows[0].id);
        }
      }

      res.json({ success: true, message: 'Grades saved as draft', data: { gradeIds: createdOrUpdatedGradeIds } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to save grades' } }); }
  }

  async submitGrades(req, res) {
    try {
      const teacherId = req.user.userId;
      const schoolId = req.user.school_id;
      const { classId } = req.params;
      const { gradesBySubject, academicYearId, termId, categoryId, totalMarks } = req.body || {};

      if (!gradesBySubject || typeof gradesBySubject !== 'object') {
        return res.status(400).json({ success: false, error: { message: 'gradesBySubject is required' } });
      }

      const ensureAssessment = async (subject) => {
        const findRes = await query(`
          SELECT id FROM assessments
          WHERE class_id = $1 AND subject_id = $2
            AND ($3::uuid IS NULL OR academic_year_id = $3)
            AND ($4::uuid IS NULL OR academic_term_id = $4)
            AND ($5::uuid IS NULL OR category_id = $5)
          ORDER BY created_at DESC
          LIMIT 1
        `, [classId, subject, academicYearId || null, termId || null, categoryId || null]);
        if (findRes.rows[0]?.id) return findRes.rows[0].id;
        const createRes = await query(`
          INSERT INTO assessments (
            school_id, academic_year_id, academic_term_id, class_id, subject_id,
            title, description, category_id, total_marks, pass_marks, assessment_date,
            duration_minutes, grading_scale_id, allow_decimal_marks, allow_negative_marks,
            is_final, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, CURRENT_DATE,
            NULL, NULL, false, false,
            false, $11
          ) RETURNING id
        `, [
          schoolId, academicYearId || null, termId || null, classId, subject,
          'Grading Sheet Submission', 'Submitted for approval', categoryId || null, totalMarks || 100, Math.min(40, Number(totalMarks || 100)),
          teacherId
        ]);
        return createRes.rows[0].id;
      };

      const submissionIds = [];

      for (const [subjectId, list] of Object.entries(gradesBySubject)) {
        const assessmentId = await ensureAssessment(subjectId);
        for (const g of Array.isArray(list) ? list : []) {
          await query(`
            INSERT INTO grades (student_id, assessment_id, marks_obtained, remarks, status, submitted_by, submitted_at, created_by, school_id)
            VALUES ($1, $2, $3, $4, 'submitted', $5, CURRENT_TIMESTAMP, $5, $6)
            ON CONFLICT (student_id, assessment_id)
            DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, remarks = EXCLUDED.remarks, status = 'submitted', submitted_by = $5, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          `, [g.studentId, assessmentId, g.percentage || 0, g.comments || null, teacherId, schoolId]);
        }
        const sub = await query(`
          INSERT INTO grade_submissions (school_id, class_id, subject_id, teacher_id, assessment_id, status, approval_status, submitted_at)
          VALUES ($1, $2, $3, $4, $5, 'submitted', 'pending', CURRENT_TIMESTAMP)
          RETURNING id
        `, [schoolId, classId, subjectId, teacherId, assessmentId]);
        submissionIds.push(sub.rows[0].id);
      }

      res.json({ success: true, message: 'Grades submitted for approval', data: { submissionIds } });
    } catch (e) {
      res.status(500).json({ success: false, error: { message: 'Failed to submit grades' } });
    }
  }

  async getAttendanceSummary(req, res) {
    try {
      const { classId } = req.params;
      const rows = await query(`
        SELECT date, COUNT(*) as total,
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
          COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
          COUNT(CASE WHEN status = 'late' THEN 1 END) as late
        FROM student_attendance
        WHERE class_id = $1 AND date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY date
        ORDER BY date DESC
      `, [classId]);
      res.json({ success: true, data: { summary: rows.rows } });
    } catch (e) { res.status(500).json({ success: false, error: { message: 'Failed to fetch attendance summary' } }); }
  }
}

module.exports = new TeacherWebController();


