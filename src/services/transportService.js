const { query } = require('../config/database');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../middleware/errorHandler');

class TransportService {
  // ==================== VEHICLE MANAGEMENT ====================
  
  // Add new vehicle
  async addVehicle(vehicleData, schoolId, createdBy) {
    try {
      const {
        registrationNumber,
        make,
        model,
        year,
        color,
        capacity,
        vehicleType,
        engineNumber,
        chassisNumber,
        fuelType,
        transmission,
        purchaseDate,
        purchasePrice,
        currentValue
      } = vehicleData;

      // Check if registration number already exists for this school
      const existingVehicle = await query(`
        SELECT id FROM vehicles 
        WHERE school_id = $1 AND registration_number = $2
      `, [schoolId, registrationNumber.toUpperCase()]);

      if (existingVehicle.rows.length > 0) {
        throw new ConflictError('Vehicle with this registration number already exists');
      }

      const result = await query(`
        INSERT INTO vehicles (
          school_id, registration_number, make, model, year, color, capacity,
          vehicle_type, engine_number, chassis_number, fuel_type, transmission,
          purchase_date, purchase_price, current_value, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        schoolId,
        registrationNumber.toUpperCase(),
        make,
        model,
        year,
        color,
        capacity,
        vehicleType,
        engineNumber || null,
        chassisNumber || null,
        fuelType || null,
        transmission || null,
        purchaseDate || null,
        purchasePrice || null,
        currentValue || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to add vehicle');
    }
  }

  // List vehicles with pagination and filters
  async listVehicles(schoolId, filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      let whereConditions = ['school_id = $1'];
      let params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        params.push(filters.status);
      }

      if (filters.vehicleType) {
        paramCount++;
        whereConditions.push(`vehicle_type = $${paramCount}`);
        params.push(filters.vehicleType);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(
          registration_number ILIKE $${paramCount} OR 
          make ILIKE $${paramCount} OR 
          model ILIKE $${paramCount}
        )`);
        params.push(`%${filters.search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM vehicles WHERE ${whereClause}
      `, params);

      // Get vehicles
      const vehiclesResult = await query(`
        SELECT * FROM vehicles 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      return {
        vehicles: vehiclesResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to list vehicles');
    }
  }

  // Update vehicle
  async updateVehicle(vehicleId, updateData, schoolId) {
    try {
      const {
        make,
        model,
        year,
        color,
        capacity,
        vehicleType,
        engineNumber,
        chassisNumber,
        fuelType,
        transmission,
        status,
        conditionRating,
        purchaseDate,
        purchasePrice,
        currentValue
      } = updateData;

      const result = await query(`
        UPDATE vehicles 
        SET make = $1, model = $2, year = $3, color = $4, capacity = $5,
            vehicle_type = $6, engine_number = $7, chassis_number = $8,
            fuel_type = $9, transmission = $10, status = $11, condition_rating = $12,
            purchase_date = $13, purchase_price = $14, current_value = $15,
            updated_at = NOW()
        WHERE id = $16 AND school_id = $17
        RETURNING *
      `, [
        make,
        model,
        year,
        color,
        capacity,
        vehicleType,
        engineNumber || null,
        chassisNumber || null,
        fuelType || null,
        transmission || null,
        status,
        conditionRating || null,
        purchaseDate || null,
        purchasePrice || null,
        currentValue || null,
        vehicleId,
        schoolId
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Vehicle not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update vehicle');
    }
  }

  // Log vehicle maintenance
  async logMaintenance(vehicleId, maintenanceData, schoolId, createdBy) {
    try {
      const {
        maintenanceType,
        serviceProvider,
        description,
        cost,
        scheduledDate,
        completedDate,
        nextServiceDate,
        mileageAtService
      } = maintenanceData;

      const result = await query(`
        INSERT INTO vehicle_maintenance (
          vehicle_id, school_id, maintenance_type, service_provider, description,
          cost, scheduled_date, completed_date, next_service_date, mileage_at_service,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        vehicleId,
        schoolId,
        maintenanceType,
        serviceProvider || null,
        description,
        cost || null,
        scheduledDate || null,
        completedDate || null,
        nextServiceDate || null,
        mileageAtService || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to log maintenance');
    }
  }

  // ==================== ROUTE MANAGEMENT ====================

  // Create route
  async createRoute(routeData, schoolId, createdBy) {
    try {
      const {
        routeName,
        routeCode,
        description,
        totalDistance,
        estimatedDuration,
        capacity,
        departureTime,
        arrivalTime
      } = routeData;

      // Check if route code already exists for this school
      const existingRoute = await query(`
        SELECT id FROM routes 
        WHERE school_id = $1 AND route_code = $2
      `, [schoolId, routeCode.toUpperCase()]);

      if (existingRoute.rows.length > 0) {
        throw new ConflictError('Route with this code already exists');
      }

      const result = await query(`
        INSERT INTO routes (
          school_id, route_name, route_code, description, total_distance,
          estimated_duration, capacity, departure_time, arrival_time, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        schoolId,
        routeName,
        routeCode.toUpperCase(),
        description || null,
        totalDistance || null,
        estimatedDuration || null,
        capacity,
        departureTime,
        arrivalTime,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create route');
    }
  }

  // List routes
  async listRoutes(schoolId, filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      let whereConditions = ['school_id = $1'];
      let params = [schoolId];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        params.push(filters.status);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(
          route_name ILIKE $${paramCount} OR 
          route_code ILIKE $${paramCount}
        )`);
        params.push(`%${filters.search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      const countResult = await query(`
        SELECT COUNT(*) as total FROM routes WHERE ${whereClause}
      `, params);

      const routesResult = await query(`
        SELECT * FROM routes 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      return {
        routes: routesResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to list routes');
    }
  }

  // Update route
  async updateRoute(routeId, updateData, schoolId) {
    try {
      const {
        routeName,
        description,
        totalDistance,
        estimatedDuration,
        capacity,
        departureTime,
        arrivalTime,
        status
      } = updateData;

      const result = await query(`
        UPDATE routes 
        SET route_name = $1, description = $2, total_distance = $3,
            estimated_duration = $4, capacity = $5, departure_time = $6,
            arrival_time = $7, status = $8, updated_at = NOW()
        WHERE id = $9 AND school_id = $10
        RETURNING *
      `, [
        routeName,
        description || null,
        totalDistance || null,
        estimatedDuration || null,
        capacity,
        departureTime,
        arrivalTime,
        status,
        routeId,
        schoolId
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Route not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update route');
    }
  }

  // Add route stops
  async addRouteStops(routeId, stopsData, schoolId, createdBy) {
    try {
      const stops = Array.isArray(stopsData) ? stopsData : [stopsData];
      const addedStops = [];

      for (const stop of stops) {
        const {
          stopName,
          stopCode,
          address,
          coordinates,
          stopOrder,
          pickupTime,
          dropoffTime
        } = stop;

        const result = await query(`
          INSERT INTO route_stops (
            route_id, school_id, stop_name, stop_code, address, coordinates,
            stop_order, pickup_time, dropoff_time, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [
          routeId,
          schoolId,
          stopName,
          stopCode || null,
          address || null,
          coordinates || null,
          stopOrder,
          pickupTime || null,
          dropoffTime || null,
          createdBy
        ]);

        addedStops.push(result.rows[0]);
      }

      return addedStops;
    } catch (error) {
      throw new DatabaseError('Failed to add route stops');
    }
  }

  // ==================== STUDENT TRANSPORT ASSIGNMENTS ====================

  // Assign student to route
  async assignStudentToRoute(assignmentData, schoolId, createdBy) {
    try {
      const {
        studentId,
        routeId,
        pickupStopId,
        dropoffStopId,
        startDate,
        endDate
      } = assignmentData;

      // Check if student is already assigned to this route on the start date
      const existingAssignment = await query(`
        SELECT id FROM student_transport 
        WHERE student_id = $1 AND route_id = $2 AND start_date = $3
      `, [studentId, routeId, startDate]);

      if (existingAssignment.rows.length > 0) {
        throw new ConflictError('Student is already assigned to this route on the specified date');
      }

      const result = await query(`
        INSERT INTO student_transport (
          student_id, route_id, school_id, pickup_stop_id, dropoff_stop_id,
          start_date, end_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        studentId,
        routeId,
        schoolId,
        pickupStopId || null,
        dropoffStopId || null,
        startDate,
        endDate || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to assign student to route');
    }
  }

  // Get students for a route
  async getRouteStudents(routeId, schoolId, date = null) {
    try {
      let sql = `
        SELECT st.*, s.first_name, s.last_name, s.admission_number,
               rs1.stop_name as pickup_stop_name, rs2.stop_name as dropoff_stop_name
        FROM student_transport st
        JOIN students s ON st.student_id = s.id
        LEFT JOIN route_stops rs1 ON st.pickup_stop_id = rs1.id
        LEFT JOIN route_stops rs2 ON st.dropoff_stop_id = rs2.id
        WHERE st.route_id = $1 AND st.school_id = $2 AND st.status = 'active'
      `;
      
      const params = [routeId, schoolId];

      if (date) {
        sql += ' AND st.start_date <= $3 AND (st.end_date IS NULL OR st.end_date >= $3)';
        params.push(date);
      }

      sql += ' ORDER BY s.first_name, s.last_name';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get route students');
    }
  }

  // Remove student assignment
  async removeStudentAssignment(studentId, routeId, schoolId) {
    try {
      const result = await query(`
        UPDATE student_transport 
        SET status = 'cancelled', end_date = CURRENT_DATE, updated_at = NOW()
        WHERE student_id = $1 AND route_id = $2 AND school_id = $3 AND status = 'active'
        RETURNING *
      `, [studentId, routeId, schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Active assignment not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to remove student assignment');
    }
  }

  // ==================== TRANSPORT ATTENDANCE ====================

  // Mark transport attendance
  async markTransportAttendance(attendanceData, schoolId, createdBy) {
    try {
      const {
        studentId,
        routeId,
        attendanceDate,
        attendanceStatus,
        pickupTime,
        dropoffTime,
        notes
      } = attendanceData;

      // Check if attendance already exists for this student on this date
      const existingAttendance = await query(`
        SELECT id FROM transport_attendance 
        WHERE student_id = $1 AND route_id = $2 AND attendance_date = $3
      `, [studentId, routeId, attendanceDate]);

      let result;
      if (existingAttendance.rows.length > 0) {
        // Update existing attendance
        result = await query(`
          UPDATE transport_attendance 
          SET attendance_status = $1, pickup_time = $2, dropoff_time = $3, 
              notes = $4, updated_at = NOW()
          WHERE id = $5
          RETURNING *
        `, [attendanceStatus, pickupTime || null, dropoffTime || null, notes || null, existingAttendance.rows[0].id]);
      } else {
        // Create new attendance record
        result = await query(`
          INSERT INTO transport_attendance (
            student_id, route_id, school_id, attendance_date, attendance_status,
            pickup_time, dropoff_time, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          studentId,
          routeId,
          schoolId,
          attendanceDate,
          attendanceStatus,
          pickupTime || null,
          dropoffTime || null,
          notes || null,
          createdBy
        ]);
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to mark transport attendance');
    }
  }

  // Get transport attendance for a date
  async getTransportAttendance(date, schoolId, routeId = null) {
    try {
      let sql = `
        SELECT ta.*, s.first_name, s.last_name, s.admission_number,
               r.route_name, r.route_code
        FROM transport_attendance ta
        JOIN students s ON ta.student_id = s.id
        JOIN routes r ON ta.route_id = r.id
        WHERE ta.school_id = $1 AND ta.attendance_date = $2
      `;
      
      const params = [schoolId, date];

      if (routeId) {
        sql += ' AND ta.route_id = $3';
        params.push(routeId);
      }

      sql += ' ORDER BY r.route_name, s.first_name, s.last_name';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get transport attendance');
    }
  }

  // ==================== TRANSPORT INCIDENTS ====================

  // Report transport incident
  async reportIncident(incidentData, schoolId, createdBy) {
    try {
      const {
        incidentDate,
        incidentTime,
        incidentType,
        severity,
        location,
        coordinates,
        vehicleId,
        driverId,
        studentIds,
        description,
        actionsTaken
      } = incidentData;

      const result = await query(`
        INSERT INTO transport_incidents (
          school_id, incident_date, incident_time, incident_type, severity,
          location, coordinates, vehicle_id, driver_id, student_ids,
          description, actions_taken, reported_by, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        schoolId,
        incidentDate,
        incidentTime || null,
        incidentType,
        severity,
        location || null,
        coordinates || null,
        vehicleId || null,
        driverId || null,
        studentIds || null,
        description,
        actionsTaken || null,
        createdBy,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to report incident');
    }
  }

  // ==================== TRANSPORT FEES ====================

  // Calculate transport fees for a student
  async calculateTransportFees(studentId, schoolId, period = null) {
    try {
      // Get student's active transport assignments
      const assignments = await query(`
        SELECT st.*, r.route_name, tf.*
        FROM student_transport st
        JOIN routes r ON st.route_id = r.id
        LEFT JOIN transport_fees tf ON (tf.route_id = st.route_id OR tf.applies_to_all_routes = true)
        WHERE st.student_id = $1 AND st.school_id = $2 AND st.status = 'active'
          AND tf.status = 'active'
      `, [studentId, schoolId]);

      const fees = [];
      let totalAmount = 0;

      for (const assignment of assignments.rows) {
        if (assignment.fee_type === 'monthly' || assignment.fee_type === 'termly' || assignment.fee_type === 'yearly') {
          fees.push({
            routeName: assignment.route_name,
            feeName: assignment.fee_name,
            feeType: assignment.fee_type,
            amount: parseFloat(assignment.amount),
            currency: assignment.currency
          });
          totalAmount += parseFloat(assignment.amount);
        }
      }

      return {
        fees,
        totalAmount,
        currency: 'KES'
      };
    } catch (error) {
      throw new DatabaseError('Failed to calculate transport fees');
    }
  }

  // ==================== UTILITY METHODS ====================

  // Get transport statistics
  async getTransportStatistics(schoolId) {
    try {
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM vehicles WHERE school_id = $1 AND status = 'active') as active_vehicles,
          (SELECT COUNT(*) FROM routes WHERE school_id = $1 AND status = 'active') as active_routes,
          (SELECT COUNT(*) FROM drivers WHERE school_id = $1 AND employment_status = 'active') as active_drivers,
          (SELECT COUNT(*) FROM student_transport WHERE school_id = $1 AND status = 'active') as active_assignments,
          (SELECT COUNT(*) FROM transport_attendance WHERE school_id = $1 AND attendance_date = CURRENT_DATE) as today_attendance,
          (SELECT COUNT(*) FROM transport_incidents WHERE school_id = $1 AND incident_date >= CURRENT_DATE - INTERVAL '30 days') as incidents_last_30_days
      `, [schoolId]);

      return stats.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get transport statistics');
    }
  }

  // Get vehicles needing maintenance
  async getVehiclesNeedingMaintenance(schoolId) {
    try {
      const result = await query(`
        SELECT v.*, 
               vm.scheduled_date as next_maintenance_date,
               vm.mileage_at_service as last_mileage
        FROM vehicles v
        LEFT JOIN vehicle_maintenance vm ON v.id = vm.vehicle_id 
          AND vm.id = (
            SELECT id FROM vehicle_maintenance 
            WHERE vehicle_id = v.id 
            ORDER BY scheduled_date DESC 
            LIMIT 1
          )
        WHERE v.school_id = $1 AND v.status = 'active'
          AND (vm.next_service_date IS NULL OR vm.next_service_date <= CURRENT_DATE + INTERVAL '7 days')
        ORDER BY vm.next_service_date ASC
      `, [schoolId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get vehicles needing maintenance');
    }
  }

  // Get expiring licenses
  async getExpiringLicenses(schoolId, daysAhead = 30) {
    try {
      const result = await query(`
        SELECT dl.*, d.first_name, d.last_name, d.phone
        FROM driver_licenses dl
        JOIN drivers d ON dl.driver_id = d.id
        WHERE dl.school_id = $1 AND dl.status = 'valid'
          AND dl.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $2
        ORDER BY dl.expiry_date ASC
      `, [schoolId, daysAhead]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get expiring licenses');
    }
  }
}

module.exports = new TransportService(); 