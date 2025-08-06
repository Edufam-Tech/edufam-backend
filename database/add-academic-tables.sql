-- Migration: Add Academic Years and Terms Tables
-- This script adds the academic_years and academic_terms tables to support school management

-- Academic Years table
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    description TEXT,
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_academic_year_dates CHECK (end_date > start_date),
    CONSTRAINT unique_school_year_name UNIQUE (school_id, name)
);

-- Academic Terms table
CREATE TABLE academic_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    description TEXT,
    
    -- Curriculum and grading
    curriculum_type VARCHAR(20) DEFAULT '8-4-4' CHECK (curriculum_type IN ('CBC', 'IGCSE', '8-4-4')),
    term_number INTEGER CHECK (term_number >= 1 AND term_number <= 12),
    grading_periods JSONB DEFAULT '[]',
    
    -- Standard fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_term_dates CHECK (end_date > start_date),
    CONSTRAINT unique_year_term_name UNIQUE (academic_year_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_academic_years_school ON academic_years(school_id);
CREATE INDEX idx_academic_years_active ON academic_years(is_active);
CREATE INDEX idx_academic_years_dates ON academic_years(start_date, end_date);
CREATE INDEX idx_academic_years_name ON academic_years(name);

CREATE INDEX idx_academic_terms_year ON academic_terms(academic_year_id);
CREATE INDEX idx_academic_terms_active ON academic_terms(is_active);
CREATE INDEX idx_academic_terms_dates ON academic_terms(start_date, end_date);
CREATE INDEX idx_academic_terms_curriculum ON academic_terms(curriculum_type);
CREATE INDEX idx_academic_terms_number ON academic_terms(term_number);

-- Add triggers for updated_at
CREATE TRIGGER update_academic_years_updated_at 
    BEFORE UPDATE ON academic_years 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academic_terms_updated_at 
    BEFORE UPDATE ON academic_terms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for academic_years
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_years_school_policy ON academic_years
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM users 
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'school_user'
        )
        OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'admin_user'
        )
    );

-- Add RLS policies for academic_terms
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_terms_school_policy ON academic_terms
    FOR ALL
    USING (
        academic_year_id IN (
            SELECT ay.id FROM academic_years ay
            JOIN users u ON ay.school_id = u.school_id
            WHERE u.id = current_setting('app.current_user_id')::UUID
            AND u.user_type = 'school_user'
        )
        OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_setting('app.current_user_id')::UUID
            AND user_type = 'admin_user'
        )
    );

-- Insert default academic year for existing schools
INSERT INTO academic_years (school_id, name, start_date, end_date, is_active, description)
SELECT 
    id as school_id,
    EXTRACT(YEAR FROM CURRENT_DATE)::TEXT as name,
    DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-01-01') as start_date,
    DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-12-31') as end_date,
    true as is_active,
    'Default academic year for ' || name as description
FROM schools
WHERE is_active = true;

-- Insert default terms for the default academic year
INSERT INTO academic_terms (academic_year_id, name, start_date, end_date, is_active, curriculum_type, term_number)
SELECT 
    ay.id as academic_year_id,
    'Term ' || term_num as name,
    CASE term_num
        WHEN 1 THEN DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-01-01')
        WHEN 2 THEN DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-05-01')
        WHEN 3 THEN DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-09-01')
    END as start_date,
    CASE term_num
        WHEN 1 THEN DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-04-30')
        WHEN 2 THEN DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-08-31')
        WHEN 3 THEN DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-12-31')
    END as end_date,
    (term_num = 1) as is_active,
    '8-4-4' as curriculum_type,
    term_num
FROM academic_years ay
CROSS JOIN (VALUES (1), (2), (3)) AS terms(term_num)
WHERE ay.is_active = true;

-- Update the schools table to include academic_year_id reference
-- This will help with quick lookups of current academic year
ALTER TABLE schools ADD COLUMN current_academic_year_id UUID REFERENCES academic_years(id);

-- Update the current_academic_year_id for existing schools
UPDATE schools 
SET current_academic_year_id = (
    SELECT ay.id 
    FROM academic_years ay 
    WHERE ay.school_id = schools.id 
    AND ay.is_active = true 
    LIMIT 1
)
WHERE is_active = true;

-- Create index for the new foreign key
CREATE INDEX idx_schools_current_academic_year ON schools(current_academic_year_id);

-- Add comments for documentation
COMMENT ON TABLE academic_years IS 'Academic years for each school';
COMMENT ON TABLE academic_terms IS 'Academic terms within academic years';
COMMENT ON COLUMN academic_years.school_id IS 'Reference to the school this academic year belongs to';
COMMENT ON COLUMN academic_years.is_active IS 'Only one academic year per school can be active at a time';
COMMENT ON COLUMN academic_terms.academic_year_id IS 'Reference to the academic year this term belongs to';
COMMENT ON COLUMN academic_terms.curriculum_type IS 'Curriculum type: CBC, IGCSE, or 8-4-4';
COMMENT ON COLUMN academic_terms.term_number IS 'Sequential number of the term within the academic year';
COMMENT ON COLUMN academic_terms.grading_periods IS 'JSON array of grading periods for this term';
COMMENT ON COLUMN schools.current_academic_year_id IS 'Reference to the currently active academic year for this school'; 