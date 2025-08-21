-- ====================================
-- DIAGNOSTIC SCRIPT FOR "year" COLUMN ERROR
-- ====================================
-- This script helps identify what's causing the "column year does not exist" error

-- Check if there are any views that reference a "year" column
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE definition ILIKE '%year%' 
    AND schemaname NOT IN ('information_schema', 'pg_catalog');

-- Check if there are any functions that reference a "year" column
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%year%'
    AND n.nspname NOT IN ('information_schema', 'pg_catalog');

-- Check if there are any triggers that might be causing issues
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%year%';

-- Check if there are any constraints that reference "year"
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE cc.check_clause ILIKE '%year%' OR tc.constraint_name ILIKE '%year%';

-- Check if there are any indexes that reference "year"
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef ILIKE '%year%'
    AND schemaname NOT IN ('information_schema', 'pg_catalog');

-- Check if there are any existing tables with a "year" column
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'year'
    AND table_schema NOT IN ('information_schema', 'pg_catalog');

-- Check if there are any foreign key constraints that might be causing issues
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (kcu.column_name = 'year' OR ccu.column_name = 'year');

-- Check if there are any sequences or other objects that might be causing issues
SELECT 
    sequence_name,
    data_type,
    start_value,
    increment
FROM information_schema.sequences
WHERE sequence_name ILIKE '%year%';
