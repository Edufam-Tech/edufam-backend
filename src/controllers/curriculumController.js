const curriculumService = require('../services/curriculumService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Curriculum Controller
 * Handles curriculum-specific operations for CBC, IGCSE, 8-4-4, IB and other educational systems
 */
class CurriculumController {

  /**
   * Curriculum Systems Management
   */

  // Get all curriculum systems
  getCurriculumSystems = asyncHandler(async (req, res) => {
    const filters = {
      country: req.query.country,
      search: req.query.search
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const curricula = await curriculumService.getCurriculumSystems(filters);

    res.json({
      success: true,
      data: { curricula },
      message: 'Curriculum systems retrieved successfully'
    });
  });

  // Get curriculum system details
  getCurriculumSystem = asyncHandler(async (req, res) => {
    const { curriculumId } = req.params;
    
    const curriculum = await curriculumService.getCurriculumSystem(curriculumId);

    res.json({
      success: true,
      data: { curriculum },
      message: 'Curriculum system details retrieved successfully'
    });
  });

  // Get curriculum by code (helper endpoint)
  getCurriculumByCode = asyncHandler(async (req, res) => {
    const { curriculumCode } = req.params;
    
    const curriculum = await curriculumService.getCurriculumByCode(curriculumCode);

    if (!curriculum) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CURRICULUM_NOT_FOUND',
          message: 'Curriculum system not found'
        }
      });
    }

    res.json({
      success: true,
      data: { curriculum },
      message: 'Curriculum system retrieved successfully'
    });
  });

  /**
   * Grade Levels Management
   */

  // Get grade levels for a curriculum
  getGradeLevels = asyncHandler(async (req, res) => {
    const { curriculumId } = req.params;
    
    const gradeLevels = await curriculumService.getGradeLevels(curriculumId);

    res.json({
      success: true,
      data: { gradeLevels },
      message: 'Grade levels retrieved successfully'
    });
  });

  // Get grade level details
  getGradeLevel = asyncHandler(async (req, res) => {
    const { gradeLevelId } = req.params;
    
    const gradeLevel = await curriculumService.getGradeLevel(gradeLevelId);

    res.json({
      success: true,
      data: { gradeLevel },
      message: 'Grade level details retrieved successfully'
    });
  });

  /**
   * Subjects Management
   */

  // Get subjects for a curriculum
  getSubjects = asyncHandler(async (req, res) => {
    const { curriculumId } = req.params;
    
    const filters = {
      subjectType: req.query.subjectType,
      category: req.query.category,
      gradeLevel: req.query.gradeLevel,
      mandatoryOnly: req.query.mandatoryOnly === 'true'
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const subjects = await curriculumService.getSubjects(curriculumId, filters);

    res.json({
      success: true,
      data: { subjects },
      message: 'Subjects retrieved successfully'
    });
  });

  // Get subject details
  getSubject = asyncHandler(async (req, res) => {
    const { subjectId } = req.params;
    
    const subject = await curriculumService.getSubject(subjectId);

    res.json({
      success: true,
      data: { subject },
      message: 'Subject details retrieved successfully'
    });
  });

  /**
   * Assessment Standards
   */

  // Get assessment standards
  getAssessmentStandards = asyncHandler(async (req, res) => {
    const { curriculumId } = req.params;
    
    const filters = {
      subjectId: req.query.subjectId,
      gradeLevelId: req.query.gradeLevelId,
      standardType: req.query.standardType,
      complexityLevel: req.query.complexityLevel
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const standards = await curriculumService.getAssessmentStandards(curriculumId, filters);

    res.json({
      success: true,
      data: { standards },
      message: 'Assessment standards retrieved successfully'
    });
  });

  /**
   * School Implementation Management
   */

  // Get school's curriculum implementations
  getSchoolImplementations = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const implementations = await curriculumService.getSchoolImplementations(schoolId);

    res.json({
      success: true,
      data: { implementations },
      message: 'School curriculum implementations retrieved successfully'
    });
  });

  // Update school curriculum implementation
  updateSchoolImplementation = asyncHandler(async (req, res) => {
    const { curriculumId } = req.params;
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
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
    } = req.body;

    // Validate required fields for new implementations
    if (!implementationStatus || !implementationDate) {
      throw new ValidationError('Implementation status and date are required');
    }

    const implementation = await curriculumService.updateSchoolImplementation(
      schoolId,
      curriculumId,
      {
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
        notes,
        createdBy: req.user.userId
      }
    );

    res.json({
      success: true,
      data: { implementation },
      message: 'School curriculum implementation updated successfully'
    });
  });

  /**
   * Student Progress Tracking
   */

  // Get student's curriculum progress
  getStudentProgress = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { academicYear } = req.query;
    
    const progress = await curriculumService.getStudentProgress(studentId, academicYear);

    res.json({
      success: true,
      data: { progress },
      message: 'Student curriculum progress retrieved successfully'
    });
  });

  // Update student curriculum progress
  updateStudentProgress = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    
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
      interventionStrategies
    } = req.body;

    // Validate required fields
    if (!curriculumId || !currentGradeLevelId || !academicYear) {
      throw new ValidationError('Curriculum ID, grade level ID, and academic year are required');
    }

    const progress = await curriculumService.updateStudentProgress(studentId, {
      schoolId: schoolId || req.activeSchoolId || req.user.schoolId,
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
      lastUpdatedBy: req.user.userId
    });

    // Send notification if student is at risk
    if (promotionStatus === 'at_risk') {
      try {
        await realtimeIntegrations.createCustomEvent({
          eventType: 'student_at_risk',
          schoolId: schoolId || req.activeSchoolId || req.user.schoolId,
          sourceUserId: req.user.userId,
          targetRoles: ['principal', 'school_director', 'teacher', 'parent'],
          title: 'Student Academic Risk Alert',
          message: 'A student has been identified as at risk for academic progression',
          eventPayload: {
            studentId,
            academicYear,
            gradeLevelId: currentGradeLevelId,
            riskFactors: riskFactors || [],
            interventionStrategies: interventionStrategies || []
          },
          priority: 'high',
          sourceEntityType: 'student_progress',
          sourceEntityId: progress.id
        });
      } catch (error) {
        console.error('Failed to send at-risk notification:', error);
      }
    }

    res.json({
      success: true,
      data: { progress },
      message: 'Student curriculum progress updated successfully'
    });
  });

  /**
   * Curriculum Equivalencies
   */

  // Get curriculum equivalencies
  getCurriculumEquivalencies = asyncHandler(async (req, res) => {
    const { sourceCurriculumId } = req.params;
    const { targetCurriculumId } = req.query;
    
    const equivalencies = await curriculumService.getCurriculumEquivalencies(
      sourceCurriculumId,
      targetCurriculumId
    );

    res.json({
      success: true,
      data: { equivalencies },
      message: 'Curriculum equivalencies retrieved successfully'
    });
  });

  /**
   * Analytics and Reports
   */

  // Get curriculum implementation analytics
  getCurriculumAnalytics = asyncHandler(async (req, res) => {
    const analytics = await curriculumService.getCurriculumAnalytics();

    res.json({
      success: true,
      data: { analytics },
      message: 'Curriculum analytics retrieved successfully'
    });
  });

  // Get grade distribution for a curriculum
  getGradeDistribution = asyncHandler(async (req, res) => {
    const { curriculumId } = req.params;
    
    const distribution = await curriculumService.getGradeDistribution(curriculumId);

    res.json({
      success: true,
      data: { distribution },
      message: 'Grade distribution retrieved successfully'
    });
  });

  // Get school curriculum dashboard
  getSchoolCurriculumDashboard = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    // Get school implementations
    const implementations = await curriculumService.getSchoolImplementations(schoolId);
    
    // Get student distribution across curricula
    const studentDistribution = await curriculumService.query(`
      SELECT 
        cs.curriculum_code,
        cs.curriculum_name,
        COUNT(scp.id) as student_count,
        COUNT(DISTINCT scp.current_grade_level_id) as grade_levels_used,
        AVG(CASE WHEN scp.gpa_score IS NOT NULL THEN scp.gpa_score END) as avg_gpa,
        COUNT(scp.id) FILTER (WHERE scp.promotion_status = 'at_risk') as at_risk_students
      FROM curriculum_systems cs
      JOIN student_curriculum_progress scp ON scp.curriculum_id = cs.id
      WHERE scp.school_id = $1 AND scp.is_current = true
      GROUP BY cs.id, cs.curriculum_code, cs.curriculum_name
      ORDER BY student_count DESC
    `, [schoolId]);

    res.json({
      success: true,
      data: {
        implementations,
        studentDistribution: studentDistribution.rows,
        schoolId,
        timestamp: new Date().toISOString()
      },
      message: 'School curriculum dashboard retrieved successfully'
    });
  });

  /**
   * Curriculum-Specific Features
   */

  // Get CBC-specific competency tracking
  getCbcCompetencyTracking = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { academicYear } = req.query;
    
    // Get CBC curriculum
    const cbcCurriculum = await curriculumService.getCurriculumByCode('CBC');
    
    if (!cbcCurriculum) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CBC_NOT_FOUND',
          message: 'CBC curriculum not found'
        }
      });
    }

    // Get student's CBC progress
    const progress = await curriculumService.getStudentProgress(studentId, academicYear);
    const cbcProgress = progress.find(p => p.curriculum_id === cbcCurriculum.id);

    if (!cbcProgress) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CBC_PROGRESS_NOT_FOUND',
          message: 'Student CBC progress not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        studentId,
        academicYear: cbcProgress.academic_year,
        competenciesAchieved: cbcProgress.competencies_achieved || [],
        competenciesDeveloping: cbcProgress.competencies_developing || [],
        competenciesNeedsSupport: cbcProgress.competencies_needs_support || [],
        overallProgress: {
          achieved: (cbcProgress.competencies_achieved || []).length,
          developing: (cbcProgress.competencies_developing || []).length,
          needsSupport: (cbcProgress.competencies_needs_support || []).length
        }
      },
      message: 'CBC competency tracking retrieved successfully'
    });
  });

  // Get IGCSE subject performance
  getIgcseSubjectPerformance = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { academicYear } = req.query;
    
    // Get IGCSE curriculum
    const igcseCurriculum = await curriculumService.getCurriculumByCode('IGCSE');
    
    if (!igcseCurriculum) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IGCSE_NOT_FOUND',
          message: 'IGCSE curriculum not found'
        }
      });
    }

    // Get student's IGCSE progress
    const progress = await curriculumService.getStudentProgress(studentId, academicYear);
    const igcseProgress = progress.find(p => p.curriculum_id === igcseCurriculum.id);

    if (!igcseProgress) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IGCSE_PROGRESS_NOT_FOUND',
          message: 'Student IGCSE progress not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        studentId,
        academicYear: igcseProgress.academic_year,
        subjectPerformance: igcseProgress.subject_performance || {},
        examResults: igcseProgress.exam_results || {},
        overallGrade: igcseProgress.overall_grade,
        predictedGrades: igcseProgress.predicted_outcomes || []
      },
      message: 'IGCSE subject performance retrieved successfully'
    });
  });

  /**
   * Utility Endpoints
   */

  // Health check for curriculum service
  getCurriculumServiceHealth = asyncHandler(async (req, res) => {
    const analytics = await curriculumService.getCurriculumAnalytics();
    const totalCurricula = analytics.length;
    const totalSchools = analytics.reduce((sum, curr) => sum + parseInt(curr.schools_implementing), 0);
    const totalStudents = analytics.reduce((sum, curr) => sum + parseInt(curr.students_enrolled), 0);

    res.json({
      success: true,
      data: {
        service: 'Curriculum Management Service',
        status: 'healthy',
        supportedCurricula: analytics.map(a => a.curriculum_code),
        features: [
          'multi_curriculum_support',
          'grade_level_management',
          'subject_tracking',
          'assessment_standards',
          'student_progress_tracking',
          'curriculum_equivalencies',
          'competency_tracking',
          'analytics_reporting'
        ],
        metrics: {
          totalCurricula,
          totalSchools,
          totalStudents,
          mostUsedCurriculum: analytics[0]?.curriculum_code || 'N/A'
        },
        timestamp: new Date().toISOString()
      },
      message: 'Curriculum service health check completed'
    });
  });
}

module.exports = new CurriculumController();