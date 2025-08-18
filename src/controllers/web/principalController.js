const { query } = require('../../config/database');

class PrincipalWebController {
  async getDashboard(req, res) {
    try {
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      const [profile, metrics, tasks] = await Promise.all([
        query(`SELECT first_name, last_name FROM users WHERE id = $1`, [principalId]),
        query(`
          SELECT 
            (SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = true) as total_students,
            (SELECT COUNT(*) FROM users WHERE school_id = $1 AND user_type = 'staff' AND is_active = true) as total_teachers,
            (
              SELECT AVG(g.percentage)
              FROM grades g
              JOIN assessments a ON g.assessment_id = a.id
              WHERE a.school_id = $1
                AND a.academic_term_id = (SELECT id FROM academic_terms WHERE is_current = true LIMIT 1)
            ) as academic_performance
        `, [schoolId]),
        query(`
          SELECT 
            (SELECT COUNT(*) FROM grade_approvals WHERE school_id = $1 AND status = 'pending') as grade_approvals,
            (SELECT COUNT(*) FROM leave_requests WHERE school_id = $1 AND status = 'pending' AND requires_principal_approval = true) as leave_requests
        `, [schoolId])
      ]);

      const name = profile.rows[0]?.first_name || '';
      const currentHour = new Date().getHours();
      const greeting = `Good ${currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'}, ${name}`;

      res.json({
        success: true,
        data: {
          greeting,
          schoolMetrics: {
            totalStudents: parseInt(metrics.rows[0]?.total_students || 0, 10),
            totalTeachers: parseInt(metrics.rows[0]?.total_teachers || 0, 10),
            academicPerformance: parseFloat(metrics.rows[0]?.academic_performance || 0).toFixed(1)
          },
          pendingTasks: {
            gradeApprovals: parseInt(tasks.rows[0]?.grade_approvals || 0, 10),
            leaveRequests: parseInt(tasks.rows[0]?.leave_requests || 0, 10)
          }
        }
      });
    } catch (error) {
      console.error('Principal web dashboard error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to load dashboard' } });
    }
  }

  async getPendingGrades(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const rows = await query(`
        SELECT 
          gs.id,
          c.name as class_name,
          s.name as subject_name,
          u.first_name, u.last_name,
          a.title as assessment_name,
          a.category_id as assessment_type,
          a.total_marks,
          gs.submitted_at
        FROM grade_submissions gs
        JOIN assessments a ON gs.assessment_id = a.id
        LEFT JOIN classes c ON gs.class_id = c.id
        LEFT JOIN subjects s ON gs.subject_id = s.id
        LEFT JOIN users u ON gs.teacher_id = u.id
        WHERE gs.school_id = $1 AND gs.approval_status = 'pending'
        ORDER BY gs.submitted_at DESC
        LIMIT $2 OFFSET $3
      `, [schoolId, limit, offset]);

      res.json({ success: true, data: { submissions: rows.rows } });
    } catch (error) {
      console.error('Principal pending grades error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to fetch pending grades' } });
    }
  }

  async approveGrade(req, res) {
    try {
      const { submissionId } = req.params;
      const { comments, releaseDate } = req.body || {};
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      const found = await query(`
        SELECT 1 FROM grade_submissions WHERE id = $1 AND school_id = $2 AND approval_status = 'pending'
      `, [submissionId, schoolId]);
      if (found.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Submission not found' } });

      await query(`
        UPDATE grade_submissions 
        SET approval_status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, approval_comments = $2, grade_release_date = $3
        WHERE id = $4
      `, [principalId, comments || null, releaseDate || new Date(), submissionId]);

      // Mark related grades as approved
      await query(`
        UPDATE grades g
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE g.assessment_id = (SELECT assessment_id FROM grade_submissions WHERE id = $2) AND g.status = 'submitted'
      `, [principalId, submissionId]);

      res.json({ success: true, message: 'Grade approved' });
    } catch (error) {
      console.error('Approve grade error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to approve grade' } });
    }
  }

  async rejectGrade(req, res) {
    try {
      const { submissionId } = req.params;
      const { reason } = req.body || {};
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      if (!reason) return res.status(400).json({ success: false, error: { message: 'Reason required' } });

      const found = await query(`
        SELECT 1 FROM grade_submissions WHERE id = $1 AND school_id = $2 AND approval_status = 'pending'
      `, [submissionId, schoolId]);
      if (found.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Submission not found' } });

      await query(`
        UPDATE grade_submissions 
        SET approval_status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, approval_comments = $2
        WHERE id = $3
      `, [principalId, reason, submissionId]);

      res.json({ success: true, message: 'Grade rejected' });
    } catch (error) {
      console.error('Reject grade error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to reject grade' } });
    }
  }

  async overrideGrade(req, res) {
    try {
      const { gradeId } = req.params;
      const { marks, remarks } = req.body || {};
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      if (typeof marks !== 'number' || marks < 0) {
        return res.status(400).json({ success: false, error: { message: 'Valid marks required' } });
      }

      // Ensure grade belongs to this school and is approved/submitted
      const found = await query(`
        SELECT g.id
        FROM grades g
        JOIN assessments a ON a.id = g.assessment_id
        WHERE g.id = $1 AND a.school_id = $2 AND g.status IN ('submitted','approved')
      `, [gradeId, schoolId]);
      if (found.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Grade not found' } });

      await query(`
        UPDATE grades
        SET marks_obtained = $1, remarks = COALESCE($2, remarks), status = 'approved', approved_by = $3, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [marks, remarks || null, principalId, gradeId]);

      res.json({ success: true, message: 'Grade overridden and approved' });
    } catch (error) {
      console.error('Override grade error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to override grade' } });
    }
  }

  async releaseSubmission(req, res) {
    try {
      const { submissionId } = req.params;
      const schoolId = req.user.schoolId;

      const found = await query(`
        SELECT 1 FROM grade_submissions WHERE id = $1 AND school_id = $2 AND approval_status = 'approved'
      `, [submissionId, schoolId]);
      if (found.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Submission not approved' } });

      // Placeholder: notify parents; for now this is a no-op update
      // Optionally log a release event in future

      res.json({ success: true, message: 'Grades released to parents' });
    } catch (error) {
      console.error('Release submission error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to release grades' } });
    }
  }

  async getAttendanceOverview(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT 
          attendance_type,
          SUM(total_expected) as total_expected,
          SUM(present_count) as present_count,
          SUM(absent_count) as absent_count,
          SUM(late_count) as late_count
        FROM daily_attendance
        WHERE school_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY attendance_type
      `, [schoolId]);
      res.json({ success: true, data: { overview: rows.rows } });
    } catch (error) {
      console.error('Attendance overview error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to fetch attendance overview' } });
    }
  }

  async getAnnouncements(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const rows = await query(`
        SELECT * FROM announcements WHERE school_id = $1 ORDER BY created_at DESC LIMIT 20
      `, [schoolId]);
      res.json({ success: true, data: { announcements: rows.rows } });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: 'Failed to fetch announcements' } });
    }
  }

  async getClassGradingSheet(req, res) {
    try {
      const { classId } = req.params;
      const classRes = await query('SELECT id, name, curriculum_type FROM classes WHERE id = $1', [classId]);
      if (classRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Class not found' } });

      // Subjects offered in this class (any assigned teacher)
      const subjectsRes = await query(`
        SELECT DISTINCT s.id, s.name
        FROM teacher_classes tc
        JOIN subjects s ON tc.subject_id = s.id
        WHERE tc.class_id = $1 AND tc.is_active = true
        ORDER BY s.name
      `, [classId]);

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
    } catch (error) {
      console.error('Principal grading sheet error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to load grading sheet' } });
    }
  }

  async saveGrades(req, res) {
    try {
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;
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
          'Grading Sheet Entry (Principal)', 'Generated by principal grading sheet', categoryId || null, totalMarks || 100, Math.min(40, Number(totalMarks || 100)),
          principalId
        ]);
        return createRes.rows[0].id;
      };

      const affected = [];
      for (const [subjectId, list] of Object.entries(gradesBySubject)) {
        const assessmentId = await ensureAssessment(subjectId);
        for (const g of Array.isArray(list) ? list : []) {
          await query(`
            INSERT INTO grades (student_id, assessment_id, marks_obtained, remarks, status, created_by, school_id)
            VALUES ($1, $2, $3, $4, 'draft', $5, $6)
            ON CONFLICT (student_id, assessment_id)
            DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
            WHERE grades.status IN ('draft','rejected')
          `, [g.studentId, assessmentId, g.percentage || 0, g.comments || null, principalId, schoolId]);
        }
        // Track a draft submission under principal for visibility
        const existingDraft = await query(`
          SELECT id FROM grade_submissions
          WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND teacher_id = $4 AND assessment_id = $5 AND approval_status = 'pending' AND status = 'draft'
          ORDER BY submitted_at DESC LIMIT 1
        `, [schoolId, classId, subjectId, principalId, assessmentId]);
        if (existingDraft.rows[0]?.id) {
          await query(`UPDATE grade_submissions SET submitted_at = CURRENT_TIMESTAMP WHERE id = $1`, [existingDraft.rows[0].id]);
          affected.push(existingDraft.rows[0].id);
        } else {
          const ins = await query(`
            INSERT INTO grade_submissions (school_id, class_id, subject_id, teacher_id, assessment_id, status, approval_status, submitted_at)
            VALUES ($1, $2, $3, $4, $5, 'draft', 'pending', CURRENT_TIMESTAMP)
            RETURNING id
          `, [schoolId, classId, subjectId, principalId, assessmentId]);
          affected.push(ins.rows[0].id);
        }
      }

      res.json({ success: true, message: 'Grades saved as draft', data: { submissionIds: affected } });
    } catch (error) {
      console.error('Principal save grades error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to save grades' } });
    }
  }
}

module.exports = new PrincipalWebController();


