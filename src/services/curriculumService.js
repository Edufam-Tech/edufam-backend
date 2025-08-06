const { query } = require('../config/database');
const { DatabaseError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Curriculum Service
 * Handles curriculum-specific operations for CBC, IGCSE, 8-4-4, IB and other educational systems
 */
class CurriculumService {

  /**
   * Curriculum Systems Management
   */

  // Get all available curriculum systems
  async getCurriculumSystems(filters = {}) {
    try {
      let whereConditions = ['is_active = true'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.country) {
        paramCount++;
        whereConditions.push(`country_origin = $${paramCount}`);
        queryParams.push(filters.country);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(curriculum_name ILIKE $${paramCount} OR full_name ILIKE $${paramCount} OR curriculum_code ILIKE $${paramCount})`);
        queryParams.push(`%${filters.search}%`);
      }

      const result = await query(`
        SELECT 
          cs.*,
          COUNT(sci.id) as schools_using,
          COUNT(scp.id) as students_enrolled
        FROM curriculum_systems cs
        LEFT JOIN school_curriculum_implementation sci ON sci.curriculum_id = cs.id AND sci.is_active = true
        LEFT JOIN student_curriculum_progress scp ON scp.curriculum_id = cs.id AND scp.is_current = true
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY cs.id
        ORDER BY cs.curriculum_name
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get curriculum systems', error);
    }
  }

  // Get curriculum system details
  async getCurriculumSystem(curriculumId) {
    try {
      const result = await query(`
        SELECT 
          cs.*,
          COUNT(DISTINCT sci.school_id) as schools_using,
          COUNT(DISTINCT scp.student_id) as students_enrolled,
          COUNT(DISTINCT cgl.id) as total_grade_levels,
          COUNT(DISTINCT csub.id) as total_subjects
        FROM curriculum_systems cs
        LEFT JOIN school_curriculum_implementation sci ON sci.curriculum_id = cs.id AND sci.is_active = true
        LEFT JOIN student_curriculum_progress scp ON scp.curriculum_id = cs.id AND scp.is_current = true
        LEFT JOIN curriculum_grade_levels cgl ON cgl.curriculum_id = cs.id
        LEFT JOIN curriculum_subjects csub ON csub.curriculum_id = cs.id AND csub.is_active = true
        WHERE cs.id = $1
        GROUP BY cs.id
      `, [curriculumId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Curriculum system not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to get curriculum system', error);
    }
  }

  /**
   * Grade Levels Management
   */

  // Get grade levels for a curriculum
  async getGradeLevels(curriculumId) {
    try {
      const result = await query(`
        SELECT 
          cgl.*,
          COUNT(scp.id) as students_in_grade
        FROM curriculum_grade_levels cgl
        LEFT JOIN student_curriculum_progress scp ON scp.current_grade_level_id = cgl.id AND scp.is_current = true
        WHERE cgl.curriculum_id = $1
        GROUP BY cgl.id
        ORDER BY cgl.display_order
      `, [curriculumId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get grade levels', error);
    }
  }

  // Get grade level details
  async getGradeLevel(gradeLevelId) {
    try {
      const result = await query(`
        SELECT 
          cgl.*,
          cs.curriculum_name,
          cs.curriculum_code,
          COUNT(scp.id) as students_in_grade
        FROM curriculum_grade_levels cgl
        JOIN curriculum_systems cs ON cs.id = cgl.curriculum_id
        LEFT JOIN student_curriculum_progress scp ON scp.current_grade_level_id = cgl.id AND scp.is_current = true
        WHERE cgl.id = $1
        GROUP BY cgl.id, cs.curriculum_name, cs.curriculum_code
      `, [gradeLevelId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Grade level not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to get grade level', error);
    }
  }

  /**
   * Subjects Management
   */

  // Get subjects for a curriculum
  async getSubjects(curriculumId, filters = {}) {
    try {
      let whereConditions = ['csub.curriculum_id = $1', 'csub.is_active = true'];
      let queryParams = [curriculumId];
      let paramCount = 1;

      if (filters.subjectType) {
        paramCount++;
        whereConditions.push(`csub.subject_type = $${paramCount}`);
        queryParams.push(filters.subjectType);
      }

      if (filters.category) {
        paramCount++;
        whereConditions.push(`csub.subject_category = $${paramCount}`);
        queryParams.push(filters.category);
      }

      if (filters.gradeLevel) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(csub.available_grades)`);
        queryParams.push(filters.gradeLevel);
      }

      if (filters.mandatoryOnly) {
        whereConditions.push(`csub.is_mandatory = true`);
      }

      const result = await query(`
        SELECT 
          csub.*,
          cs.curriculum_name,
          cs.curriculum_code
        FROM curriculum_subjects csub
        JOIN curriculum_systems cs ON cs.id = csub.curriculum_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY csub.subject_category, csub.subject_name
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get subjects', error);
    }
  }

  // Get subject details
  async getSubject(subjectId) {
    try {
      const result = await query(`
        SELECT 
          csub.*,
          cs.curriculum_name,
          cs.curriculum_code
        FROM curriculum_subjects csub
        JOIN curriculum_systems cs ON cs.id = csub.curriculum_id
        WHERE csub.id = $1
      `, [subjectId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Subject not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to get subject', error);
    }
  }

  /**
   * Assessment Standards
   */

  // Get assessment standards
  async getAssessmentStandards(curriculumId, filters = {}) {
    try {
      let whereConditions = ['cas.curriculum_id = $1', 'cas.is_active = true'];
      let queryParams = [curriculumId];
      let paramCount = 1;

      if (filters.subjectId) {
        paramCount++;
        whereConditions.push(`cas.subject_id = $${paramCount}`);
        queryParams.push(filters.subjectId);
      }

      if (filters.gradeLevelId) {
        paramCount++;
        whereConditions.push(`cas.grade_level_id = $${paramCount}`);
        queryParams.push(filters.gradeLevelId);
      }

      if (filters.standardType) {
        paramCount++;
        whereConditions.push(`cas.standard_type = $${paramCount}`);
        queryParams.push(filters.standardType);
      }

      if (filters.complexityLevel) {
        paramCount++;
        whereConditions.push(`cas.complexity_level = $${paramCount}`);
        queryParams.push(filters.complexityLevel);
      }

      const result = await query(`
        SELECT 
          cas.*,
          cs.curriculum_name,
          csub.subject_name,
          cgl.grade_name
        FROM curriculum_assessment_standards cas
        JOIN curriculum_systems cs ON cs.id = cas.curriculum_id
        LEFT JOIN curriculum_subjects csub ON csub.id = cas.subject_id
        LEFT JOIN curriculum_grade_levels cgl ON cgl.id = cas.grade_level_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY cas.domain_area, cas.complexity_level, cas.standard_title
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get assessment standards', error);
    }
  }

  /**
   * School Implementation
   */

  // Get school's curriculum implementations
  async getSchoolImplementations(schoolId) {
    try {
      const result = await query(`
        SELECT 
          sci.*,
          cs.curriculum_name,
          cs.curriculum_code,
          cs.full_name,
          cs.country_origin
        FROM school_curriculum_implementation sci
        JOIN curriculum_systems cs ON cs.id = sci.curriculum_id
        WHERE sci.school_id = $1 AND sci.is_active = true
        ORDER BY sci.implementation_date DESC
      `, [schoolId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get school implementations', error);
    }
  }

  // Create or update school curriculum implementation
  async updateSchoolImplementation(schoolId, curriculumId, implementationData) {
    try {
      const {
        implementationStatus,
        implementationDate,
        gradeLevelsImplemented,
        subjectsImplemented,
        percentageImplementation,
        teacherTrainingCompleted,
        resourcesAcquired,
        assessmentToolsReady,
        implementationChallenges,
        solutionsImplemented,
        implementationCost,
        fundingSource,
        notes
      } = implementationData;

      // Check if implementation already exists
      const existing = await query(`
        SELECT id FROM school_curriculum_implementation
        WHERE school_id = $1 AND curriculum_id = $2
      `, [schoolId, curriculumId]);

      let result;
      if (existing.rows.length > 0) {
        // Update existing implementation
        result = await query(`
          UPDATE school_curriculum_implementation
          SET 
            implementation_status = COALESCE($3, implementation_status),
            implementation_date = COALESCE($4, implementation_date),
            grade_levels_implemented = COALESCE($5, grade_levels_implemented),
            subjects_implemented = COALESCE($6, subjects_implemented),
            percentage_implementation = COALESCE($7, percentage_implementation),
            teacher_training_completed = COALESCE($8, teacher_training_completed),
            resources_acquired = COALESCE($9, resources_acquired),
            assessment_tools_ready = COALESCE($10, assessment_tools_ready),
            implementation_challenges = COALESCE($11, implementation_challenges),
            solutions_implemented = COALESCE($12, solutions_implemented),
            implementation_cost = COALESCE($13, implementation_cost),
            funding_source = COALESCE($14, funding_source),
            notes = COALESCE($15, notes),
            updated_at = NOW()
          WHERE school_id = $1 AND curriculum_id = $2
          RETURNING *
        `, [
          schoolId, curriculumId, implementationStatus, implementationDate,
          gradeLevelsImplemented, subjectsImplemented, percentageImplementation,
          teacherTrainingCompleted, resourcesAcquired, assessmentToolsReady,
          implementationChallenges, solutionsImplemented, implementationCost,
          fundingSource, notes
        ]);
      } else {
        // Create new implementation
        result = await query(`
          INSERT INTO school_curriculum_implementation (
            school_id, curriculum_id, implementation_status, implementation_date,
            grade_levels_implemented, subjects_implemented, percentage_implementation,
            teacher_training_completed, resources_acquired, assessment_tools_ready,
            implementation_challenges, solutions_implemented, implementation_cost,
            funding_source, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `, [
          schoolId, curriculumId, implementationStatus, implementationDate,
          gradeLevelsImplemented, subjectsImplemented, percentageImplementation,
          teacherTrainingCompleted, resourcesAcquired, assessmentToolsReady,
          implementationChallenges, solutionsImplemented, implementationCost,
          fundingSource, notes, implementationData.createdBy
        ]);
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to update school implementation', error);
    }
  }

  /**
   * Student Progress Tracking
   */

  // Get student's curriculum progress
  async getStudentProgress(studentId, academicYear = null) {
    try {
      let whereConditions = ['scp.student_id = $1'];
      let queryParams = [studentId];
      let paramCount = 1;

      if (academicYear) {
        paramCount++;
        whereConditions.push(`scp.academic_year = $${paramCount}`);
        queryParams.push(academicYear);
      } else {
        whereConditions.push(`scp.is_current = true`);
      }

      const result = await query(`
        SELECT 
          scp.*,
          cs.curriculum_name,
          cs.curriculum_code,
          cgl.grade_name,
          cgl.grade_code,
          s.first_name,
          s.last_name,
          sch.name as school_name
        FROM student_curriculum_progress scp
        JOIN curriculum_systems cs ON cs.id = scp.curriculum_id
        JOIN curriculum_grade_levels cgl ON cgl.id = scp.current_grade_level_id
        JOIN students s ON s.id = scp.student_id
        JOIN schools sch ON sch.id = scp.school_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY scp.academic_year DESC, scp.created_at DESC
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get student progress', error);
    }
  }

  // Update student curriculum progress
  async updateStudentProgress(studentId, progressData) {
    try {
      const {
        schoolId,
        curriculumId,
        currentGradeLevelId,
        academicYear,
        termSemester,
        subjectsEnrolled,
        subjectsCompleted,
        subjectsFailed,
        overallGrade,
        gpaScore,
        classRank,
        totalStudentsInClass,
        competenciesAchieved,
        competenciesDeveloping,
        competenciesNeedsSupport,
        subjectPerformance,
        assessmentScores,
        examResults,
        promotionStatus,
        individualizedSupportPlan,
        specialNeedsAccommodation,
        riskFactors,
        interventionStrategies,
        lastUpdatedBy
      } = progressData;

      // Set all previous records for this student in this academic year to not current
      await query(`
        UPDATE student_curriculum_progress
        SET is_current = false, updated_at = NOW()
        WHERE student_id = $1 AND academic_year = $2 AND curriculum_id = $3
      `, [studentId, academicYear, curriculumId]);

      // Insert new current record
      const result = await query(`
        INSERT INTO student_curriculum_progress (
          student_id, school_id, curriculum_id, current_grade_level_id,
          academic_year, term_semester, subjects_enrolled, subjects_completed,
          subjects_failed, overall_grade, gpa_score, class_rank,
          total_students_in_class, competencies_achieved, competencies_developing,
          competencies_needs_support, subject_performance, assessment_scores,
          exam_results, promotion_status, individualized_support_plan,
          special_needs_accommodation, risk_factors, intervention_strategies,
          is_current, last_updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, true, $25
        )
        RETURNING *
      `, [
        studentId, schoolId, curriculumId, currentGradeLevelId, academicYear,
        termSemester, subjectsEnrolled, subjectsCompleted, subjectsFailed,
        overallGrade, gpaScore, classRank, totalStudentsInClass,
        competenciesAchieved, competenciesDeveloping, competenciesNeedsSupport,
        JSON.stringify(subjectPerformance), JSON.stringify(assessmentScores),
        JSON.stringify(examResults), promotionStatus, individualizedSupportPlan,
        specialNeedsAccommodation, riskFactors, interventionStrategies, lastUpdatedBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to update student progress', error);
    }
  }

  /**
   * Curriculum Equivalencies
   */

  // Get curriculum equivalencies
  async getCurriculumEquivalencies(sourceCurriculumId, targetCurriculumId = null) {
    try {
      let whereConditions = ['ce.source_curriculum_id = $1', 'ce.is_active = true'];
      let queryParams = [sourceCurriculumId];
      let paramCount = 1;

      if (targetCurriculumId) {
        paramCount++;
        whereConditions.push(`ce.target_curriculum_id = $${paramCount}`);
        queryParams.push(targetCurriculumId);
      }

      const result = await query(`
        SELECT 
          ce.*,
          scs.curriculum_name as source_curriculum_name,
          tcs.curriculum_name as target_curriculum_name,
          sgl.grade_name as source_grade_name,
          tgl.grade_name as target_grade_name,
          ssub.subject_name as source_subject_name,
          tsub.subject_name as target_subject_name
        FROM curriculum_equivalencies ce
        JOIN curriculum_systems scs ON scs.id = ce.source_curriculum_id
        JOIN curriculum_systems tcs ON tcs.id = ce.target_curriculum_id
        LEFT JOIN curriculum_grade_levels sgl ON sgl.id = ce.source_grade_id
        LEFT JOIN curriculum_grade_levels tgl ON tgl.id = ce.target_grade_id
        LEFT JOIN curriculum_subjects ssub ON ssub.id = ce.source_subject_id
        LEFT JOIN curriculum_subjects tsub ON tsub.id = ce.target_subject_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ce.equivalency_type, ce.equivalency_strength DESC
      `, queryParams);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get curriculum equivalencies', error);
    }
  }

  /**
   * Analytics and Reports
   */

  // Get curriculum implementation analytics
  async getCurriculumAnalytics() {
    try {
      const result = await query(`
        SELECT 
          cs.curriculum_code,
          cs.curriculum_name,
          COUNT(DISTINCT sci.school_id) as schools_implementing,
          COUNT(DISTINCT scp.student_id) as students_enrolled,
          AVG(sci.percentage_implementation) as avg_implementation_percentage,
          COUNT(sci.id) FILTER (WHERE sci.implementation_status = 'full') as fully_implemented_schools,
          COUNT(sci.id) FILTER (WHERE sci.teacher_training_completed = true) as schools_with_trained_teachers,
          COUNT(sci.id) FILTER (WHERE sci.resources_acquired = true) as schools_with_resources
        FROM curriculum_systems cs
        LEFT JOIN school_curriculum_implementation sci ON sci.curriculum_id = cs.id AND sci.is_active = true
        LEFT JOIN student_curriculum_progress scp ON scp.curriculum_id = cs.id AND scp.is_current = true
        WHERE cs.is_active = true
        GROUP BY cs.id, cs.curriculum_code, cs.curriculum_name
        ORDER BY students_enrolled DESC
      `);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get curriculum analytics', error);
    }
  }

  // Get grade level distribution for a curriculum
  async getGradeDistribution(curriculumId) {
    try {
      const result = await query(`
        SELECT 
          cgl.grade_code,
          cgl.grade_name,
          cgl.display_order,
          COUNT(scp.id) as student_count,
          AVG(CASE WHEN scp.gpa_score IS NOT NULL THEN scp.gpa_score END) as avg_gpa,
          COUNT(scp.id) FILTER (WHERE scp.promotion_status = 'promoted') as promoted_students,
          COUNT(scp.id) FILTER (WHERE scp.promotion_status = 'at_risk') as at_risk_students
        FROM curriculum_grade_levels cgl
        LEFT JOIN student_curriculum_progress scp ON scp.current_grade_level_id = cgl.id AND scp.is_current = true
        WHERE cgl.curriculum_id = $1
        GROUP BY cgl.id, cgl.grade_code, cgl.grade_name, cgl.display_order
        ORDER BY cgl.display_order
      `, [curriculumId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get grade distribution', error);
    }
  }

  /**
   * Curriculum Utilities
   */

  // Find grade level by code
  async findGradeLevelByCode(curriculumId, gradeCode) {
    try {
      const result = await query(`
        SELECT * FROM curriculum_grade_levels
        WHERE curriculum_id = $1 AND grade_code = $2
      `, [curriculumId, gradeCode]);

      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to find grade level', error);
    }
  }

  // Find subject by code
  async findSubjectByCode(curriculumId, subjectCode) {
    try {
      const result = await query(`
        SELECT * FROM curriculum_subjects
        WHERE curriculum_id = $1 AND subject_code = $2 AND is_active = true
      `, [curriculumId, subjectCode]);

      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to find subject', error);
    }
  }

  // Get curriculum by code
  async getCurriculumByCode(curriculumCode) {
    try {
      const result = await query(`
        SELECT * FROM curriculum_systems
        WHERE curriculum_code = $1 AND is_active = true
      `, [curriculumCode]);

      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to find curriculum', error);
    }
  }
}

module.exports = new CurriculumService();