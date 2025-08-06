const Grade = require('../models/grade');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class GradeController {
  // Enter grade for a student
  static async enterGrade(req, res, next) {
    try {
      const gradeData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      // Validate grade data
      const validationErrors = Grade.validateGradeData(gradeData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const grade = await Grade.create(gradeData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Grade entered successfully',
        data: grade
      });
    } catch (error) {
      next(error);
    }
  }

  // Get grades for an assessment
  static async getGrades(req, res, next) {
    try {
      const { assessmentId } = req.params;
      const filters = {
        status: req.query.status,
        isApproved: req.query.isApproved === 'true',
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const grades = await Grade.findByAssessment(assessmentId, filters);

      res.json({
        success: true,
        data: grades,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: grades.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update grade
  static async updateGrade(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const grade = await Grade.update(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Grade updated successfully',
        data: grade
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk enter grades
  static async bulkEnterGrades(req, res, next) {
    try {
      const { grades } = req.body;

      if (!Array.isArray(grades) || grades.length === 0) {
        throw new ValidationError('Grades array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < grades.length; i++) {
        try {
          const gradeData = {
            ...grades[i],
            schoolId: req.user.school_id
          };

          // Validate grade data
          const validationErrors = Grade.validateGradeData(gradeData);
          if (validationErrors.length > 0) {
            errors.push({
              index: i,
              data: grades[i],
              error: validationErrors.join(', ')
            });
            continue;
          }

          const grade = await Grade.create(gradeData, req.user.id);
          results.push(grade);
        } catch (error) {
          errors.push({
            index: i,
            data: grades[i],
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Bulk grade entry completed',
        data: {
          success: results,
          errors: errors,
          totalProcessed: grades.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Submit grades for approval
  static async submitForApproval(req, res, next) {
    try {
      const { gradeId } = req.body;

      if (!gradeId) {
        throw new ValidationError('Grade ID is required');
      }

      const grade = await Grade.submitForApproval(gradeId, req.user.id);

      res.json({
        success: true,
        message: 'Grade submitted for approval successfully',
        data: grade
      });
    } catch (error) {
      next(error);
    }
  }

  // Get pending approval grades
  static async getPendingApproval(req, res, next) {
    try {
      const filters = {
        assessmentId: req.query.assessmentId,
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const pendingGrades = await Grade.getPendingApproval(req.user.school_id, filters);

      res.json({
        success: true,
        data: pendingGrades,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: pendingGrades.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Approve grades
  static async approveGrades(req, res, next) {
    try {
      const { gradeIds, approvalNotes } = req.body;

      if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
        throw new ValidationError('Grade IDs array is required');
      }

      const results = [];
      const errors = [];

      for (const gradeId of gradeIds) {
        try {
          const grade = await Grade.approve(gradeId, req.user.id, approvalNotes);
          results.push(grade);
        } catch (error) {
          errors.push({
            gradeId,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: 'Grades approval completed',
        data: {
          success: results,
          errors: errors,
          totalProcessed: gradeIds.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reject grades
  static async rejectGrades(req, res, next) {
    try {
      const { gradeId, rejectionReason } = req.body;

      if (!gradeId || !rejectionReason) {
        throw new ValidationError('Grade ID and rejection reason are required');
      }

      const grade = await Grade.reject(gradeId, req.user.id, rejectionReason);

      res.json({
        success: true,
        message: 'Grade rejected successfully',
        data: grade
      });
    } catch (error) {
      next(error);
    }
  }

  // Get approval history
  static async getApprovalHistory(req, res, next) {
    try {
      const filters = {
        assessmentId: req.query.assessmentId,
        gradeId: req.query.gradeId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const history = await Grade.getApprovalHistory(req.user.school_id, filters);

      res.json({
        success: true,
        data: history,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: history.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get student grades
  static async getStudentGrades(req, res, next) {
    try {
      const { studentId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        subjectId: req.query.subjectId,
        assessmentType: req.query.assessmentType,
        isApproved: req.query.isApproved === 'true',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const grades = await Grade.findByStudent(studentId, filters);

      res.json({
        success: true,
        data: grades,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: grades.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get student grade statistics
  static async getStudentStatistics(req, res, next) {
    try {
      const { studentId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        subjectId: req.query.subjectId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const statistics = await Grade.getStudentStatistics(studentId, filters);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }

  // Get grading scales
  static async getGradingScales(req, res, next) {
    try {
      const { curriculumType } = req.params;
      const scales = await Grade.getGradingScales(curriculumType);

      res.json({
        success: true,
        data: scales
      });
    } catch (error) {
      next(error);
    }
  }

  // Update grading scales
  static async updateGradingScales(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const scale = await Grade.updateGradingScales(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Grading scale updated successfully',
        data: scale
      });
    } catch (error) {
      next(error);
    }
  }

  // Set grade boundaries
  static async setGradeBoundaries(req, res, next) {
    try {
      const { scaleId, boundaries } = req.body;

      if (!scaleId || !boundaries) {
        throw new ValidationError('Scale ID and boundaries are required');
      }

      const result = await Grade.setGradeBoundaries(scaleId, boundaries, req.user.id);

      res.json({
        success: true,
        message: 'Grade boundaries set successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get academic analytics
  static async getAcademicAnalytics(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const analytics = await Grade.getAcademicAnalytics(req.user.school_id, filters);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // Get performance trends
  static async getPerformanceTrends(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        period: req.query.period || 'monthly'
      };

      const trends = await Grade.getPerformanceTrends(req.user.school_id, filters);

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      next(error);
    }
  }

  // Get class performance
  static async getClassPerformance(req, res, next) {
    try {
      const { classId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        subjectId: req.query.subjectId
      };

      const performance = await Grade.getClassPerformance(classId, filters);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      next(error);
    }
  }

  // Get student progress
  static async getStudentProgress(req, res, next) {
    try {
      const { studentId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        subjectId: req.query.subjectId,
        period: req.query.period || 'monthly'
      };

      const progress = await Grade.getStudentProgress(studentId, filters);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate grade report
  static async generateGradeReport(req, res, next) {
    try {
      const { studentId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        includeComments: req.query.includeComments === 'true',
        includeAnalytics: req.query.includeAnalytics === 'true'
      };

      const report = await Grade.generateGradeReport(studentId, filters);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate class performance report
  static async generateClassPerformanceReport(req, res, next) {
    try {
      const { classId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        includeRankings: req.query.includeRankings === 'true',
        includeComparisons: req.query.includeComparisons === 'true'
      };

      const report = await Grade.generateClassPerformanceReport(classId, filters);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate academic summary
  static async generateAcademicSummary(req, res, next) {
    try {
      const { academicYearId } = req.params;
      const filters = {
        includeComparisons: req.query.includeComparisons === 'true',
        includeProjections: req.query.includeProjections === 'true'
      };

      const summary = await Grade.generateAcademicSummary(academicYearId, filters);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  // Calculate letter grade
  static async calculateLetterGrade(req, res, next) {
    try {
      const { percentage, gradingScaleId } = req.body;

      if (!percentage || !gradingScaleId) {
        throw new ValidationError('Percentage and grading scale ID are required');
      }

      const letterGrade = await Grade.calculateLetterGrade(percentage, gradingScaleId);

      res.json({
        success: true,
        data: {
          percentage,
          letterGrade
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Validate grade data
  static async validateGrade(req, res, next) {
    try {
      const gradeData = req.body;
      const errors = Grade.validateGradeData(gradeData);

      res.json({
        success: true,
        data: {
          isValid: errors.length === 0,
          errors: errors
        }
      });
    } catch (error) {
      next(error);
    }
  }
  // =============================================================================
  // MISSING GRADE MANAGEMENT METHODS
  // =============================================================================

  static async overrideGrade(req, res, next) {
    res.status(200).json({ success: true, message: 'Override grade - implementation pending', data: {} });
  }

  static async bulkApproveGrades(req, res, next) {
    res.status(200).json({ success: true, message: 'Bulk approve grades - implementation pending', data: {} });
  }

  static async releaseGradesToParents(req, res, next) {
    res.status(200).json({ success: true, message: 'Release grades to parents - implementation pending', data: {} });
  }

  static async getCurriculumStandards(req, res, next) {
    res.status(200).json({ success: true, message: 'Get curriculum standards - implementation pending', data: [] });
  }

  static async getPerformanceAnalytics(req, res, next) {
    res.status(200).json({ success: true, message: 'Get performance analytics - implementation pending', data: {} });
  }

  static async getGradeTrends(req, res, next) {
    res.status(200).json({ success: true, message: 'Get grade trends - implementation pending', data: [] });
  }

  static async getCurriculumComparison(req, res, next) {
    res.status(200).json({ success: true, message: 'Get curriculum comparison - implementation pending', data: {} });
  }
}

module.exports = GradeController; 