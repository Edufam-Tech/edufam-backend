const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class MobileTeacherController {
  // =============================================================================
  // TEACHER DASHBOARD - MOBILE OPTIMIZED
  // =============================================================================

  // Get teacher dashboard overview
  static async getDashboard(req, res, next) {
    try {
      const teacherId = req.user.userId;
      const schoolId = req.user.schoolId;

      const [
        teacherProfile,
        todaySchedule,
        myClasses,
        notifications,
        quickStats
      ] = await Promise.all([
        // Teacher profile
        query(`
          SELECT first_name, last_name, subjects_taught, photo_url
          FROM users 
          WHERE id = $1
        `, [teacherId]),

        // Today's timetable
        query(`
          SELECT 
            tt.period_number,
            tt.start_time,
            tt.end_time,
            c.name as class_name,
            s.name as subject_name,
            r.name as room_name,
            tt.topic,
            CASE 
              WHEN CURRENT_TIME < tt.start_time THEN 'upcoming'
              WHEN CURRENT_TIME BETWEEN tt.start_time AND tt.end_time THEN 'ongoing'
              ELSE 'completed'
            END as status
          FROM timetable_entries tt
          JOIN classes c ON tt.class_id = c.id
          JOIN subjects s ON tt.subject_id = s.id
          LEFT JOIN rooms r ON tt.room_id = r.id
          WHERE tt.teacher_id = $1 
            AND tt.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
            AND tt.is_active = true
          ORDER BY tt.period_number
        `, [teacherId]),

        // Teacher's classes summary
        query(`
          SELECT DISTINCT
            c.id,
            c.name,
            s.name as subject_name,
            (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.is_active = true) as student_count,
            (SELECT time_slot FROM timetable_entries WHERE teacher_id = $1 AND class_id = c.id AND day_of_week = (EXTRACT(DOW FROM CURRENT_DATE) + 1) % 7 LIMIT 1) as next_lesson,
            (SELECT COUNT(*) FROM assignments WHERE teacher_id = $1 AND class_id = c.id AND status = 'submitted' AND is_graded = false) as unmarked_assignments,
            (SELECT COUNT(*) FROM grade_submissions WHERE teacher_id = $1 AND class_id = c.id AND status = 'draft') as pending_grades
          FROM teacher_classes tc
          JOIN classes c ON tc.class_id = c.id
          JOIN subjects s ON tc.subject_id = s.id
          WHERE tc.teacher_id = $1 AND tc.is_active = true
        `, [teacherId]),

        // Recent notifications
        query(`
          SELECT 
            type,
            title,
            message,
            created_at,
            is_read
          FROM notifications
          WHERE user_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY created_at DESC
          LIMIT 5
        `, [teacherId]),

        // Quick statistics
        query(`
          SELECT 
            (SELECT COUNT(DISTINCT c.id) FROM teacher_classes tc JOIN classes c ON tc.class_id = c.id WHERE tc.teacher_id = $1 AND tc.is_active = true) as total_classes,
            (SELECT COUNT(*) FROM students st JOIN teacher_classes tc ON st.class_id = tc.class_id WHERE tc.teacher_id = $1 AND st.is_active = true) as total_students,
            (SELECT COUNT(*) FROM timetable_entries WHERE teacher_id = $1 AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE)) as lessons_today,
            (SELECT COUNT(*) FROM assignments WHERE teacher_id = $1 AND status = 'submitted' AND is_graded = false) as pending_grading,
            (SELECT COUNT(*) FROM conversations c JOIN conversation_participants cp ON c.id = cp.conversation_id WHERE cp.user_id = $1 AND c.unread_count > 0) as unread_messages
        `, [teacherId])
      ]);

      const profile = teacherProfile.rows[0];
      const stats = quickStats.rows[0];
      
      const currentTime = new Date().getHours();
      const greeting = `Good ${currentTime < 12 ? 'morning' : currentTime < 17 ? 'afternoon' : 'evening'}, ${profile.first_name}`;

      res.json({
        success: true,
        data: {
          greeting,
          teacherName: `${profile.first_name} ${profile.last_name}`,
          subjectsTaught: profile.subjects_taught ? JSON.parse(profile.subjects_taught) : [],
          photo: profile.photo_url,
          todaySchedule: todaySchedule.rows.map(period => ({
            period: period.period_number,
            time: `${period.start_time.slice(0, 5)}-${period.end_time.slice(0, 5)}`,
            class: period.class_name,
            subject: period.subject_name,
            room: period.room_name,
            topic: period.topic,
            status: period.status
          })),
          myClasses: myClasses.rows.map(cls => ({
            id: cls.id,
            name: cls.name,
            subject: cls.subject_name,
            studentCount: parseInt(cls.student_count),
            nextLesson: cls.next_lesson ? `Tomorrow ${cls.next_lesson}` : 'No upcoming lesson',
            pendingTasks: {
              unmarkedAssignments: parseInt(cls.unmarked_assignments),
              gradeSubmissions: parseInt(cls.pending_grades)
            }
          })),
          notifications: notifications.rows.map(notif => ({
            type: notif.type,
            title: notif.title,
            message: notif.message,
            timestamp: notif.created_at,
            isRead: notif.is_read
          })),
          quickStats: {
            totalStudents: parseInt(stats.total_students),
            totalClasses: parseInt(stats.total_classes),
            lessonsToday: parseInt(stats.lessons_today),
            pendingGrading: parseInt(stats.pending_grading),
            parentMessages: parseInt(stats.unread_messages)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INTERACTIVE TIMETABLE
  // =============================================================================

  // Get teacher timetable
  static async getTimetable(req, res, next) {
    try {
      const teacherId = req.user.userId;
      const { week = 'current', view = 'week' } = req.query;

      const startDate = week === 'next' ? 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : 
        new Date();

      // Calculate week start (Monday)
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

      const [timetableEntries, swaps, upcomingChanges] = await Promise.all([
        // Get timetable entries for the week
        query(`
          SELECT 
            tt.*,
            c.name as class_name,
            s.name as subject_name,
            r.name as room_name,
            r.capacity,
            (SELECT COUNT(*) FROM students WHERE class_id = c.id AND is_active = true) as student_count
          FROM timetable_entries tt
          JOIN classes c ON tt.class_id = c.id
          JOIN subjects s ON tt.subject_id = s.id
          LEFT JOIN rooms r ON tt.room_id = r.id
          WHERE tt.teacher_id = $1 
            AND tt.is_active = true
          ORDER BY tt.day_of_week, tt.period_number
        `, [teacherId]),

        // Get approved/pending swaps
        query(`
          SELECT 
            ts.*,
            u.first_name as swap_with_first_name,
            u.last_name as swap_with_last_name,
            original_tt.start_time as original_time,
            original_tt.period_number
          FROM timetable_swaps ts
          JOIN users u ON ts.swap_with_teacher_id = u.id
          JOIN timetable_entries original_tt ON ts.original_timetable_id = original_tt.id
          WHERE (ts.requested_by = $1 OR ts.swap_with_teacher_id = $1)
            AND ts.status IN ('pending', 'approved')
            AND ts.swap_date >= CURRENT_DATE
          ORDER BY ts.swap_date
        `, [teacherId]),

        // Get upcoming room/schedule changes
        query(`
          SELECT 
            sc.*,
            c.name as class_name,
            s.name as subject_name,
            old_room.name as old_room_name,
            new_room.name as new_room_name
          FROM schedule_changes sc
          JOIN classes c ON sc.class_id = c.id
          JOIN subjects s ON sc.subject_id = s.id
          LEFT JOIN rooms old_room ON sc.old_room_id = old_room.id
          LEFT JOIN rooms new_room ON sc.new_room_id = new_room.id
          WHERE sc.teacher_id = $1 
            AND sc.change_date >= CURRENT_DATE
            AND sc.status = 'approved'
          ORDER BY sc.change_date
        `, [teacherId])
      ]);

      // Group timetable by days
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const timetable = [];

      for (let dayIndex = 1; dayIndex <= 5; dayIndex++) { // Monday to Friday
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex - 1);
        
        const dayEntries = timetableEntries.rows.filter(entry => entry.day_of_week === dayIndex);
        
        timetable.push({
          day: daysOfWeek[dayIndex],
          date: dayDate.toISOString().split('T')[0],
          periods: dayEntries.map(entry => ({
            periodNumber: entry.period_number,
            time: `${entry.start_time.slice(0, 5)}-${entry.end_time.slice(0, 5)}`,
            class: entry.class_name,
            subject: entry.subject_name,
            room: entry.room_name,
            capacity: entry.capacity,
            studentCount: parseInt(entry.student_count),
            topic: entry.topic,
            status: MobileTeacherController.getPeriodStatus(entry, dayDate),
            resources: entry.resources ? JSON.parse(entry.resources) : []
          }))
        });
      }

      res.json({
        success: true,
        data: {
          week,
          weekStart: weekStart.toISOString().split('T')[0],
          timetable,
          swaps: swaps.rows.map(swap => ({
            id: swap.id,
            originalPeriod: swap.period_number,
            swappedWith: `${swap.swap_with_first_name} ${swap.swap_with_last_name}`,
            date: swap.swap_date,
            time: swap.original_time,
            status: swap.status,
            reason: swap.reason
          })),
          upcomingChanges: upcomingChanges.rows.map(change => ({
            date: change.change_date,
            class: change.class_name,
            subject: change.subject_name,
            change: `${change.old_room_name || 'TBD'} → ${change.new_room_name || 'TBD'}`,
            reason: change.reason,
            type: change.change_type
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Request timetable swap
  static async requestTimetableSwap(req, res, next) {
    try {
      const { periodId, swapWithTeacherId, date, reason } = req.body;
      const teacherId = req.user.userId;

      if (!periodId || !swapWithTeacherId || !date || !reason) {
        throw new ValidationError('All swap details are required');
      }

      // Verify the period exists and belongs to teacher
      const period = await query(`
        SELECT * FROM timetable_entries 
        WHERE id = $1 AND teacher_id = $2
      `, [periodId, teacherId]);

      if (period.rows.length === 0) {
        throw new NotFoundError('Timetable period not found');
      }

      // Create swap request
      const result = await query(`
        INSERT INTO timetable_swaps (
          original_timetable_id, requested_by, swap_with_teacher_id,
          swap_date, reason, status
        ) VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `, [periodId, teacherId, swapWithTeacherId, date, reason]);

      res.status(201).json({
        success: true,
        message: 'Timetable swap request submitted',
        data: {
          swapId: result.rows[0].id,
          status: 'pending',
          swapDate: date
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update period topic
  static async updatePeriodTopic(req, res, next) {
    try {
      const { periodId, topic, resources = [] } = req.body;
      const teacherId = req.user.userId;

      if (!periodId || !topic) {
        throw new ValidationError('Period ID and topic are required');
      }

      // Update the timetable entry
      await query(`
        UPDATE timetable_entries 
        SET topic = $1, 
            resources = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND teacher_id = $4
      `, [topic, JSON.stringify(resources), periodId, teacherId]);

      res.json({
        success: true,
        message: 'Period topic updated successfully',
        data: {
          periodId,
          topic,
          resources
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // GRADEBOOK MANAGEMENT
  // =============================================================================

  // Get teacher's classes for gradebook
  static async getGradebookClasses(req, res, next) {
    try {
      const teacherId = req.user.userId;

      const classes = await query(`
        SELECT DISTINCT
          c.id,
          c.name,
          s.name as subject_name,
          tc.academic_year,
          tc.term,
          (SELECT COUNT(*) FROM students WHERE class_id = c.id AND is_active = true) as student_count
        FROM teacher_classes tc
        JOIN classes c ON tc.class_id = c.id
        JOIN subjects s ON tc.subject_id = s.id
        WHERE tc.teacher_id = $1 AND tc.is_active = true
        ORDER BY c.name
      `, [teacherId]);

      const classesWithAssessments = await Promise.all(classes.rows.map(async (cls) => {
        const assessments = await query(`
          SELECT 
            a.id,
            a.name,
            a.assessment_type,
            a.date_conducted,
            a.total_marks,
            gs.status as grade_status,
            gs.approval_status,
            (SELECT COUNT(*) FROM student_grades WHERE assessment_id = a.id) as grade_count,
            (SELECT AVG(score) FROM student_grades WHERE assessment_id = a.id) as average_score
          FROM assessments a
          LEFT JOIN grade_submissions gs ON a.id = gs.assessment_id
          WHERE a.class_id = $1 AND a.teacher_id = $2
          ORDER BY a.date_conducted DESC
        `, [cls.id, teacherId]);

        return {
          id: cls.id,
          name: cls.name,
          subject: cls.subject_name,
          studentCount: parseInt(cls.student_count),
          academicYear: cls.academic_year,
          term: cls.term,
          assessments: assessments.rows.map(assessment => ({
            id: assessment.id,
            name: assessment.name,
            type: assessment.assessment_type,
            date: assessment.date_conducted,
            totalMarks: assessment.total_marks,
            status: assessment.grade_status || 'not_started',
            approvalStatus: assessment.approval_status || 'not_submitted',
            gradeCount: parseInt(assessment.grade_count || 0),
            average: parseFloat(assessment.average_score || 0).toFixed(1)
          }))
        };
      }));

      res.json({
        success: true,
        data: {
          classes: classesWithAssessments
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get students for grading
  static async getClassStudentsForGrading(req, res, next) {
    try {
      const { classId } = req.params;
      const { assessmentId } = req.query;
      const teacherId = req.user.userId;

      // Verify teacher has access to this class
      const access = await query(`
        SELECT 1 FROM teacher_classes 
        WHERE teacher_id = $1 AND class_id = $2 AND is_active = true
      `, [teacherId, classId]);

      if (access.rows.length === 0) {
        throw new ValidationError('You do not have access to this class');
      }

      const [assessment, students] = await Promise.all([
        // Get assessment details
        query(`
          SELECT * FROM assessments 
          WHERE id = $1 AND class_id = $2 AND teacher_id = $3
        `, [assessmentId, classId, teacherId]),

        // Get students with their grades (if any)
        query(`
          SELECT 
            s.id,
            s.first_name,
            s.last_name,
            s.admission_number,
            s.photo_url,
            sg.score as current_score,
            sg.grade_letter as current_grade,
            sg.comments as current_comments,
            sg.is_saved,
            (SELECT AVG(attendance_percentage) FROM student_attendance WHERE student_id = s.id AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)) as attendance,
            (SELECT AVG(score) FROM student_grades sg2 
             JOIN assessments a2 ON sg2.assessment_id = a2.id
             WHERE sg2.student_id = s.id AND a2.class_id = $2 AND a2.teacher_id = $3 AND a2.id != $1) as previous_average
          FROM students s
          LEFT JOIN student_grades sg ON s.id = sg.student_id AND sg.assessment_id = $1
          WHERE s.class_id = $2 AND s.is_active = true
          ORDER BY s.last_name, s.first_name
        `, [assessmentId, classId, teacherId])
      ]);

      if (assessment.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      const assessmentData = assessment.rows[0];

      res.json({
        success: true,
        data: {
          assessment: {
            id: assessmentData.id,
            name: assessmentData.name,
            type: assessmentData.assessment_type,
            totalMarks: assessmentData.total_marks,
            date: assessmentData.date_conducted
          },
          students: students.rows.map(student => ({
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            admissionNumber: student.admission_number,
            photo: student.photo_url,
            currentGrade: {
              score: student.current_score,
              grade: student.current_grade,
              comments: student.current_comments,
              status: student.is_saved ? 'saved' : 'not_saved'
            },
            previousAverage: parseFloat(student.previous_average || 0).toFixed(1),
            attendance: parseFloat(student.attendance || 0).toFixed(1)
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Save grades (draft)
  static async saveGrades(req, res, next) {
    try {
      const { assessmentId, grades, saveAsDraft = true } = req.body;
      const teacherId = req.user.userId;

      if (!assessmentId || !grades || !Array.isArray(grades)) {
        throw new ValidationError('Assessment ID and grades array are required');
      }

      // Verify teacher owns this assessment
      const assessment = await query(`
        SELECT * FROM assessments 
        WHERE id = $1 AND teacher_id = $2
      `, [assessmentId, teacherId]);

      if (assessment.rows.length === 0) {
        throw new ValidationError('Assessment not found or access denied');
      }

      // Save or update grades
      const gradePromises = grades.map(async (grade) => {
        const { studentId, score, comments = '' } = grade;
        
        // Calculate grade letter based on score
        const gradeLetter = MobileTeacherController.calculateGradeLetter(score);

        return query(`
          INSERT INTO student_grades (
            student_id, assessment_id, score, grade_letter, comments, is_saved, teacher_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (student_id, assessment_id) 
          DO UPDATE SET 
            score = EXCLUDED.score,
            grade_letter = EXCLUDED.grade_letter,
            comments = EXCLUDED.comments,
            is_saved = EXCLUDED.is_saved,
            updated_at = CURRENT_TIMESTAMP
        `, [studentId, assessmentId, score, gradeLetter, comments, saveAsDraft, teacherId]);
      });

      await Promise.all(gradePromises);

      res.json({
        success: true,
        message: saveAsDraft ? 'Grades saved as draft' : 'Grades saved successfully',
        data: {
          assessmentId,
          gradesCount: grades.length,
          saveAsDraft
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Submit grades for approval
  static async submitGrades(req, res, next) {
    try {
      const { assessmentId, classId, finalCheck } = req.body;
      const teacherId = req.user.userId;

      if (!assessmentId || !classId) {
        throw new ValidationError('Assessment ID and class ID are required');
      }

      // Verify all students have grades
      const gradeCheck = await query(`
        SELECT 
          COUNT(DISTINCT s.id) as total_students,
          COUNT(DISTINCT sg.student_id) as graded_students
        FROM students s
        LEFT JOIN student_grades sg ON s.id = sg.student_id AND sg.assessment_id = $1
        WHERE s.class_id = $2 AND s.is_active = true
      `, [assessmentId, classId]);

      const { total_students, graded_students } = gradeCheck.rows[0];
      
      if (parseInt(total_students) !== parseInt(graded_students)) {
        throw new ValidationError(`Only ${graded_students} out of ${total_students} students have been graded`);
      }

      // Create grade submission
      const result = await query(`
        INSERT INTO grade_submissions (
          assessment_id, class_id, subject_id, teacher_id, school_id,
          status, submission_notes, submitted_at
        ) VALUES (
          $1, $2, 
          (SELECT subject_id FROM teacher_classes WHERE teacher_id = $3 AND class_id = $2 LIMIT 1),
          $3, $4, 'submitted', $5, CURRENT_TIMESTAMP
        )
        RETURNING *
      `, [assessmentId, classId, teacherId, req.user.schoolId, JSON.stringify(finalCheck)]);

      // Mark all grades as submitted
      await query(`
        UPDATE student_grades 
        SET is_saved = false, grade_submission_id = $1
        WHERE assessment_id = $2
      `, [result.rows[0].id, assessmentId]);

      res.json({
        success: true,
        message: 'Grades submitted for approval',
        data: {
          submissionId: result.rows[0].id,
          status: 'submitted',
          submittedAt: result.rows[0].submitted_at
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // QUICK ATTENDANCE
  // =============================================================================

  // Get current class for attendance
  static async getCurrentClassForAttendance(req, res, next) {
    try {
      const teacherId = req.user.userId;

      // Find current period
      const currentPeriod = await query(`
        SELECT 
          tt.*,
          c.name as class_name,
          s.name as subject_name
        FROM timetable_entries tt
        JOIN classes c ON tt.class_id = c.id
        JOIN subjects s ON tt.subject_id = s.id
        WHERE tt.teacher_id = $1 
          AND tt.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
          AND CURRENT_TIME BETWEEN tt.start_time AND tt.end_time
        LIMIT 1
      `, [teacherId]);

      if (currentPeriod.rows.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No active class period at this time'
          }
        });
      }

      const period = currentPeriod.rows[0];

      // Get students for the class
      const students = await query(`
        SELECT 
          s.id,
          s.first_name,
          s.last_name,
          s.photo_url,
          s.roll_number,
          sa.status as attendance_status,
          (SELECT AVG(CASE WHEN status = 'present' THEN 100 WHEN status = 'late' THEN 50 ELSE 0 END) 
           FROM student_attendance 
           WHERE student_id = s.id AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)) as monthly_attendance
        FROM students s
        LEFT JOIN student_attendance sa ON s.id = sa.student_id 
          AND sa.date = CURRENT_DATE AND sa.period = $1
        WHERE s.class_id = $2 AND s.is_active = true
        ORDER BY s.roll_number, s.last_name, s.first_name
      `, [period.period_number, period.class_id]);

      res.json({
        success: true,
        data: {
          class: {
            id: period.class_id,
            name: period.class_name,
            period: period.period_number,
            subject: period.subject_name,
            time: `${period.start_time.slice(0, 5)}-${period.end_time.slice(0, 5)}`
          },
          students: students.rows.map(student => ({
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            photo: student.photo_url,
            rollNumber: student.roll_number,
            status: student.attendance_status || 'not_marked',
            monthlyAttendance: parseFloat(student.monthly_attendance || 0).toFixed(0)
          })),
          quickActions: {
            markAllPresent: true,
            totalStudents: students.rows.length,
            markedCount: students.rows.filter(s => s.attendance_status).length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark attendance
  static async markAttendance(req, res, next) {
    try {
      const { classId, period, date, attendance } = req.body;
      const teacherId = req.user.userId;

      if (!classId || !period || !date || !attendance || !Array.isArray(attendance)) {
        throw new ValidationError('All attendance details are required');
      }

      // Verify teacher has access to this class
      const access = await query(`
        SELECT 1 FROM teacher_classes 
        WHERE teacher_id = $1 AND class_id = $2 AND is_active = true
      `, [teacherId, classId]);

      if (access.rows.length === 0) {
        throw new ValidationError('You do not have access to this class');
      }

      // Save attendance records
      const attendancePromises = attendance.map(async (record) => {
        const { studentId, status, reason = null } = record;

        return query(`
          INSERT INTO student_attendance (
            student_id, class_id, date, period, status, reason, marked_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (student_id, date, period)
          DO UPDATE SET 
            status = EXCLUDED.status,
            reason = EXCLUDED.reason,
            marked_by = EXCLUDED.marked_by,
            updated_at = CURRENT_TIMESTAMP
        `, [studentId, classId, date, period, status, reason, teacherId]);
      });

      await Promise.all(attendancePromises);

      // Calculate attendance summary
      const presentCount = attendance.filter(a => a.status === 'present').length;
      const absentCount = attendance.filter(a => a.status === 'absent').length;
      const lateCount = attendance.filter(a => a.status === 'late').length;

      res.json({
        success: true,
        message: 'Attendance marked successfully',
        data: {
          classId,
          period,
          date,
          summary: {
            total: attendance.length,
            present: presentCount,
            absent: absentCount,
            late: lateCount,
            percentage: ((presentCount + lateCount) / attendance.length * 100).toFixed(1)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Quick mark individual student
  static async quickMarkAttendance(req, res, next) {
    try {
      const { classId, period, studentId, status } = req.body;
      const teacherId = req.user.userId;

      await query(`
        INSERT INTO student_attendance (
          student_id, class_id, date, period, status, marked_by
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
        ON CONFLICT (student_id, date, period)
        DO UPDATE SET 
          status = EXCLUDED.status,
          marked_by = EXCLUDED.marked_by,
          updated_at = CURRENT_TIMESTAMP
      `, [studentId, classId, period, status, teacherId]);

      res.json({
        success: true,
        message: 'Student attendance updated',
        data: {
          studentId,
          status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PARENT COMMUNICATION
  // =============================================================================

  // Get teacher's conversations with parents
  static async getParentConversations(req, res, next) {
    try {
      const teacherId = req.user.userId;

      const conversations = await query(`
        SELECT DISTINCT
          c.id,
          c.subject,
          c.last_message_at,
          c.unread_count,
          parent.first_name as parent_first_name,
          parent.last_name as parent_last_name,
          parent.photo_url as parent_photo,
          students_list.children,
          lm.content as last_message_content,
          lm.sender_id = $1 as last_message_from_teacher
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users parent ON cp.user_id = parent.id AND parent.user_type = 'parent'
        JOIN (
          SELECT 
            p.id as parent_id,
            STRING_AGG(s.first_name || ' ' || s.last_name || ' - ' || cl.name, ', ') as children
          FROM users p
          JOIN parent_students ps ON p.id = ps.parent_id
          JOIN students s ON ps.student_id = s.id
          JOIN classes cl ON s.class_id = cl.id
          JOIN teacher_classes tc ON cl.id = tc.class_id
          WHERE tc.teacher_id = $1 AND p.user_type = 'parent'
          GROUP BY p.id
        ) students_list ON parent.id = students_list.parent_id
        LEFT JOIN (
          SELECT DISTINCT ON (conversation_id) 
            conversation_id, content, sender_id, created_at
          FROM messages
          ORDER BY conversation_id, created_at DESC
        ) lm ON c.id = lm.conversation_id
        WHERE cp.user_id = $1
        ORDER BY c.last_message_at DESC
      `, [teacherId]);

      res.json({
        success: true,
        data: {
          conversations: conversations.rows.map(conv => ({
            id: conv.id,
            parent: {
              name: `${conv.parent_first_name} ${conv.parent_last_name}`,
              photo: conv.parent_photo,
              children: conv.children ? conv.children.split(', ') : []
            },
            subject: conv.subject,
            lastMessage: {
              text: conv.last_message_content || 'No messages yet',
              time: conv.last_message_at,
              sender: conv.last_message_from_teacher ? 'teacher' : 'parent'
            },
            unread: conv.unread_count || 0
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send message to parent
  static async sendMessageToParent(req, res, next) {
    try {
      const { conversationId, message, attachments = [] } = req.body;
      const teacherId = req.user.userId;

      if (!conversationId || !message) {
        throw new ValidationError('Conversation ID and message are required');
      }

      // Send message
      const result = await query(`
        INSERT INTO messages (
          conversation_id, sender_id, content, attachments, message_type
        ) VALUES ($1, $2, $3, $4, 'text')
        RETURNING *
      `, [conversationId, teacherId, message, JSON.stringify(attachments)]);

      // Update conversation
      await query(`
        UPDATE conversations 
        SET last_message_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [conversationId]);

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: result.rows[0].id,
          sentAt: result.rows[0].created_at
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Broadcast message to class parents
  static async broadcastToClassParents(req, res, next) {
    try {
      const { classId, subject, message, targetParents = 'all' } = req.body;
      const teacherId = req.user.userId;

      if (!classId || !subject || !message) {
        throw new ValidationError('Class ID, subject, and message are required');
      }

      // Get parents for the class
      let parentQuery = `
        SELECT DISTINCT p.id, p.first_name, p.last_name, p.email
        FROM users p
        JOIN parent_students ps ON p.id = ps.parent_id
        JOIN students s ON ps.student_id = s.id
        WHERE s.class_id = $1 AND p.user_type = 'parent' AND p.is_active = true
      `;

      const parents = await query(parentQuery, [classId]);

      if (parents.rows.length === 0) {
        throw new ValidationError('No parents found for this class');
      }

      // Create broadcast record
      const broadcast = await query(`
        INSERT INTO message_broadcasts (
          sender_id, class_id, subject, message, target_audience, recipient_count
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [teacherId, classId, subject, message, targetParents, parents.rows.length]);

      // Send to each parent
      const messagePromises = parents.rows.map(async (parent) => {
        // Create or get conversation
        const conversation = await query(`
          INSERT INTO conversations (
            subject, conversation_type, created_by
          ) VALUES ($1, 'teacher_parent', $2)
          ON CONFLICT (subject, created_by) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [subject, teacherId]);

        const conversationId = conversation.rows[0].id;

        // Add participants
        await query(`
          INSERT INTO conversation_participants (conversation_id, user_id)
          VALUES ($1, $2), ($1, $3)
          ON CONFLICT (conversation_id, user_id) DO NOTHING
        `, [conversationId, teacherId, parent.id]);

        // Send message
        return query(`
          INSERT INTO messages (
            conversation_id, sender_id, content, message_type, broadcast_id
          ) VALUES ($1, $2, $3, 'broadcast', $4)
        `, [conversationId, teacherId, message, broadcast.rows[0].id]);
      });

      await Promise.all(messagePromises);

      res.json({
        success: true,
        message: `Message broadcast to ${parents.rows.length} parents`,
        data: {
          broadcastId: broadcast.rows[0].id,
          recipientCount: parents.rows.length,
          subject
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Calculate grade letter from score
  static calculateGradeLetter(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
  }

  // Determine period status
  static getPeriodStatus(entry, dayDate) {
    const now = new Date();
    const entryDate = new Date(dayDate);
    entryDate.setHours(parseInt(entry.start_time.split(':')[0]), parseInt(entry.start_time.split(':')[1]));
    
    const endDate = new Date(dayDate);
    endDate.setHours(parseInt(entry.end_time.split(':')[0]), parseInt(entry.end_time.split(':')[1]));

    if (now < entryDate) return 'upcoming';
    if (now >= entryDate && now <= endDate) return 'ongoing';
    return 'completed';
  }
}

module.exports = MobileTeacherController;