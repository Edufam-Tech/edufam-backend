const Assessment = require('../models/assessment');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class AssessmentController {
  // Create new assessment
  static async createAssessment(req, res, next) {
    try {
      const assessmentData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      // Validate assessment data
      const validationErrors = Assessment.validateAssessmentData(assessmentData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const assessment = await Assessment.create(assessmentData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Assessment created successfully',
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }

  // Get assessment by ID
  static async getAssessment(req, res, next) {
    try {
      const { id } = req.params;
      const assessment = await Assessment.findById(id);

      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all assessments for a school
  static async getAssessments(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        categoryId: req.query.categoryId,
        status: req.query.status,
        isFinal: req.query.isFinal === 'true',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const assessments = await Assessment.findBySchool(req.user.school_id, filters);

      res.json({
        success: true,
        data: assessments,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: assessments.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get assessments for a specific class
  static async getClassAssessments(req, res, next) {
    try {
      const { classId } = req.params;
      const filters = {
        subjectId: req.query.subjectId,
        status: req.query.status,
        isFinal: req.query.isFinal === 'true'
      };

      const assessments = await Assessment.findByClass(classId, filters);

      res.json({
        success: true,
        data: assessments
      });
    } catch (error) {
      next(error);
    }
  }

  // Update assessment
  static async updateAssessment(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const assessment = await Assessment.update(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Assessment updated successfully',
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete assessment
  static async deleteAssessment(req, res, next) {
    try {
      const { id } = req.params;
      const assessment = await Assessment.delete(id, req.user.id);

      res.json({
        success: true,
        message: 'Assessment deleted successfully',
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }

  // Change assessment status
  static async changeStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        throw new ValidationError('Status is required');
      }

      const assessment = await Assessment.changeStatus(id, status, req.user.id);

      res.json({
        success: true,
        message: 'Assessment status changed successfully',
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }

  // Get assessment statistics
  static async getAssessmentStatistics(req, res, next) {
    try {
      const { id } = req.params;
      const statistics = await Assessment.getStatistics(id);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }

  // Get assessments by date range
  static async getAssessmentsByDateRange(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        status: req.query.status
      };

      if (!startDate || !endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      const assessments = await Assessment.findByDateRange(
        req.user.school_id,
        startDate,
        endDate,
        filters
      );

      res.json({
        success: true,
        data: assessments
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk create assessments
  static async bulkCreateAssessments(req, res, next) {
    try {
      const { assessments } = req.body;

      if (!Array.isArray(assessments) || assessments.length === 0) {
        throw new ValidationError('Assessments array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < assessments.length; i++) {
        try {
          const assessmentData = {
            ...assessments[i],
            schoolId: req.user.school_id
          };

          // Validate assessment data
          const validationErrors = Assessment.validateAssessmentData(assessmentData);
          if (validationErrors.length > 0) {
            errors.push({
              index: i,
              data: assessments[i],
              error: validationErrors.join(', ')
            });
            continue;
          }

          const assessment = await Assessment.create(assessmentData, req.user.id);
          results.push(assessment);
        } catch (error) {
          errors.push({
            index: i,
            data: assessments[i],
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Bulk assessment creation completed',
        data: {
          success: results,
          errors: errors,
          totalProcessed: assessments.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get assessment dashboard data
  static async getAssessmentDashboard(req, res, next) {
    try {
      const { academicYearId, academicTermId } = req.query;
      const filters = {};

      if (academicYearId) filters.academicYearId = academicYearId;
      if (academicTermId) filters.academicTermId = academicTermId;

      // Get assessments by status
      const draftAssessments = await Assessment.findBySchool(req.user.school_id, {
        ...filters,
        status: 'draft'
      });

      const publishedAssessments = await Assessment.findBySchool(req.user.school_id, {
        ...filters,
        status: 'published'
      });

      const gradingAssessments = await Assessment.findBySchool(req.user.school_id, {
        ...filters,
        status: 'grading'
      });

      const completedAssessments = await Assessment.findBySchool(req.user.school_id, {
        ...filters,
        status: 'completed'
      });

      // Get recent assessments
      const recentAssessments = await Assessment.findBySchool(req.user.school_id, {
        ...filters,
        limit: 5
      });

      const dashboardData = {
        summary: {
          total: draftAssessments.length + publishedAssessments.length + 
                 gradingAssessments.length + completedAssessments.length,
          draft: draftAssessments.length,
          published: publishedAssessments.length,
          grading: gradingAssessments.length,
          completed: completedAssessments.length
        },
        recentAssessments: recentAssessments
      };

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      next(error);
    }
  }

  // Export assessments
  static async exportAssessments(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        classId: req.query.classId,
        subjectId: req.query.subjectId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const assessments = await Assessment.findBySchool(req.user.school_id, filters);

      // Format data for export
      const exportData = assessments.map(assessment => ({
        'Assessment ID': assessment.id,
        'Title': assessment.title,
        'Description': assessment.description,
        'Category': assessment.category_name,
        'Subject': assessment.subject_name,
        'Class': assessment.class_name,
        'Total Marks': assessment.total_marks,
        'Pass Marks': assessment.pass_marks,
        'Assessment Date': assessment.assessment_date,
        'Duration (minutes)': assessment.duration_minutes,
        'Status': assessment.status,
        'Is Final': assessment.is_final,
        'Created By': assessment.created_by_name,
        'Created At': assessment.created_at
      }));

      res.json({
        success: true,
        data: exportData,
        total: exportData.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Validate assessment data
  static async validateAssessment(req, res, next) {
    try {
      const assessmentData = req.body;
      const errors = Assessment.validateAssessmentData(assessmentData);

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

  // Grade Categories Management
  static async getGradeCategories(req, res) {
    try {
      const { query } = require('../config/database');

      const selectQuery = `
        SELECT * FROM grade_categories 
        WHERE school_id = $1
        ORDER BY name ASC
      `;

      const result = await query(selectQuery, [req.user.school_id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get grade categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get grade categories'
      });
    }
  }

  static async createGradeCategory(req, res) {
    try {
      const { query } = require('../config/database');
      const categoryData = {
        ...req.body,
        school_id: req.user.school_id,
        created_by: req.user.id
      };

      const insertQuery = `
        INSERT INTO grade_categories (name, description, weight, is_active, school_id, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        categoryData.name,
        categoryData.description,
        categoryData.weight || 1,
        categoryData.is_active !== false,
        categoryData.school_id,
        categoryData.created_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Grade category created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create grade category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create grade category'
      });
    }
  }

  static async updateGradeCategory(req, res) {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;
      const updateData = req.body;

      const updateQuery = `
        UPDATE grade_categories 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            weight = COALESCE($3, weight),
            is_active = COALESCE($4, is_active),
            updated_at = NOW(),
            updated_by = $5
        WHERE id = $6 AND school_id = $7
        RETURNING *
      `;

      const result = await query(updateQuery, [
        updateData.name,
        updateData.description,
        updateData.weight,
        updateData.is_active,
        req.user.id,
        id,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Grade category not found'
        });
      }

      res.json({
        success: true,
        message: 'Grade category updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update grade category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update grade category'
      });
    }
  }

  static async deleteGradeCategory(req, res) {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;

      const deleteQuery = `
        DELETE FROM grade_categories 
        WHERE id = $1 AND school_id = $2
        RETURNING id
      `;

      const result = await query(deleteQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Grade category not found'
        });
      }

      res.json({
        success: true,
        message: 'Grade category deleted successfully'
      });
    } catch (error) {
      console.error('Delete grade category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete grade category'
      });
    }
  }
}

module.exports = AssessmentController; 