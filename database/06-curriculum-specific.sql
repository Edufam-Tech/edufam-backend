-- ====================================
-- CURRICULUM-SPECIFIC SYSTEM
-- ====================================
-- This module handles different educational curricula including
-- CBC (Competency Based Curriculum), IGCSE, 8-4-4, IB, and other systems

-- Curriculum Systems Registry
CREATE TABLE curriculum_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_code VARCHAR(20) UNIQUE NOT NULL, -- CBC, IGCSE, 8-4-4, IB, CAMBRIDGE, etc.
    curriculum_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255), -- Competency Based Curriculum, International General Certificate of Secondary Education
    description TEXT,
    
    -- System Details
    country_origin VARCHAR(100), -- Kenya, United Kingdom, International
    education_board VARCHAR(100), -- KICD, Cambridge Assessment, etc.
    official_website VARCHAR(500),
    curriculum_version VARCHAR(20), -- For tracking curriculum updates
    
    -- Structure Information
    grade_levels VARCHAR(10)[], -- Pre-Primary 1, Pre-Primary 2, Grade 1-6, Form 1-4, etc.
    age_ranges JSONB, -- {"Grade 1": {"min_age": 6, "max_age": 7}, ...}
    duration_years INTEGER, -- Total duration of the curriculum
    
    -- Assessment Information
    assessment_system VARCHAR(50), -- continuous_assessment, standardized_exams, mixed
    grading_scale VARCHAR(20), -- A-E, 1-7, percentage, etc.
    grade_boundaries JSONB, -- Grade thresholds and meanings
    
    -- Key Features
    competency_based BOOLEAN DEFAULT false,
    skills_based BOOLEAN DEFAULT false,
    exam_based BOOLEAN DEFAULT true,
    continuous_assessment BOOLEAN DEFAULT true,
    
    -- Language and Localization
    primary_language VARCHAR(50) DEFAULT 'English',
    supported_languages VARCHAR(50)[], -- For multilingual curricula
    local_adaptations BOOLEAN DEFAULT false, -- Can be adapted to local contexts
    
    -- Compliance and Recognition
    international_recognition BOOLEAN DEFAULT false,
    university_admission_support BOOLEAN DEFAULT true,
    professional_certification BOOLEAN DEFAULT false,
    
    -- Status and Management
    is_active BOOLEAN DEFAULT true,
    implementation_date DATE,
    last_updated DATE DEFAULT CURRENT_DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Curriculum Grade Levels
CREATE TABLE curriculum_grade_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    
    -- Grade Information
    grade_code VARCHAR(20) NOT NULL, -- PP1, PP2, G1, G2, F1, F2, Y7, Y8, etc.
    grade_name VARCHAR(50) NOT NULL, -- Pre-Primary 1, Grade 1, Form 1, Year 7
    display_order INTEGER NOT NULL, -- For sorting grades
    
    -- Age and Duration
    typical_age_min INTEGER, -- Minimum typical age
    typical_age_max INTEGER, -- Maximum typical age
    duration_months INTEGER DEFAULT 12, -- Usually 12 months, but could vary
    
    -- Academic Information
    is_examination_grade BOOLEAN DEFAULT false, -- KCPE, KCSE, IGCSE, etc.
    is_transition_grade BOOLEAN DEFAULT false, -- Grade 6 (to Junior Secondary), Form 4, etc.
    next_level_requirement TEXT, -- Requirements to progress to next level
    
    -- Curriculum Specific
    key_stage VARCHAR(20), -- KS1, KS2, KS3, KS4 for British systems
    phase VARCHAR(30), -- Primary, Junior Secondary, Senior Secondary
    specialization_available BOOLEAN DEFAULT false, -- Can students choose specializations
    
    -- Assessment
    assessment_frequency VARCHAR(20), -- termly, quarterly, continuous, annual
    major_assessments TEXT[], -- List of major assessments in this grade
    
    -- Learning Areas/Subjects
    core_subjects TEXT[], -- Mandatory subjects
    optional_subjects TEXT[], -- Optional/elective subjects
    minimum_subjects INTEGER, -- Minimum number of subjects to take
    maximum_subjects INTEGER, -- Maximum number of subjects allowed
    
    -- Progression Rules
    promotion_criteria TEXT, -- What's needed to move to next grade
    repeat_conditions TEXT, -- When a student needs to repeat
    dropout_points TEXT[], -- Common points where students might leave
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(curriculum_id, grade_code)
);

-- Curriculum Subjects
CREATE TABLE curriculum_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    
    -- Subject Details
    subject_code VARCHAR(20) NOT NULL, -- ENG, MAT, SCI, HIST, etc.
    subject_name VARCHAR(100) NOT NULL, -- English Language, Mathematics, Science
    full_name VARCHAR(255), -- More descriptive name if needed
    subject_category VARCHAR(50), -- Languages, STEM, Humanities, Arts, etc.
    
    -- Subject Type
    subject_type VARCHAR(30) NOT NULL CHECK (subject_type IN ('core', 'optional', 'elective', 'specialization')),
    is_mandatory BOOLEAN DEFAULT false,
    prerequisite_subjects TEXT[], -- Prerequisites for this subject
    
    -- Grade Applicability
    available_grades VARCHAR(10)[], -- Which grades offer this subject
    introduction_grade VARCHAR(10), -- First grade where subject is introduced
    final_grade VARCHAR(10), -- Last grade where subject is offered
    
    -- Assessment Information
    assessment_type VARCHAR(30), -- written_exam, practical, coursework, project, oral
    assessment_components JSONB, -- {"theory": 70, "practical": 30} percentages
    grading_method VARCHAR(30), -- letter_grade, numerical, percentage, competency
    
    -- Learning Standards
    learning_outcomes TEXT[], -- What students should achieve
    key_competencies TEXT[], -- Core competencies for this subject
    skill_areas TEXT[], -- Specific skill areas covered
    
    -- Curriculum Mapping
    strand_areas TEXT[], -- Curriculum strands/domains
    learning_objectives_by_grade JSONB, -- Grade-specific objectives
    
    -- Resource Requirements
    practical_requirements BOOLEAN DEFAULT false, -- Requires lab/practical work
    equipment_needed TEXT[], -- Specific equipment/materials needed
    textbook_recommendations TEXT[],
    
    -- External Examinations
    external_exam_available BOOLEAN DEFAULT false,
    exam_board VARCHAR(100), -- KNEC, Cambridge, Edexcel, etc.
    exam_fee_currency VARCHAR(3) DEFAULT 'KES',
    exam_fee_amount DECIMAL(10,2),
    
    -- Subject Status
    is_active BOOLEAN DEFAULT true,
    phase_out_date DATE, -- If subject is being phased out
    replacement_subject_id UUID REFERENCES curriculum_subjects(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(curriculum_id, subject_code)
);

-- Curriculum Assessment Standards
CREATE TABLE curriculum_assessment_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
    grade_level_id UUID REFERENCES curriculum_grade_levels(id) ON DELETE CASCADE,
    
    -- Standard Details
    standard_code VARCHAR(30) NOT NULL,
    standard_title VARCHAR(200) NOT NULL,
    standard_description TEXT,
    
    -- Classification
    standard_type VARCHAR(30) CHECK (standard_type IN ('learning_outcome', 'competency', 'skill', 'knowledge_area')),
    domain_area VARCHAR(100), -- Reading, Writing, Number Operations, etc.
    complexity_level VARCHAR(20) CHECK (complexity_level IN ('basic', 'intermediate', 'advanced', 'mastery')),
    
    -- Assessment Criteria
    assessment_methods TEXT[], -- observation, test, project, portfolio, etc.
    evidence_requirements TEXT[], -- What evidence demonstrates mastery
    
    -- Performance Levels
    performance_descriptors JSONB, -- Different levels of achievement
    mastery_criteria TEXT, -- What constitutes mastery
    
    -- Learning Progression
    prerequisite_standards TEXT[], -- Standards that should be met first
    builds_to_standards TEXT[], -- Standards this leads to
    
    -- Implementation
    teaching_strategies TEXT[], -- Recommended teaching approaches
    resources_needed TEXT[], -- Required resources
    time_allocation_hours INTEGER, -- Recommended time allocation
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    review_date DATE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(curriculum_id, standard_code)
);

-- Curriculum Mapping (Cross-curriculum equivalencies)
CREATE TABLE curriculum_equivalencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source Curriculum
    source_curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    source_grade_id UUID REFERENCES curriculum_grade_levels(id),
    source_subject_id UUID REFERENCES curriculum_subjects(id),
    
    -- Target Curriculum
    target_curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    target_grade_id UUID REFERENCES curriculum_grade_levels(id),
    target_subject_id UUID REFERENCES curriculum_subjects(id),
    
    -- Equivalency Details
    equivalency_type VARCHAR(30) CHECK (equivalency_type IN ('grade_level', 'subject', 'assessment', 'qualification')),
    equivalency_strength VARCHAR(20) CHECK (equivalency_strength IN ('exact', 'close', 'partial', 'approximate')),
    notes TEXT, -- Additional notes about the equivalency
    
    -- Conversion Information
    grade_conversion_factor DECIMAL(5,2), -- For grade conversions
    assessment_mapping JSONB, -- How assessments map between curricula
    
    -- Recognition
    officially_recognized BOOLEAN DEFAULT false,
    recognition_body VARCHAR(100), -- Who recognizes this equivalency
    recognition_date DATE,
    
    -- Validity
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Ensure we don't have duplicate mappings
    UNIQUE(source_curriculum_id, source_grade_id, source_subject_id, target_curriculum_id, target_grade_id, target_subject_id)
);

-- School Curriculum Implementation
CREATE TABLE school_curriculum_implementation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    
    -- Implementation Details
    implementation_status VARCHAR(20) DEFAULT 'planning' CHECK (implementation_status IN ('planning', 'pilot', 'partial', 'full', 'phasing_out', 'discontinued')),
    implementation_date DATE NOT NULL,
    phase_out_date DATE, -- If curriculum is being phased out
    
    -- Coverage
    grade_levels_implemented VARCHAR(10)[], -- Which grades are using this curriculum
    subjects_implemented TEXT[], -- Which subjects are following this curriculum
    percentage_implementation DECIMAL(5,2) DEFAULT 100.00, -- Percentage of full implementation
    
    -- Resources and Support
    teacher_training_completed BOOLEAN DEFAULT false,
    teacher_training_date DATE,
    resources_acquired BOOLEAN DEFAULT false,
    assessment_tools_ready BOOLEAN DEFAULT false,
    
    -- Performance Tracking
    student_performance_baseline JSONB, -- Baseline performance before implementation
    current_performance_metrics JSONB, -- Current performance data
    improvement_targets JSONB, -- Target improvements
    
    -- Challenges and Solutions
    implementation_challenges TEXT[],
    solutions_implemented TEXT[],
    support_needed TEXT[],
    
    -- External Support
    ministry_support_received BOOLEAN DEFAULT false,
    consultant_support BOOLEAN DEFAULT false,
    peer_school_collaboration BOOLEAN DEFAULT false,
    
    -- Compliance and Reporting
    compliance_status VARCHAR(20) DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'partial', 'non_compliant', 'under_review')),
    last_inspection_date DATE,
    next_review_date DATE,
    
    -- Financial Impact
    implementation_cost DECIMAL(12,2),
    annual_maintenance_cost DECIMAL(12,2),
    funding_source VARCHAR(100), -- government, private, donor, mixed
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(school_id, curriculum_id)
);

-- Student Curriculum Progress
CREATE TABLE student_curriculum_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    curriculum_id UUID NOT NULL REFERENCES curriculum_systems(id) ON DELETE CASCADE,
    
    -- Current Status
    current_grade_level_id UUID NOT NULL REFERENCES curriculum_grade_levels(id),
    academic_year VARCHAR(20) NOT NULL, -- 2024/2025, 2024, etc.
    term_semester VARCHAR(20), -- Term 1, Semester 1, etc.
    
    -- Progress Tracking
    subjects_enrolled TEXT[], -- Subjects the student is taking
    subjects_completed TEXT[], -- Subjects successfully completed
    subjects_failed TEXT[], -- Subjects that need to be repeated
    
    -- Performance
    overall_grade VARCHAR(10), -- Overall grade/performance level
    gpa_score DECIMAL(4,2), -- If applicable
    class_rank INTEGER, -- Student's rank in class
    total_students_in_class INTEGER,
    
    -- Competency Tracking (for CBC)
    competencies_achieved TEXT[], -- Competencies student has mastered
    competencies_developing TEXT[], -- Competencies in progress
    competencies_needs_support TEXT[], -- Competencies needing extra support
    
    -- Learning Areas Performance
    subject_performance JSONB, -- Performance in each subject
    
    -- Assessment Results
    assessment_scores JSONB, -- Detailed assessment scores
    exam_results JSONB, -- Major exam results
    
    -- Progression Status
    promotion_status VARCHAR(20) DEFAULT 'on_track' CHECK (promotion_status IN ('promoted', 'on_track', 'at_risk', 'retained', 'transferred')),
    promotion_date DATE,
    retention_reason TEXT,
    
    -- Learning Support
    individualized_support_plan BOOLEAN DEFAULT false,
    special_needs_accommodation TEXT[],
    additional_support_provided TEXT[],
    
    -- Parent/Guardian Engagement
    parent_conference_dates DATE[],
    parent_engagement_level VARCHAR(20) DEFAULT 'moderate' CHECK (parent_engagement_level IN ('low', 'moderate', 'high', 'very_high')),
    
    -- Predictions and Interventions
    risk_factors TEXT[], -- Factors that might affect progress
    intervention_strategies TEXT[], -- Strategies being used to support student
    predicted_outcomes TEXT[], -- Expected outcomes based on current progress
    
    -- External Assessments
    national_exam_eligibility BOOLEAN DEFAULT true,
    external_exam_registrations JSONB, -- Registrations for external exams
    
    -- Status and Validity
    is_current BOOLEAN DEFAULT true,
    academic_year_start DATE,
    academic_year_end DATE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_updated_by UUID REFERENCES users(id),
    
    -- Ensure one current record per student per curriculum per academic year
    UNIQUE(student_id, curriculum_id, academic_year) WHERE is_current = true
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Curriculum systems indexes
CREATE INDEX idx_curriculum_systems_code ON curriculum_systems(curriculum_code);
CREATE INDEX idx_curriculum_systems_country ON curriculum_systems(country_origin);
CREATE INDEX idx_curriculum_systems_active ON curriculum_systems(is_active) WHERE is_active = true;

-- Grade levels indexes
CREATE INDEX idx_curriculum_grade_levels_curriculum ON curriculum_grade_levels(curriculum_id);
CREATE INDEX idx_curriculum_grade_levels_order ON curriculum_grade_levels(display_order);
CREATE INDEX idx_curriculum_grade_levels_exam ON curriculum_grade_levels(is_examination_grade) WHERE is_examination_grade = true;

-- Subjects indexes
CREATE INDEX idx_curriculum_subjects_curriculum ON curriculum_subjects(curriculum_id);
CREATE INDEX idx_curriculum_subjects_type ON curriculum_subjects(subject_type);
CREATE INDEX idx_curriculum_subjects_category ON curriculum_subjects(subject_category);
CREATE INDEX idx_curriculum_subjects_mandatory ON curriculum_subjects(is_mandatory) WHERE is_mandatory = true;

-- Assessment standards indexes
CREATE INDEX idx_curriculum_assessment_curriculum ON curriculum_assessment_standards(curriculum_id);
CREATE INDEX idx_curriculum_assessment_subject ON curriculum_assessment_standards(subject_id);
CREATE INDEX idx_curriculum_assessment_grade ON curriculum_assessment_standards(grade_level_id);
CREATE INDEX idx_curriculum_assessment_type ON curriculum_assessment_standards(standard_type);

-- Equivalencies indexes
CREATE INDEX idx_curriculum_equivalencies_source ON curriculum_equivalencies(source_curriculum_id);
CREATE INDEX idx_curriculum_equivalencies_target ON curriculum_equivalencies(target_curriculum_id);
CREATE INDEX idx_curriculum_equivalencies_type ON curriculum_equivalencies(equivalency_type);

-- School implementation indexes
CREATE INDEX idx_school_curriculum_impl_school ON school_curriculum_implementation(school_id);
CREATE INDEX idx_school_curriculum_impl_curriculum ON school_curriculum_implementation(curriculum_id);
CREATE INDEX idx_school_curriculum_impl_status ON school_curriculum_implementation(implementation_status);

-- Student progress indexes
CREATE INDEX idx_student_curriculum_progress_student ON student_curriculum_progress(student_id);
CREATE INDEX idx_student_curriculum_progress_school ON student_curriculum_progress(school_id);
CREATE INDEX idx_student_curriculum_progress_curriculum ON student_curriculum_progress(curriculum_id);
CREATE INDEX idx_student_curriculum_progress_grade ON student_curriculum_progress(current_grade_level_id);
CREATE INDEX idx_student_curriculum_progress_current ON student_curriculum_progress(is_current) WHERE is_current = true;
CREATE INDEX idx_student_curriculum_progress_year ON student_curriculum_progress(academic_year);

-- ====================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================

-- Enable RLS on all curriculum tables
ALTER TABLE curriculum_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_assessment_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_equivalencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_curriculum_implementation ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_curriculum_progress ENABLE ROW LEVEL SECURITY;

-- Curriculum systems policies (readable by all authenticated users, manageable by admins)
CREATE POLICY curriculum_systems_read_all ON curriculum_systems
    FOR SELECT USING (is_active = true);

CREATE POLICY curriculum_systems_admin_manage ON curriculum_systems
    FOR ALL USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'curriculum_specialist')
        )
    );

-- Grade levels and subjects (readable by all, manageable by admins)
CREATE POLICY curriculum_grade_levels_read_all ON curriculum_grade_levels
    FOR SELECT USING (true);

CREATE POLICY curriculum_grade_levels_admin_manage ON curriculum_grade_levels
    FOR INSERT USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'curriculum_specialist')
        )
    );

CREATE POLICY curriculum_subjects_read_all ON curriculum_subjects
    FOR SELECT USING (is_active = true);

CREATE POLICY curriculum_subjects_admin_manage ON curriculum_subjects
    FOR INSERT USING (
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'curriculum_specialist')
        )
    );

-- Assessment standards (readable by schools using the curriculum)
CREATE POLICY curriculum_assessment_standards_read ON curriculum_assessment_standards
    FOR SELECT USING (
        is_active = true AND (
            current_setting('app.current_user_id')::UUID IN (
                SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'curriculum_specialist')
            ) OR
            curriculum_id IN (
                SELECT sci.curriculum_id FROM school_curriculum_implementation sci
                WHERE sci.school_id = current_setting('app.current_school_id')::UUID 
                AND sci.is_active = true
            )
        )
    );

-- School implementation (school-based access)
CREATE POLICY school_curriculum_implementation_school_access ON school_curriculum_implementation
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin', 'curriculum_specialist')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = school_curriculum_implementation.school_id AND is_active = true
        )
    );

-- Student progress (school-based with student privacy)
CREATE POLICY student_curriculum_progress_school_access ON student_curriculum_progress
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = student_curriculum_progress.school_id AND is_active = true
        )
    );

-- ====================================
-- INITIAL DATA
-- ====================================

-- Insert major curriculum systems
INSERT INTO curriculum_systems (
    curriculum_code, curriculum_name, full_name, description, country_origin, 
    education_board, grade_levels, duration_years, assessment_system, 
    grading_scale, competency_based, created_by
) VALUES
-- Kenyan Curricula
('CBC', 'Competency Based Curriculum', 'Competency Based Curriculum', 
'Kenya''s current curriculum focusing on competencies and skills development', 'Kenya', 'KICD',
ARRAY['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
14, 'continuous_assessment', 'exceeds_expectations_meets_approaches_below', true,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('8-4-4', '8-4-4 System', 'Eight-Four-Four Education System',
'Kenya''s former education system with 8 years primary, 4 years secondary, 4 years university', 'Kenya', 'KNEC',
ARRAY['Std1', 'Std2', 'Std3', 'Std4', 'Std5', 'Std6', 'Std7', 'Std8', 'F1', 'F2', 'F3', 'F4'],
12, 'standardized_exams', 'A-E', false,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

-- International Curricula
('IGCSE', 'IGCSE', 'International General Certificate of Secondary Education',
'Cambridge International curriculum for students aged 14-16', 'United Kingdom', 'Cambridge Assessment',
ARRAY['Y7', 'Y8', 'Y9', 'Y10', 'Y11'],
5, 'standardized_exams', 'A*-G', false,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('IB', 'International Baccalaureate', 'International Baccalaureate Programme',
'International curriculum promoting intercultural understanding and respect', 'International', 'IB Organization',
ARRAY['PYP1', 'PYP2', 'PYP3', 'PYP4', 'PYP5', 'PYP6', 'MYP1', 'MYP2', 'MYP3', 'MYP4', 'MYP5', 'DP1', 'DP2'],
13, 'mixed', '1-7', true,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('CAMBRIDGE', 'Cambridge International', 'Cambridge International Education',
'British curriculum adapted for international schools', 'United Kingdom', 'Cambridge Assessment',
ARRAY['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'],
13, 'mixed', 'A*-G', false,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1));

COMMENT ON TABLE curriculum_systems IS 'Registry of educational curriculum systems (CBC, IGCSE, 8-4-4, etc.)';
COMMENT ON TABLE curriculum_grade_levels IS 'Grade level definitions for each curriculum system';
COMMENT ON TABLE curriculum_subjects IS 'Subject definitions and requirements for each curriculum';
COMMENT ON TABLE curriculum_assessment_standards IS 'Learning standards and assessment criteria';
COMMENT ON TABLE curriculum_equivalencies IS 'Cross-curriculum grade and subject equivalencies';
COMMENT ON TABLE school_curriculum_implementation IS 'How schools are implementing different curricula';
COMMENT ON TABLE student_curriculum_progress IS 'Individual student progress tracking within curricula';