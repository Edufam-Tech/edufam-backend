-- =====================================================
-- EDUFAM DATABASE TABLE ANALYZER - QUICK VERSION
-- Run these queries one by one to avoid connection timeouts
-- =====================================================

-- 1. BASIC TABLE LIST (Run this first)
SELECT 
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename AND table_schema = 'public') as column_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. TABLES BY MODULE CATEGORY (Run this second)
SELECT 
    CASE 
        WHEN tablename LIKE 'admin_%' OR tablename LIKE 'platform_%' THEN 'Admin Platform'
        WHEN tablename LIKE 'communication_%' OR tablename LIKE 'message_%' OR tablename LIKE 'announcement_%' OR tablename LIKE 'notification_%' THEN 'Communication'
        WHEN tablename LIKE 'fee_%' OR tablename LIKE 'payment_%' OR tablename LIKE 'invoice_%' OR tablename LIKE 'receipt_%' OR tablename LIKE 'mpesa_%' THEN 'Financial'
        WHEN tablename LIKE 'employee_%' OR tablename LIKE 'leave_%' OR tablename LIKE 'payroll_%' OR tablename LIKE 'performance_%' OR tablename LIKE 'appraisal_%' THEN 'HR'
        WHEN tablename LIKE 'vehicle_%' OR tablename LIKE 'route_%' OR tablename LIKE 'trip_%' OR tablename LIKE 'transport_%' THEN 'Transport'
        WHEN tablename LIKE 'academic_%' OR tablename LIKE 'grade_%' OR tablename LIKE 'assessment_%' OR tablename LIKE 'attendance_%' OR tablename LIKE 'examination_%' THEN 'Academic'
        WHEN tablename LIKE 'student_%' OR tablename LIKE 'class_%' OR tablename LIKE 'department_%' THEN 'Student Management'
        WHEN tablename LIKE 'audit_%' OR tablename LIKE 'system_%' OR tablename LIKE 'maintenance_%' THEN 'System'
        WHEN tablename LIKE 'file_%' OR tablename LIKE 'upload_%' THEN 'File Management'
        WHEN tablename LIKE 'timetable_%' OR tablename LIKE 'schedule_%' THEN 'Timetable'
        WHEN tablename LIKE 'certificate_%' OR tablename LIKE 'report_%' THEN 'Reports & Certificates'
        WHEN tablename LIKE 'marketplace_%' OR tablename LIKE 'training_%' THEN 'Marketplace & Training'
        ELSE 'Core/Other'
    END as module_category,
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY module_category, tablename;

-- 3. SUMMARY STATISTICS (Run this third)
SELECT 
    'Total Tables' as metric,
    COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Total Columns' as metric,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public'

UNION ALL

SELECT 
    'Total Indexes' as metric,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public';

-- 4. TABLES WITH MANY COLUMNS (Run this fourth)
SELECT 
    tablename,
    COUNT(*) as column_count,
    'MANY COLUMNS - Consider splitting' as warning
FROM information_schema.columns 
WHERE table_schema = 'public'
GROUP BY tablename
HAVING COUNT(*) > 20
ORDER BY column_count DESC;

-- 5. POTENTIAL ORPHANED TABLES (Run this fifth)
SELECT 
    t.tablename,
    'NO FOREIGN KEYS - Potential orphaned table' as warning
FROM pg_tables t
LEFT JOIN information_schema.table_constraints tc ON t.tablename = tc.table_name
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
WHERE t.schemaname = 'public'
    AND tc.constraint_name IS NULL
    AND t.tablename NOT IN ('schools', 'users', 'system_settings')
ORDER BY t.tablename;
