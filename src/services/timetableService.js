const { query } = require('../config/database');
const { ValidationError } = require('../middleware/errorHandler');

class TimetableService {
  // =============================================================================
  // AI-POWERED TIMETABLE GENERATION
  // =============================================================================

  // Generate optimal timetable using AI algorithms
  static async generateTimetable(schoolId, config = {}) {
    try {
      const {
        academicYear,
        term,
        startDate,
        endDate,
        workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        periodsPerDay = 8,
        periodDuration = 40, // minutes
        breakPeriods = [{ after: 2, duration: 20 }, { after: 5, duration: 40 }],
        optimizationGoals = ['minimize_conflicts', 'balance_teacher_load', 'maximize_room_utilization']
      } = config;

      console.log(`🤖 Starting AI Timetable Generation for School ${schoolId}`);

      // Step 1: Gather all constraints and requirements
      const constraints = await TimetableService.gatherConstraints(schoolId);
      
      // Step 2: Initialize the constraint satisfaction problem
      const csp = await TimetableService.initializeCSP(schoolId, constraints, config);
      
      // Step 3: Apply AI algorithms for optimal solution
      const solution = await TimetableService.solveWithAI(csp, optimizationGoals);
      
      // Step 4: Generate timetable entries from solution
      const timetable = await TimetableService.generateTimetableEntries(solution, schoolId, config);
      
      // Step 5: Validate and optimize the generated timetable
      const optimizedTimetable = await TimetableService.optimizeTimetable(timetable, constraints);
      
      // Step 6: Save the generated timetable
      const timetableVersion = await TimetableService.saveTimetable(schoolId, optimizedTimetable, config);

      console.log(`✅ AI Timetable Generation completed successfully`);
      
      return {
        success: true,
        timetableVersionId: timetableVersion.id,
        statistics: solution.statistics,
        conflicts: solution.conflicts,
        optimizationScore: solution.score
      };

    } catch (error) {
      console.error('❌ Timetable generation failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // CONSTRAINT GATHERING SYSTEM
  // =============================================================================

  // Gather all constraints for timetable generation
  static async gatherConstraints(schoolId) {
    const [
      teachers,
      classes,
      subjects,
      rooms,
      teacherAvailability,
      roomAvailability,
      teacherSubjects,
      classSubjects,
      existingTimetable
    ] = await Promise.all([
      // Get all active teachers
      query(`
        SELECT 
          id, first_name, last_name, max_periods_per_day, max_periods_per_week,
          preferred_periods, unavailable_periods, teaching_load_preference
        FROM users 
        WHERE school_id = $1 AND user_type = 'staff' AND role LIKE '%teacher%' AND is_active = true
      `, [schoolId]),

      // Get all active classes
      query(`
        SELECT 
          id, name, grade_level, student_count, periods_per_week_required,
          classroom_requirements, special_requirements
        FROM classes 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]),

      // Get all subjects
      query(`
        SELECT 
          id, name, subject_type, periods_per_week, duration_minutes,
          requires_lab, requires_specialist_room, difficulty_level
        FROM subjects 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]),

      // Get all rooms/facilities
      query(`
        SELECT 
          id, name, room_type, capacity, equipment, 
          is_lab, is_specialist_room, availability_schedule
        FROM rooms 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]),

      // Get teacher availability constraints
      query(`
        SELECT 
          teacher_id, day_of_week, start_time, end_time, availability_type,
          reason, is_recurring
        FROM teacher_availability 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]),

      // Get room availability constraints
      query(`
        SELECT 
          room_id, day_of_week, start_time, end_time, booking_type,
          reason, is_recurring
        FROM room_bookings 
        WHERE school_id = $1 AND is_active = true AND booking_date >= CURRENT_DATE
      `, [schoolId]),

      // Get teacher-subject assignments
      query(`
        SELECT 
          teacher_id, subject_id, proficiency_level, preferred_classes,
          max_periods_per_week, experience_years
        FROM teacher_subjects 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]),

      // Get class-subject requirements
      query(`
        SELECT 
          class_id, subject_id, periods_per_week, period_duration,
          requires_double_period, preferred_days, preferred_times
        FROM class_subjects 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]),

      // Get existing timetable (if any) for reference
      query(`
        SELECT 
          teacher_id, class_id, subject_id, room_id, day_of_week,
          period_number, start_time, end_time, is_fixed
        FROM timetable_entries 
        WHERE school_id = $1 AND is_active = true AND is_fixed = true
      `, [schoolId])
    ]);

    return {
      teachers: teachers.rows,
      classes: classes.rows,
      subjects: subjects.rows,
      rooms: rooms.rows,
      teacherAvailability: teacherAvailability.rows,
      roomAvailability: roomAvailability.rows,
      teacherSubjects: teacherSubjects.rows,
      classSubjects: classSubjects.rows,
      fixedEntries: existingTimetable.rows
    };
  }

  // =============================================================================
  // CONSTRAINT SATISFACTION PROBLEM (CSP) INITIALIZATION
  // =============================================================================

  // Initialize the CSP with variables, domains, and constraints
  static async initializeCSP(schoolId, constraints, config) {
    const { workingDays, periodsPerDay } = config;
    
    // Variables: Each class-subject pair needs to be scheduled
    const variables = [];
    constraints.classSubjects.forEach(cs => {
      const subject = constraints.subjects.find(s => s.id === cs.subject_id);
      const className = constraints.classes.find(c => c.id === cs.class_id);
      
      // Create variables for each required period
      for (let i = 0; i < cs.periods_per_week; i++) {
        variables.push({
          id: `${cs.class_id}_${cs.subject_id}_${i}`,
          classId: cs.class_id,
          subjectId: cs.subject_id,
          className: className.name,
          subjectName: subject.name,
          periodIndex: i,
          requiresLab: subject.requires_lab,
          requiresSpecialistRoom: subject.requires_specialist_room,
          duration: cs.period_duration || subject.duration_minutes || 40
        });
      }
    });

    // Domains: Possible time slots for each variable
    const timeSlots = [];
    workingDays.forEach((day, dayIndex) => {
      for (let period = 1; period <= periodsPerDay; period++) {
        timeSlots.push({
          day: day,
          dayIndex: dayIndex,
          period: period,
          id: `${dayIndex}_${period}`
        });
      }
    });

    // Build domains for each variable based on constraints
    const domains = {};
    variables.forEach(variable => {
      domains[variable.id] = TimetableService.buildDomainForVariable(variable, timeSlots, constraints);
    });

    // Define constraint types
    const constraintTypes = [
      'teacher_availability',
      'room_availability', 
      'class_no_overlap',
      'teacher_no_overlap',
      'room_no_overlap',
      'subject_distribution',
      'teacher_load_balance',
      'preferred_times',
      'consecutive_periods',
      'fixed_periods'
    ];

    return {
      variables,
      domains,
      constraints: constraints,
      constraintTypes,
      timeSlots,
      assignments: {},
      conflicts: [],
      statistics: {
        totalVariables: variables.length,
        totalTimeSlots: timeSlots.length,
        totalConstraints: 0
      }
    };
  }

  // Build valid domain (possible assignments) for a variable
  static buildDomainForVariable(variable, timeSlots, constraints) {
    let validSlots = [...timeSlots];

    // Filter based on room requirements
    if (variable.requiresLab) {
      const labRooms = constraints.rooms.filter(r => r.is_lab);
      if (labRooms.length === 0) {
        console.warn(`⚠️  No lab rooms available for ${variable.subjectName}`);
      }
    }

    // Filter based on teacher availability
    const availableTeachers = constraints.teacherSubjects.filter(ts => 
      ts.subject_id === variable.subjectId
    );

    if (availableTeachers.length === 0) {
      console.warn(`⚠️  No teachers available for ${variable.subjectName}`);
      return [];
    }

    // Add teacher and room information to each valid slot
    validSlots = validSlots.map(slot => {
      const possibleTeachers = availableTeachers.map(ts => ts.teacher_id);
      const possibleRooms = constraints.rooms
        .filter(room => {
          if (variable.requiresLab && !room.is_lab) return false;
          if (variable.requiresSpecialistRoom && !room.is_specialist_room) return false;
          return true;
        })
        .map(room => room.id);

      return {
        ...slot,
        possibleTeachers,
        possibleRooms,
        variable: variable.id
      };
    });

    return validSlots;
  }

  // =============================================================================
  // AI ALGORITHM IMPLEMENTATION
  // =============================================================================

  // Solve CSP using AI algorithms (Backtracking + Heuristics)
  static async solveWithAI(csp, optimizationGoals) {
    console.log(`🧠 Applying AI algorithms with goals: ${optimizationGoals.join(', ')}`);

    // Initialize solution tracking
    const solution = {
      assignments: {},
      conflicts: [],
      iterations: 0,
      score: 0,
      statistics: {
        backtrackCount: 0,
        constraintChecks: 0,
        solutionTime: 0
      }
    };

    const startTime = Date.now();

    try {
      // Apply backtracking with intelligent heuristics
      const success = await TimetableService.backtrackSearch(csp, solution, optimizationGoals);
      
      if (success) {
        // Calculate final optimization score
        solution.score = TimetableService.calculateOptimizationScore(solution, csp, optimizationGoals);
        console.log(`✅ AI solution found with score: ${solution.score.toFixed(2)}`);
      } else {
        console.log(`❌ No complete solution found, returning best partial solution`);
        solution.score = TimetableService.calculateOptimizationScore(solution, csp, optimizationGoals);
      }

    } catch (error) {
      console.error('❌ AI solving failed:', error);
      throw error;
    }

    solution.statistics.solutionTime = Date.now() - startTime;
    return solution;
  }

  // Backtracking search with intelligent variable ordering
  static async backtrackSearch(csp, solution, optimizationGoals, depth = 0) {
    solution.iterations++;

    // Check if we've reached maximum iterations
    if (solution.iterations > 10000) {
      console.log(`⚠️  Maximum iterations reached, stopping search`);
      return false;
    }

    // Select next variable using heuristics
    const nextVariable = TimetableService.selectVariableHeuristic(csp, solution);
    if (!nextVariable) {
      // All variables assigned successfully
      return true;
    }

    // Order domain values using heuristics
    const orderedValues = TimetableService.orderValuesHeuristic(nextVariable, csp, solution);

    for (const value of orderedValues) {
      // Check if assignment is consistent with constraints
      if (TimetableService.isConsistent(nextVariable, value, csp, solution)) {
        // Make assignment
        solution.assignments[nextVariable.id] = value;

        // Apply forward checking and constraint propagation
        const inferenceResult = TimetableService.maintainArcConsistency(csp, solution, nextVariable, value);
        
        if (inferenceResult.success) {
          // Recursively search
          const result = await TimetableService.backtrackSearch(csp, solution, optimizationGoals, depth + 1);
          if (result) {
            return true;
          }
        }

        // Backtrack - remove assignment and restore domains
        delete solution.assignments[nextVariable.id];
        TimetableService.restoreDomains(csp, inferenceResult.removedValues);
        solution.statistics.backtrackCount++;
      }
    }

    return false;
  }

  // Select variable using Most Constraining Variable (MCV) + Most Constrained Variable (MRV) heuristics
  static selectVariableHeuristic(csp, solution) {
    const unassigned = csp.variables.filter(v => !solution.assignments[v.id]);
    if (unassigned.length === 0) return null;

    // MRV: Choose variable with smallest domain
    let candidates = unassigned.filter(v => 
      csp.domains[v.id] && csp.domains[v.id].length > 0
    );

    if (candidates.length === 0) return unassigned[0];

    const minDomainSize = Math.min(...candidates.map(v => csp.domains[v.id].length));
    candidates = candidates.filter(v => csp.domains[v.id].length === minDomainSize);

    if (candidates.length === 1) return candidates[0];

    // MCV: Among tied candidates, choose most constraining
    let maxConstraints = 0;
    let bestCandidate = candidates[0];

    candidates.forEach(variable => {
      const constraintCount = TimetableService.countConstraintsWith(variable, csp, solution);
      if (constraintCount > maxConstraints) {
        maxConstraints = constraintCount;
        bestCandidate = variable;
      }
    });

    return bestCandidate;
  }

  // Order domain values using Least Constraining Value (LCV) heuristic
  static orderValuesHeuristic(variable, csp, solution) {
    const domain = csp.domains[variable.id] || [];
    
    // Score each value by how much it constrains other variables
    const scoredValues = domain.map(value => {
      const constraintScore = TimetableService.calculateConstraintScore(variable, value, csp, solution);
      return { value, score: constraintScore };
    });

    // Sort by least constraining (lowest score) first
    scoredValues.sort((a, b) => a.score - b.score);
    
    return scoredValues.map(sv => sv.value);
  }

  // Check if assignment is consistent with all constraints
  static isConsistent(variable, value, csp, solution) {
    solution.statistics.constraintChecks++;

    // Check each constraint type
    const checks = [
      TimetableService.checkTeacherAvailability(variable, value, csp, solution),
      TimetableService.checkRoomAvailability(variable, value, csp, solution),
      TimetableService.checkClassNoOverlap(variable, value, csp, solution),
      TimetableService.checkTeacherNoOverlap(variable, value, csp, solution),
      TimetableService.checkRoomNoOverlap(variable, value, csp, solution),
      TimetableService.checkFixedPeriods(variable, value, csp, solution)
    ];

    return checks.every(check => check.valid);
  }

  // =============================================================================
  // CONSTRAINT CHECKING FUNCTIONS
  // =============================================================================

  // Check teacher availability constraint
  static checkTeacherAvailability(variable, value, csp, solution) {
    const teachers = value.possibleTeachers || [];
    const availableTeachers = teachers.filter(teacherId => {
      const teacherAvailability = csp.constraints.teacherAvailability.filter(ta => 
        ta.teacher_id === teacherId && ta.day_of_week === value.dayIndex
      );

      // If no specific availability defined, assume available
      if (teacherAvailability.length === 0) return true;

      // Check if time slot conflicts with unavailable periods
      return !teacherAvailability.some(ta => 
        ta.availability_type === 'unavailable' && 
        TimetableService.timeOverlaps(value, ta)
      );
    });

    return {
      valid: availableTeachers.length > 0,
      availableTeachers,
      constraint: 'teacher_availability'
    };
  }

  // Check room availability constraint
  static checkRoomAvailability(variable, value, csp, solution) {
    const rooms = value.possibleRooms || [];
    const availableRooms = rooms.filter(roomId => {
      const roomBookings = csp.constraints.roomAvailability.filter(rb => 
        rb.room_id === roomId && rb.day_of_week === value.dayIndex
      );

      // Check if time slot conflicts with existing bookings
      return !roomBookings.some(rb => TimetableService.timeOverlaps(value, rb));
    });

    return {
      valid: availableRooms.length > 0,
      availableRooms,
      constraint: 'room_availability'
    };
  }

  // Check class doesn't have overlapping periods
  static checkClassNoOverlap(variable, value, csp, solution) {
    const conflictingAssignments = Object.entries(solution.assignments)
      .filter(([varId, assignment]) => {
        if (varId === variable.id) return false;
        const otherVar = csp.variables.find(v => v.id === varId);
        return otherVar && otherVar.classId === variable.classId &&
               assignment.day === value.day && assignment.period === value.period;
      });

    return {
      valid: conflictingAssignments.length === 0,
      conflicts: conflictingAssignments,
      constraint: 'class_no_overlap'
    };
  }

  // Check teacher doesn't have overlapping periods
  static checkTeacherNoOverlap(variable, value, csp, solution) {
    const assignedTeacher = value.possibleTeachers?.[0]; // For now, use first available teacher
    if (!assignedTeacher) return { valid: true, constraint: 'teacher_no_overlap' };

    const conflictingAssignments = Object.entries(solution.assignments)
      .filter(([varId, assignment]) => {
        if (varId === variable.id) return false;
        return assignment.assignedTeacher === assignedTeacher &&
               assignment.day === value.day && assignment.period === value.period;
      });

    return {
      valid: conflictingAssignments.length === 0,
      conflicts: conflictingAssignments,
      constraint: 'teacher_no_overlap'
    };
  }

  // Check room doesn't have overlapping periods
  static checkRoomNoOverlap(variable, value, csp, solution) {
    const assignedRoom = value.possibleRooms?.[0]; // For now, use first available room
    if (!assignedRoom) return { valid: true, constraint: 'room_no_overlap' };

    const conflictingAssignments = Object.entries(solution.assignments)
      .filter(([varId, assignment]) => {
        if (varId === variable.id) return false;
        return assignment.assignedRoom === assignedRoom &&
               assignment.day === value.day && assignment.period === value.period;
      });

    return {
      valid: conflictingAssignments.length === 0,
      conflicts: conflictingAssignments,
      constraint: 'room_no_overlap'
    };
  }

  // Check fixed periods constraint
  static checkFixedPeriods(variable, value, csp, solution) {
    const fixedEntry = csp.constraints.fixedEntries.find(fe => 
      fe.class_id === variable.classId && 
      fe.subject_id === variable.subjectId &&
      fe.day_of_week === value.dayIndex &&
      fe.period_number === value.period
    );

    // If there's a fixed entry for this exact slot, it's valid
    // If there's a fixed entry for this class/subject at different time, it's invalid
    const conflictingFixed = csp.constraints.fixedEntries.find(fe => 
      fe.class_id === variable.classId && 
      fe.subject_id === variable.subjectId &&
      (fe.day_of_week !== value.dayIndex || fe.period_number !== value.period)
    );

    return {
      valid: !conflictingFixed,
      constraint: 'fixed_periods'
    };
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  // Check if two time periods overlap
  static timeOverlaps(slot1, slot2) {
    // Simplified overlap check - can be enhanced with actual time comparison
    return slot1.day === slot2.day && slot1.period === slot2.period;
  }

  // Count constraints involving a variable
  static countConstraintsWith(variable, csp, solution) {
    let count = 0;
    
    // Count other variables that share constraints with this variable
    csp.variables.forEach(otherVar => {
      if (otherVar.id !== variable.id) {
        if (otherVar.classId === variable.classId) count++; // Same class
        
        // Check if they share teachers
        const teachersForVar = csp.constraints.teacherSubjects.filter(ts => ts.subject_id === variable.subjectId);
        const teachersForOther = csp.constraints.teacherSubjects.filter(ts => ts.subject_id === otherVar.subjectId);
        const sharedTeachers = teachersForVar.some(tv => teachersForOther.some(to => to.teacher_id === tv.teacher_id));
        if (sharedTeachers) count++;
      }
    });

    return count;
  }

  // Calculate constraint score for LCV heuristic
  static calculateConstraintScore(variable, value, csp, solution) {
    let score = 0;

    // Penalize choices that reduce options for other variables
    const affectedVariables = csp.variables.filter(v => 
      v.id !== variable.id && !solution.assignments[v.id]
    );

    affectedVariables.forEach(affectedVar => {
      const wouldConflict = TimetableService.wouldConflictWith(variable, value, affectedVar, csp);
      if (wouldConflict) {
        score += 10; // High penalty for creating conflicts
      }
    });

    return score;
  }

  // Check if assignment would conflict with another variable
  static wouldConflictWith(variable1, value1, variable2, csp) {
    // Same class, same time
    if (variable1.classId === variable2.classId) {
      return csp.domains[variable2.id]?.some(value2 => 
        value2.day === value1.day && value2.period === value1.period
      );
    }

    // Same teacher, same time (simplified check)
    const teachers1 = value1.possibleTeachers || [];
    const domain2 = csp.domains[variable2.id] || [];
    
    return domain2.some(value2 => {
      const teachers2 = value2.possibleTeachers || [];
      const sharedTeacher = teachers1.some(t1 => teachers2.includes(t1));
      return sharedTeacher && value2.day === value1.day && value2.period === value1.period;
    });
  }

  // Maintain arc consistency (simplified AC-3)
  static maintainArcConsistency(csp, solution, assignedVariable, assignedValue) {
    const removedValues = [];
    
    // For each variable that could be affected by this assignment
    csp.variables.forEach(variable => {
      if (variable.id !== assignedVariable.id && !solution.assignments[variable.id]) {
        const originalDomain = csp.domains[variable.id] || [];
        const filteredDomain = originalDomain.filter(value => {
          // Check if this value is still consistent given the new assignment
          return !TimetableService.conflictsWith(assignedVariable, assignedValue, variable, value);
        });

        if (filteredDomain.length < originalDomain.length) {
          const removed = originalDomain.filter(v => !filteredDomain.includes(v));
          removedValues.push({ variable: variable.id, values: removed });
          csp.domains[variable.id] = filteredDomain;
        }
      }
    });

    return {
      success: true,
      removedValues
    };
  }

  // Check if two assignments conflict
  static conflictsWith(var1, val1, var2, val2) {
    // Same class, same time
    if (var1.classId === var2.classId && val1.day === val2.day && val1.period === val2.period) {
      return true;
    }

    // Same teacher, same time (simplified)
    const teachers1 = val1.possibleTeachers || [];
    const teachers2 = val2.possibleTeachers || [];
    const sharedTeacher = teachers1.some(t1 => teachers2.includes(t1));
    
    if (sharedTeacher && val1.day === val2.day && val1.period === val2.period) {
      return true;
    }

    // Same room, same time (simplified)
    const rooms1 = val1.possibleRooms || [];
    const rooms2 = val2.possibleRooms || [];
    const sharedRoom = rooms1.some(r1 => rooms2.includes(r1));
    
    if (sharedRoom && val1.day === val2.day && val1.period === val2.period) {
      return true;
    }

    return false;
  }

  // Restore domains after backtracking
  static restoreDomains(csp, removedValues) {
    removedValues.forEach(({ variable, values }) => {
      csp.domains[variable] = [...(csp.domains[variable] || []), ...values];
    });
  }

  // Calculate optimization score
  static calculateOptimizationScore(solution, csp, optimizationGoals) {
    let score = 0;
    const weights = {
      minimize_conflicts: 0.4,
      balance_teacher_load: 0.3,
      maximize_room_utilization: 0.2,
      respect_preferences: 0.1
    };

    optimizationGoals.forEach(goal => {
      const weight = weights[goal] || 0.1;
      let goalScore = 0;

      switch (goal) {
        case 'minimize_conflicts':
          goalScore = 100 - (solution.conflicts.length * 10); // Penalty for conflicts
          break;
        
        case 'balance_teacher_load':
          goalScore = TimetableService.calculateTeacherLoadBalance(solution, csp);
          break;
        
        case 'maximize_room_utilization':
          goalScore = TimetableService.calculateRoomUtilization(solution, csp);
          break;
        
        case 'respect_preferences':
          goalScore = TimetableService.calculatePreferenceScore(solution, csp);
          break;
      }

      score += goalScore * weight;
    });

    return Math.max(0, Math.min(100, score)); // Clamp between 0-100
  }

  // Calculate teacher load balance score
  static calculateTeacherLoadBalance(solution, csp) {
    const teacherLoads = {};
    
    Object.values(solution.assignments).forEach(assignment => {
      const teacher = assignment.assignedTeacher || assignment.possibleTeachers?.[0];
      if (teacher) {
        teacherLoads[teacher] = (teacherLoads[teacher] || 0) + 1;
      }
    });

    const loads = Object.values(teacherLoads);
    if (loads.length === 0) return 100;

    const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
    
    // Lower variance = better balance = higher score
    return Math.max(0, 100 - variance * 5);
  }

  // Calculate room utilization score
  static calculateRoomUtilization(solution, csp) {
    const totalSlots = csp.timeSlots.length * csp.constraints.rooms.length;
    const usedSlots = Object.values(solution.assignments).length;
    
    return Math.min(100, (usedSlots / totalSlots) * 100);
  }

  // Calculate preference adherence score
  static calculatePreferenceScore(solution, csp) {
    // Simplified preference scoring
    return 75; // Placeholder - would implement actual preference checking
  }

  // =============================================================================
  // TIMETABLE GENERATION AND SAVING
  // =============================================================================

  // Generate timetable entries from solution
  static async generateTimetableEntries(solution, schoolId, config) {
    const entries = [];

    Object.entries(solution.assignments).forEach(([variableId, assignment]) => {
      const variable = solution.csp?.variables.find(v => v.id === variableId);
      if (!variable) return;

      // Assign specific teacher and room
      const assignedTeacher = assignment.assignedTeacher || assignment.possibleTeachers?.[0];
      const assignedRoom = assignment.assignedRoom || assignment.possibleRooms?.[0];

      entries.push({
        school_id: schoolId,
        class_id: variable.classId,
        subject_id: variable.subjectId,
        teacher_id: assignedTeacher,
        room_id: assignedRoom,
        day_of_week: assignment.dayIndex,
        period_number: assignment.period,
        start_time: TimetableService.calculateStartTime(assignment.period, config),
        end_time: TimetableService.calculateEndTime(assignment.period, config),
        duration_minutes: variable.duration,
        is_fixed: false,
        is_active: true
      });
    });

    return entries;
  }

  // Calculate start time for a period
  static calculateStartTime(periodNumber, config) {
    const schoolStartTime = config.schoolStartTime || '08:00';
    const periodDuration = config.periodDuration || 40;
    const breakPeriods = config.breakPeriods || [];

    let totalMinutes = 0;
    
    // Add minutes for previous periods
    for (let i = 1; i < periodNumber; i++) {
      totalMinutes += periodDuration;
      
      // Add break time if applicable
      const breakAfter = breakPeriods.find(bp => bp.after === i);
      if (breakAfter) {
        totalMinutes += breakAfter.duration;
      }
    }

    const [startHour, startMinute] = schoolStartTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startHour, startMinute + totalMinutes, 0, 0);
    
    return startDate.toTimeString().slice(0, 8);
  }

  // Calculate end time for a period
  static calculateEndTime(periodNumber, config) {
    const startTime = TimetableService.calculateStartTime(periodNumber, config);
    const periodDuration = config.periodDuration || 40;
    
    const [hour, minute, second] = startTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hour, minute + periodDuration, second, 0);
    
    return endDate.toTimeString().slice(0, 8);
  }

  // Optimize generated timetable
  static async optimizeTimetable(timetable, constraints) {
    // Apply post-processing optimizations
    const optimized = [...timetable];

    // 1. Minimize teacher transitions between buildings
    TimetableService.optimizeTeacherMovement(optimized, constraints);

    // 2. Group consecutive periods for same subject when beneficial
    TimetableService.optimizeConsecutivePeriods(optimized, constraints);

    // 3. Respect preferred time slots when possible
    TimetableService.optimizePreferredTimes(optimized, constraints);

    return optimized;
  }

  // Save timetable to database
  static async saveTimetable(schoolId, timetableEntries, config) {
    try {
      await query('BEGIN');

      // Create new timetable version
      const versionResult = await query(`
        INSERT INTO timetable_versions (
          school_id, name, description, academic_year, term,
          start_date, end_date, status, created_by, generation_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)
        RETURNING *
      `, [
        schoolId,
        `AI Generated Timetable ${new Date().toISOString().split('T')[0]}`,
        'Automatically generated using AI algorithms',
        config.academicYear,
        config.term,
        config.startDate,
        config.endDate,
        'system',
        JSON.stringify(config)
      ]);

      const versionId = versionResult.rows[0].id;

      // Insert timetable entries
      for (const entry of timetableEntries) {
        await query(`
          INSERT INTO timetable_entries (
            timetable_version_id, school_id, class_id, subject_id, teacher_id, room_id,
            day_of_week, period_number, start_time, end_time, duration_minutes,
            is_fixed, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          versionId, entry.school_id, entry.class_id, entry.subject_id, 
          entry.teacher_id, entry.room_id, entry.day_of_week, entry.period_number,
          entry.start_time, entry.end_time, entry.duration_minutes,
          entry.is_fixed, entry.is_active
        ]);
      }

      await query('COMMIT');

      console.log(`✅ Timetable saved with ${timetableEntries.length} entries`);
      
      return versionResult.rows[0];

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  // =============================================================================
  // OPTIMIZATION FUNCTIONS
  // =============================================================================

  // Optimize teacher movement between rooms/buildings
  static optimizeTeacherMovement(timetable, constraints) {
    // Group entries by teacher and day
    const teacherSchedules = {};
    
    timetable.forEach(entry => {
      const key = `${entry.teacher_id}_${entry.day_of_week}`;
      if (!teacherSchedules[key]) {
        teacherSchedules[key] = [];
      }
      teacherSchedules[key].push(entry);
    });

    // Sort each teacher's daily schedule and optimize room assignments
    Object.values(teacherSchedules).forEach(schedule => {
      schedule.sort((a, b) => a.period_number - b.period_number);
      
      // Try to assign consecutive periods in the same room when possible
      for (let i = 1; i < schedule.length; i++) {
        const current = schedule[i];
        const previous = schedule[i - 1];
        
        if (current.period_number === previous.period_number + 1) {
          // Consecutive periods - try to use same room if possible
          const room = constraints.rooms.find(r => r.id === previous.room_id);
          if (room && TimetableService.canUseRoom(current, room, constraints)) {
            current.room_id = room.id;
          }
        }
      }
    });
  }

  // Optimize consecutive periods for same subject
  static optimizeConsecutivePeriods(timetable, constraints) {
    // Find subjects that benefit from double periods
    const doublePeriodsSubjects = constraints.classSubjects.filter(cs => cs.requires_double_period);
    
    doublePeriodsSubjects.forEach(cs => {
      const subjectEntries = timetable.filter(entry => 
        entry.class_id === cs.class_id && entry.subject_id === cs.subject_id
      );

      // Try to arrange in consecutive pairs
      for (let i = 0; i < subjectEntries.length - 1; i += 2) {
        const entry1 = subjectEntries[i];
        const entry2 = subjectEntries[i + 1];
        
        if (entry1 && entry2) {
          // Try to make them consecutive
          TimetableService.makeConsecutive(entry1, entry2, timetable);
        }
      }
    });
  }

  // Optimize based on preferred times
  static optimizePreferredTimes(timetable, constraints) {
    constraints.classSubjects.forEach(cs => {
      if (cs.preferred_times) {
        const preferredTimes = JSON.parse(cs.preferred_times);
        const subjectEntries = timetable.filter(entry => 
          entry.class_id === cs.class_id && entry.subject_id === cs.subject_id
        );

        subjectEntries.forEach(entry => {
          const preferredSlot = preferredTimes.find(pt => 
            pt.day === entry.day_of_week && 
            TimetableService.isInPreferredTimeRange(entry.period_number, pt)
          );

          if (preferredSlot) {
            // Entry is already in preferred time - increase priority
            entry.priority = (entry.priority || 0) + 10;
          }
        });
      }
    });
  }

  // Helper functions for optimization
  static canUseRoom(entry, room, constraints) {
    // Check if room meets requirements and is available
    if (entry.requires_lab && !room.is_lab) return false;
    if (entry.requires_specialist_room && !room.is_specialist_room) return false;
    
    // Check room availability (simplified)
    return true;
  }

  static makeConsecutive(entry1, entry2, timetable) {
    // Simplified implementation - would include complex swapping logic
    if (entry1.day_of_week === entry2.day_of_week && 
        Math.abs(entry1.period_number - entry2.period_number) === 1) {
      // Already consecutive
      return true;
    }
    
    // Try to find available consecutive slots
    // Implementation would involve complex constraint checking and swapping
    return false;
  }

  static isInPreferredTimeRange(period, preferredTime) {
    return period >= preferredTime.start_period && period <= preferredTime.end_period;
  }

  // =============================================================================
  // CONFLICT DETECTION AND RESOLUTION
  // =============================================================================

  // Detect conflicts in generated timetable
  static async detectConflicts(timetableEntries) {
    const conflicts = [];

    // Group entries by time slot
    const timeSlots = {};
    timetableEntries.forEach(entry => {
      const key = `${entry.day_of_week}_${entry.period_number}`;
      if (!timeSlots[key]) {
        timeSlots[key] = [];
      }
      timeSlots[key].push(entry);
    });

    // Check for conflicts in each time slot
    Object.entries(timeSlots).forEach(([slot, entries]) => {
      const [day, period] = slot.split('_');

      // Teacher conflicts
      const teacherMap = {};
      entries.forEach(entry => {
        if (entry.teacher_id) {
          if (teacherMap[entry.teacher_id]) {
            conflicts.push({
              type: 'teacher_overlap',
              description: `Teacher ${entry.teacher_id} has overlapping classes`,
              day: parseInt(day),
              period: parseInt(period),
              entries: [teacherMap[entry.teacher_id], entry]
            });
          } else {
            teacherMap[entry.teacher_id] = entry;
          }
        }
      });

      // Room conflicts
      const roomMap = {};
      entries.forEach(entry => {
        if (entry.room_id) {
          if (roomMap[entry.room_id]) {
            conflicts.push({
              type: 'room_overlap',
              description: `Room ${entry.room_id} has overlapping bookings`,
              day: parseInt(day),
              period: parseInt(period),
              entries: [roomMap[entry.room_id], entry]
            });
          } else {
            roomMap[entry.room_id] = entry;
          }
        }
      });

      // Class conflicts (class having multiple subjects at same time)
      const classMap = {};
      entries.forEach(entry => {
        if (classMap[entry.class_id]) {
          conflicts.push({
            type: 'class_overlap',
            description: `Class ${entry.class_id} has overlapping subjects`,
            day: parseInt(day),
            period: parseInt(period),
            entries: [classMap[entry.class_id], entry]
          });
        } else {
          classMap[entry.class_id] = entry;
        }
      });
    });

    return conflicts;
  }

  // =============================================================================
  // ANALYTICS AND REPORTING
  // =============================================================================

  // Generate timetable analytics
  static async generateTimetableAnalytics(timetableVersionId) {
    const [entries, conflicts, utilization] = await Promise.all([
      // Get all timetable entries
      query(`
        SELECT te.*, c.name as class_name, s.name as subject_name,
               u.first_name || ' ' || u.last_name as teacher_name, r.name as room_name
        FROM timetable_entries te
        JOIN classes c ON te.class_id = c.id
        JOIN subjects s ON te.subject_id = s.id
        LEFT JOIN users u ON te.teacher_id = u.id
        LEFT JOIN rooms r ON te.room_id = r.id
        WHERE te.timetable_version_id = $1
      `, [timetableVersionId]),

      // Get conflicts
      TimetableService.detectConflicts([]), // Would pass actual entries

      // Calculate utilization
      query(`
        SELECT 
          COUNT(*) as total_periods,
          COUNT(DISTINCT teacher_id) as teachers_used,
          COUNT(DISTINCT room_id) as rooms_used,
          COUNT(DISTINCT class_id) as classes_scheduled
        FROM timetable_entries
        WHERE timetable_version_id = $1
      `, [timetableVersionId])
    ]);

    // Calculate teacher workload distribution
    const teacherWorkloads = {};
    entries.rows.forEach(entry => {
      if (entry.teacher_id) {
        const key = `${entry.teacher_id}_${entry.teacher_name}`;
        teacherWorkloads[key] = (teacherWorkloads[key] || 0) + 1;
      }
    });

    // Calculate room utilization
    const roomUtilization = {};
    entries.rows.forEach(entry => {
      if (entry.room_id) {
        const key = `${entry.room_id}_${entry.room_name}`;
        roomUtilization[key] = (roomUtilization[key] || 0) + 1;
      }
    });

    return {
      summary: utilization.rows[0],
      conflicts: conflicts,
      teacherWorkloads: Object.entries(teacherWorkloads).map(([key, count]) => ({
        teacher: key.split('_')[1],
        periods: count
      })),
      roomUtilization: Object.entries(roomUtilization).map(([key, count]) => ({
        room: key.split('_')[1],
        periods: count
      })),
      qualityScore: TimetableService.calculateQualityScore(entries.rows, conflicts)
    };
  }

  // Calculate overall timetable quality score
  static calculateQualityScore(entries, conflicts) {
    let score = 100;

    // Penalty for conflicts
    score -= conflicts.length * 10;

    // Penalty for unassigned periods (entries without teacher or room)
    const unassignedCount = entries.filter(entry => !entry.teacher_id || !entry.room_id).length;
    score -= unassignedCount * 5;

    // Bonus for balanced distribution
    const teacherCounts = {};
    entries.forEach(entry => {
      if (entry.teacher_id) {
        teacherCounts[entry.teacher_id] = (teacherCounts[entry.teacher_id] || 0) + 1;
      }
    });

    const counts = Object.values(teacherCounts);
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    
    // Lower variance = better balance = higher score
    score += Math.max(0, 20 - variance);

    return Math.max(0, Math.min(100, score));
  }
}

module.exports = TimetableService;