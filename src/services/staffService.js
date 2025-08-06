const Staff = require('../models/staff');
const Department = require('../models/department');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class StaffService {
  // Staff Management Methods
  static async createStaff(staffData, createdBy) {
    try {
      // Validate staff data
      const validationErrors = Staff.validateStaffData(staffData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      // Generate employee number if not provided
      if (!staffData.employeeNumber) {
        staffData.employeeNumber = await Staff.generateEmployeeNumber(staffData.schoolId);
      }

      const staff = await Staff.create(staffData, createdBy);
      return staff;
    } catch (error) {
      throw error;
    }
  }

  static async getStaffDetails(staffId, userId) {
    try {
      const staff = await Staff.findById(staffId);
      
      // Get staff qualifications
      const qualifications = await this.getStaffQualifications(staffId);
      
      // Get staff documents
      const documents = await this.getStaffDocuments(staffId);
      
      // Get staff emergency contacts
      const emergencyContacts = await this.getStaffEmergencyContacts(staffId);

      return {
        staff,
        qualifications,
        documents,
        emergencyContacts
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAllStaff(filters = {}, pagination = {}) {
    try {
      const result = await Staff.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async updateStaff(staffId, updateData, updatedBy) {
    try {
      // Validate update data
      if (updateData.firstName || updateData.lastName || updateData.dateOfBirth || updateData.gender || updateData.email) {
        const validationData = {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          dateOfBirth: updateData.dateOfBirth,
          gender: updateData.gender,
          email: updateData.email
        };
        const validationErrors = Staff.validateStaffData(validationData);
        if (validationErrors.length > 0) {
          throw new ValidationError(validationErrors.join(', '));
        }
      }

      const staff = await Staff.update(staffId, updateData, updatedBy);
      return staff;
    } catch (error) {
      throw error;
    }
  }

  static async deactivateStaff(staffId, deactivatedBy) {
    try {
      const staff = await Staff.deactivate(staffId, deactivatedBy);
      return staff;
    } catch (error) {
      throw error;
    }
  }

  static async reactivateStaff(staffId, reactivatedBy) {
    try {
      const staff = await Staff.reactivate(staffId, reactivatedBy);
      return staff;
    } catch (error) {
      throw error;
    }
  }

  // Department Management Methods
  static async createDepartment(departmentData, createdBy) {
    try {
      // Validate department data
      const validationErrors = Department.validateDepartmentData(departmentData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const department = await Department.create(departmentData, createdBy);
      return department;
    } catch (error) {
      throw error;
    }
  }

  static async getDepartmentDetails(departmentId) {
    try {
      const department = await Department.findById(departmentId);
      
      // Get staff in this department
      const staff = await Department.getStaffByDepartment(departmentId);
      
      // Get department statistics
      const statistics = await Department.getStatistics(departmentId);

      return {
        department,
        staff,
        statistics
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAllDepartments(filters = {}, pagination = {}) {
    try {
      const result = await Department.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async updateDepartment(departmentId, updateData, updatedBy) {
    try {
      // Validate update data
      if (updateData.name || updateData.code) {
        const validationData = {
          name: updateData.name,
          code: updateData.code
        };
        const validationErrors = Department.validateDepartmentData(validationData);
        if (validationErrors.length > 0) {
          throw new ValidationError(validationErrors.join(', '));
        }
      }

      const department = await Department.update(departmentId, updateData, updatedBy);
      return department;
    } catch (error) {
      throw error;
    }
  }

  static async deleteDepartment(departmentId, deletedBy) {
    try {
      const department = await Department.delete(departmentId, deletedBy);
      return department;
    } catch (error) {
      throw error;
    }
  }

  // Staff Qualifications Methods
  static async addStaffQualification(staffId, qualificationData, createdBy) {
    try {
      const { qualification, institution, yearObtained, grade, documentUrl } = qualificationData;

      if (!qualification || !institution || !yearObtained) {
        throw new ValidationError('Qualification, institution, and year obtained are required');
      }

      const result = await query(`
        INSERT INTO staff_qualifications (
          staff_id, qualification, institution, year_obtained, grade, document_url,
          created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [staffId, qualification, institution, yearObtained, grade, documentUrl, createdBy, createdBy]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getStaffQualifications(staffId) {
    try {
      const result = await query(`
        SELECT * FROM staff_qualifications 
        WHERE staff_id = $1 
        ORDER BY year_obtained DESC
      `, [staffId]);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async updateStaffQualification(qualificationId, updateData, updatedBy) {
    try {
      const { qualification, institution, yearObtained, grade, documentUrl } = updateData;

      const result = await query(`
        UPDATE staff_qualifications 
        SET qualification = COALESCE($1, qualification),
            institution = COALESCE($2, institution),
            year_obtained = COALESCE($3, year_obtained),
            grade = $4,
            document_url = $5,
            updated_by = $6,
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [qualification, institution, yearObtained, grade, documentUrl, updatedBy, qualificationId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Qualification not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async deleteStaffQualification(qualificationId, deletedBy) {
    try {
      const result = await query(`
        DELETE FROM staff_qualifications 
        WHERE id = $1
        RETURNING *
      `, [qualificationId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Qualification not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Staff Documents Methods
  static async addStaffDocument(staffId, documentData, createdBy) {
    try {
      const { documentType, title, description, fileUrl, expiryDate } = documentData;

      if (!documentType || !title || !fileUrl) {
        throw new ValidationError('Document type, title, and file URL are required');
      }

      const result = await query(`
        INSERT INTO staff_documents (
          staff_id, document_type, title, description, file_url, expiry_date,
          created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [staffId, documentType, title, description, fileUrl, expiryDate, createdBy, createdBy]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getStaffDocuments(staffId) {
    try {
      const result = await query(`
        SELECT * FROM staff_documents 
        WHERE staff_id = $1 
        ORDER BY created_at DESC
      `, [staffId]);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async deleteStaffDocument(documentId, deletedBy) {
    try {
      const result = await query(`
        DELETE FROM staff_documents 
        WHERE id = $1
        RETURNING *
      `, [documentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Document not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Staff Emergency Contacts Methods
  static async addStaffEmergencyContact(staffId, contactData, createdBy) {
    try {
      const { name, relationship, phone, email, address } = contactData;

      if (!name || !relationship || !phone) {
        throw new ValidationError('Name, relationship, and phone are required');
      }

      const result = await query(`
        INSERT INTO staff_emergency_contacts (
          staff_id, name, relationship, phone, email, address,
          created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [staffId, name, relationship, phone, email, address, createdBy, createdBy]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getStaffEmergencyContacts(staffId) {
    try {
      const result = await query(`
        SELECT * FROM staff_emergency_contacts 
        WHERE staff_id = $1 
        ORDER BY created_at DESC
      `, [staffId]);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async updateStaffEmergencyContact(contactId, updateData, updatedBy) {
    try {
      const { name, relationship, phone, email, address } = updateData;

      const result = await query(`
        UPDATE staff_emergency_contacts 
        SET name = COALESCE($1, name),
            relationship = COALESCE($2, relationship),
            phone = COALESCE($3, phone),
            email = $4,
            address = $5,
            updated_by = $6,
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [name, relationship, phone, email, address, updatedBy, contactId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Emergency contact not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async deleteStaffEmergencyContact(contactId, deletedBy) {
    try {
      const result = await query(`
        DELETE FROM staff_emergency_contacts 
        WHERE id = $1
        RETURNING *
      `, [contactId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Emergency contact not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Search and Filter Methods
  static async searchStaff(schoolId, searchTerm, filters = {}, pagination = {}) {
    try {
      const searchFilters = {
        ...filters,
        schoolId,
        search: searchTerm
      };
      
      const result = await Staff.findAll(searchFilters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getStaffByDepartment(departmentId, filters = {}) {
    try {
      const staff = await Department.getStaffByDepartment(departmentId, filters);
      return staff;
    } catch (error) {
      throw error;
    }
  }

  static async getStaffByType(schoolId, staffType, filters = {}) {
    try {
      const typeFilters = {
        ...filters,
        schoolId,
        staffType
      };
      
      const result = await Staff.findAll(typeFilters, { page: 1, limit: 1000 });
      return result.staff;
    } catch (error) {
      throw error;
    }
  }

  // Statistics and Analytics
  static async getStaffStatistics(schoolId) {
    try {
      const statistics = await Staff.getStatistics(schoolId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  static async getDepartmentStatistics(departmentId) {
    try {
      const statistics = await Department.getStatistics(departmentId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  // Dashboard Data
  static async getStaffDashboard(schoolId) {
    try {
      const [
        staffStats,
        departmentStats,
        upcomingBirthdays,
        recentStaff,
        departmentOverview
      ] = await Promise.all([
        Staff.getStatistics(schoolId),
        Department.findAll({ schoolId, isActive: true }, { page: 1, limit: 10 }),
        Staff.getUpcomingBirthdays(schoolId, 30),
        Staff.findAll({ schoolId, isActive: true }, { page: 1, limit: 10 }),
        Department.findAll({ schoolId, isActive: true }, { page: 1, limit: 5 })
      ]);

      return {
        staffStatistics: staffStats,
        departmentOverview: departmentOverview.departments,
        upcomingBirthdays,
        recentStaff: recentStaff.staff,
        departmentStats: departmentStats.departments
      };
    } catch (error) {
      throw error;
    }
  }

  // Validation and Utility Methods
  static async validateStaffAccess(staffId, userId, userType, schoolId) {
    try {
      const staff = await Staff.findById(staffId);
      
      // Check if user has access to this staff member
      if (userType === 'school_user' && staff.school_id !== schoolId) {
        throw new ValidationError('Access denied to this staff member');
      }
      
      return staff;
    } catch (error) {
      throw error;
    }
  }

  static async validateDepartmentAccess(departmentId, userId, userType, schoolId) {
    try {
      const department = await Department.findById(departmentId);
      
      // Check if user has access to this department
      if (userType === 'school_user' && department.school_id !== schoolId) {
        throw new ValidationError('Access denied to this department');
      }
      
      return department;
    } catch (error) {
      throw error;
    }
  }

  // Reporting Methods
  static async generateStaffReport(schoolId, filters = {}) {
    try {
      const staff = await Staff.findAll({ schoolId, ...filters }, { page: 1, limit: 1000 });
      const statistics = await Staff.getStatistics(schoolId);
      
      return {
        staff: staff.staff,
        statistics,
        generatedAt: new Date().toISOString(),
        filters
      };
    } catch (error) {
      throw error;
    }
  }

  static async generateDepartmentReport(schoolId) {
    try {
      const departments = await Department.findAll({ schoolId, isActive: true }, { page: 1, limit: 1000 });
      
      // Get statistics for each department
      const departmentsWithStats = await Promise.all(
        departments.departments.map(async (department) => {
          const stats = await Department.getStatistics(department.id);
          return { ...department, statistics: stats };
        })
      );
      
      return {
        departments: departmentsWithStats,
        totalDepartments: departments.pagination.total,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Export Methods
  static async exportStaffData(schoolId, format = 'json') {
    try {
      const staff = await Staff.findAll({ schoolId, isActive: true }, { page: 1, limit: 10000 });
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(staff.staff);
        return {
          data: csvData,
          format: 'csv',
          filename: `staff_${schoolId}_${new Date().toISOString().split('T')[0]}.csv`
        };
      }
      
      return {
        data: staff.staff,
        format: 'json',
        filename: `staff_${schoolId}_${new Date().toISOString().split('T')[0]}.json`
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper method to convert data to CSV
  static convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = StaffService; 