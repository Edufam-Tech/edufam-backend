-- =====================================================
-- EDUFAM DATABASE CLEANUP SCRIPT
-- This script removes unnecessary tables identified for deletion
-- Run this in Supabase SQL Editor
-- =====================================================

-- WARNING: This will permanently delete the following tables and all their data
-- Make sure you have a backup before running this script

-- =====================================================
-- PHASE 1: Remove tables with no dependencies first
-- =====================================================

-- Admin Platform Tables
DROP TABLE IF EXISTS admin_company_assets CASCADE;
DROP TABLE IF EXISTS admin_departments CASCADE;
DROP TABLE IF EXISTS admin_employee_training CASCADE;
DROP TABLE IF EXISTS admin_performance_reviews CASCADE;
DROP TABLE IF EXISTS admin_trip_programs CASCADE;
DROP TABLE IF EXISTS admin_trip_registrations CASCADE;

-- AI/Advanced Analytics Tables
DROP TABLE IF EXISTS advanced_kpis CASCADE;
DROP TABLE IF EXISTS ai_chatbot_messages CASCADE;
DROP TABLE IF EXISTS ai_chatbot_sessions CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;
DROP TABLE IF EXISTS ai_optimization_logs CASCADE;
DROP TABLE IF EXISTS ai_predictions CASCADE;
DROP TABLE IF EXISTS alert_configurations CASCADE;
DROP TABLE IF EXISTS analytics_cache CASCADE;
DROP TABLE IF EXISTS analytics_dashboards CASCADE;

-- Appraisal/Performance Tables
DROP TABLE IF EXISTS appraisal_categories CASCADE;
DROP TABLE IF EXISTS appraisal_cycles CASCADE;
DROP TABLE IF EXISTS appraisal_feedback CASCADE;
DROP TABLE IF EXISTS appraisal_goals CASCADE;
DROP TABLE IF EXISTS appraisal_history CASCADE;
DROP TABLE IF EXISTS appraisal_questions CASCADE;
DROP TABLE IF EXISTS appraisal_responses CASCADE;
DROP TABLE IF EXISTS appraisal_reviews CASCADE;
DROP TABLE IF EXISTS appraisal_templates CASCADE;

-- Approval System Tables
DROP TABLE IF EXISTS approval_decision_history CASCADE;
DROP TABLE IF EXISTS approval_level_actions CASCADE;
DROP TABLE IF EXISTS approval_rule_exceptions CASCADE;
DROP TABLE IF EXISTS approval_workflow_templates CASCADE;

-- =====================================================
-- PHASE 2: Remove configuration and settings tables
-- =====================================================

-- Cache and Performance Tables
DROP TABLE IF EXISTS attendance_settings CASCADE;
DROP TABLE IF EXISTS bulk_certificate_jobs CASCADE;
DROP TABLE IF EXISTS cache_configurations CASCADE;
DROP TABLE IF EXISTS cache_performance_logs CASCADE;
DROP TABLE IF EXISTS cache_policies CASCADE;
DROP TABLE IF EXISTS cdn_analytics CASCADE;
DROP TABLE IF EXISTS cdn_configurations CASCADE;
DROP TABLE IF EXISTS classrooms CASCADE;
DROP TABLE IF EXISTS cloud_cost_tracking CASCADE;
DROP TABLE IF EXISTS cloud_storage_configurations CASCADE;

-- Communication Tables
DROP TABLE IF EXISTS communication_group_members CASCADE;
DROP TABLE IF EXISTS communication_groups CASCADE;
DROP TABLE IF EXISTS communication_settings CASCADE;
DROP TABLE IF EXISTS communication_templates CASCADE;

-- Compliance Tables
DROP TABLE IF EXISTS compliance_assessments CASCADE;
DROP TABLE IF EXISTS compliance_controls CASCADE;
DROP TABLE IF EXISTS compliance_frameworks CASCADE;
DROP TABLE IF EXISTS compliance_rules CASCADE;

-- =====================================================
-- PHASE 3: Remove curriculum and localization tables
-- =====================================================

-- Content and Localization Tables
DROP TABLE IF EXISTS content_localizations CASCADE;
DROP TABLE IF EXISTS credit_notes CASCADE;
DROP TABLE IF EXISTS cross_school_analytics CASCADE;
DROP TABLE IF EXISTS cross_school_notifications CASCADE;

-- Curriculum Tables
DROP TABLE IF EXISTS curriculum_assessment_standards CASCADE;
DROP TABLE IF EXISTS curriculum_equivalencies CASCADE;
DROP TABLE IF EXISTS curriculum_grade_levels CASCADE;
DROP TABLE IF EXISTS curriculum_subjects CASCADE;
DROP TABLE IF EXISTS curriculum_systems CASCADE;

-- Dashboard and Data Tables
DROP TABLE IF EXISTS dashboard_widgets CASCADE;
DROP TABLE IF EXISTS data_backups CASCADE;
DROP TABLE IF EXISTS data_exports CASCADE;
DROP TABLE IF EXISTS data_mapping_templates CASCADE;
DROP TABLE IF EXISTS data_mining_jobs CASCADE;
DROP TABLE IF EXISTS data_protection_records CASCADE;
DROP TABLE IF EXISTS data_subject_requests CASCADE;

-- =====================================================
-- PHASE 4: Remove remaining unnecessary tables
-- =====================================================

-- Department and Development Tables
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS development_plans CASCADE;

-- Director Management Tables
DROP TABLE IF EXISTS director_active_contexts CASCADE;
DROP TABLE IF EXISTS director_favorite_schools CASCADE;
DROP TABLE IF EXISTS director_school_access CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;

-- External Integration Tables
DROP TABLE IF EXISTS external_integrations CASCADE;
DROP TABLE IF EXISTS feature_flag_assignments CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
DROP TABLE IF EXISTS grading_scales CASCADE;
DROP TABLE IF EXISTS hr_settings CASCADE;
DROP TABLE IF EXISTS integration_logs CASCADE;

-- Invoice and Financial Tables
DROP TABLE IF EXISTS invoice_series CASCADE;
DROP TABLE IF EXISTS invoice_taxes CASCADE;
DROP TABLE IF EXISTS knec_integration_settings CASCADE;

-- KPI and Analytics Tables
DROP TABLE IF EXISTS kpi_definitions CASCADE;
DROP TABLE IF EXISTS kpi_values CASCADE;

-- Language and Localization Tables
DROP TABLE IF EXISTS languages CASCADE;
DROP TABLE IF EXISTS localization_analytics CASCADE;
DROP TABLE IF EXISTS make_up_classes CASCADE;
DROP TABLE IF EXISTS migration_jobs CASCADE;

-- Mobile and Device Tables
DROP TABLE IF EXISTS mobile_devices CASCADE;
DROP TABLE IF EXISTS mobile_feature_flag_assignments CASCADE;
DROP TABLE IF EXISTS mobile_feature_flags CASCADE;
DROP TABLE IF EXISTS parent_communication_preferences CASCADE;
DROP TABLE IF EXISTS peer_feedback CASCADE;

-- Performance and Platform Tables
DROP TABLE IF EXISTS performance_appraisals CASCADE;
DROP TABLE IF EXISTS performance_goals CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS performance_reviews CASCADE;
DROP TABLE IF EXISTS platform_admins CASCADE;
DROP TABLE IF EXISTS platform_metrics CASCADE;
DROP TABLE IF EXISTS platform_regions CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS platform_usage_logs CASCADE;

-- Predictive and Notification Tables
DROP TABLE IF EXISTS predictive_alerts CASCADE;
DROP TABLE IF EXISTS push_notification_templates CASCADE;
DROP TABLE IF EXISTS question_bank CASCADE;
DROP TABLE IF EXISTS realtime_channel_subscriptions CASCADE;
DROP TABLE IF EXISTS regional_performance CASCADE;
DROP TABLE IF EXISTS regional_targets CASCADE;
DROP TABLE IF EXISTS remedial_sessions CASCADE;

-- Report and Room Tables
DROP TABLE IF EXISTS report_permissions CASCADE;
DROP TABLE IF EXISTS room_availability CASCADE;
DROP TABLE IF EXISTS route_stops CASCADE;
DROP TABLE IF EXISTS saved_reports CASCADE;

-- School and Student Tables
DROP TABLE IF EXISTS school_curriculum_implementation CASCADE;
DROP TABLE IF EXISTS school_language_settings CASCADE;
DROP TABLE IF EXISTS school_oversight CASCADE;
DROP TABLE IF EXISTS school_switch_audit CASCADE;
DROP TABLE IF EXISTS student_curriculum_progress CASCADE;
DROP TABLE IF EXISTS student_learning_analytics CASCADE;
DROP TABLE IF EXISTS subject_requirements CASCADE;
DROP TABLE IF EXISTS subscription_invoices CASCADE;

-- Teacher and Thread Tables
DROP TABLE IF EXISTS teacher_availability CASCADE;
DROP TABLE IF EXISTS teacher_classes CASCADE;
DROP TABLE IF EXISTS thread_participants CASCADE;
DROP TABLE IF EXISTS token_blacklist CASCADE;

-- Training Center Tables
DROP TABLE IF EXISTS training_centers CASCADE;
DROP TABLE IF EXISTS training_enrollments CASCADE;
DROP TABLE IF EXISTS training_resources CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;

-- Translation Tables
DROP TABLE IF EXISTS translation_keys CASCADE;
DROP TABLE IF EXISTS translation_memory CASCADE;
DROP TABLE IF EXISTS translation_namespaces CASCADE;
DROP TABLE IF EXISTS translations CASCADE;

-- Transport Tables
DROP TABLE IF EXISTS transport_attendance CASCADE;
DROP TABLE IF EXISTS transport_fees CASCADE;
DROP TABLE IF EXISTS transport_incidents CASCADE;
DROP TABLE IF EXISTS transport_vehicle_locations CASCADE;

-- Trip Management Tables
DROP TABLE IF EXISTS trip_feedback CASCADE;
DROP TABLE IF EXISTS trip_itineraries CASCADE;
DROP TABLE IF EXISTS trip_medical_info CASCADE;
DROP TABLE IF EXISTS trip_permissions CASCADE;
DROP TABLE IF EXISTS trip_safety_measures CASCADE;
DROP TABLE IF EXISTS trip_types CASCADE;

-- User Preference Tables
DROP TABLE IF EXISTS user_language_preferences CASCADE;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Check remaining tables after cleanup
SELECT 
    tablename as remaining_tables,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ EDUFAM DATABASE CLEANUP COMPLETED!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Removed 120+ unnecessary tables';
    RAISE NOTICE 'Database significantly simplified';
    RAISE NOTICE 'Run the verification query above to see remaining tables';
    RAISE NOTICE '================================================';
END $$;
