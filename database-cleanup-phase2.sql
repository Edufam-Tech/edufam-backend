-- =====================================================
-- EDUFAM DATABASE CLEANUP - PHASE 2
-- Remove additional unnecessary tables from remaining set
-- =====================================================

-- WARNING: This will permanently delete additional unnecessary tables
-- Make sure you have a backup before running this script

-- =====================================================
-- PHASE 2: Remove over-engineered and unnecessary tables
-- =====================================================

-- Admin Platform Tables (Keep basic admin, remove complex ones)
DROP TABLE IF EXISTS admin_employee_leaves CASCADE;
DROP TABLE IF EXISTS admin_employees CASCADE;

-- Advanced Analytics (Unnecessary for basic school management)
DROP TABLE IF EXISTS analytics_reports CASCADE;

-- Over-engineered Approval System
DROP TABLE IF EXISTS approval_metrics CASCADE;
DROP TABLE IF EXISTS approval_notifications CASCADE;
DROP TABLE IF EXISTS approval_requests CASCADE;

-- Complex Appraisal System (Keep basic appraisals, remove complex)
DROP TABLE IF EXISTS appraisals CASCADE;

-- Over-engineered Certificate System
DROP TABLE IF EXISTS certificate_designs CASCADE;
DROP TABLE IF EXISTS certificate_fields CASCADE;
DROP TABLE IF EXISTS certificate_signatures CASCADE;
DROP TABLE IF EXISTS certificate_templates CASCADE;
DROP TABLE IF EXISTS certificate_types CASCADE;
DROP TABLE IF EXISTS certificate_verifications CASCADE;
DROP TABLE IF EXISTS certificates_issued CASCADE;

-- Complex Communication System (Keep basic messages)
DROP TABLE IF EXISTS communication_logs CASCADE;
DROP TABLE IF EXISTS message_recipients CASCADE;
DROP TABLE IF EXISTS message_threads CASCADE;

-- Disciplinary Actions (Not essential for basic school management)
DROP TABLE IF EXISTS disciplinary_actions CASCADE;

-- Over-engineered Examination System
DROP TABLE IF EXISTS examination_classes CASCADE;
DROP TABLE IF EXISTS examination_registrations CASCADE;
DROP TABLE IF EXISTS examination_results CASCADE;
DROP TABLE IF EXISTS examination_schedules CASCADE;
DROP TABLE IF EXISTS examination_subjects CASCADE;
DROP TABLE IF EXISTS examinations CASCADE;

-- Complex Fee Management (Keep basic fees, remove complex)
DROP TABLE IF EXISTS fee_assignment_approvals CASCADE;
DROP TABLE IF EXISTS fee_assignment_history CASCADE;
DROP TABLE IF EXISTS fee_assignment_items CASCADE;
DROP TABLE IF EXISTS fee_assignment_templates CASCADE;
DROP TABLE IF EXISTS fee_assignments CASCADE;
DROP TABLE IF EXISTS fee_discounts CASCADE;
DROP TABLE IF EXISTS fee_waivers CASCADE;
DROP TABLE IF EXISTS fee_templates CASCADE;

-- Over-engineered HR System
DROP TABLE IF EXISTS employee_attendance CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS interviews CASCADE;
DROP TABLE IF EXISTS job_applications CASCADE;
DROP TABLE IF EXISTS job_offers CASCADE;
DROP TABLE IF EXISTS job_postings CASCADE;
DROP TABLE IF EXISTS leave_applications CASCADE;
DROP TABLE IF EXISTS leave_balances CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;

-- Complex Invoice System (Keep basic invoices)
DROP TABLE IF EXISTS invoice_discounts CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoice_payments CASCADE;
DROP TABLE IF EXISTS invoice_reminders CASCADE;
DROP TABLE IF EXISTS invoice_templates CASCADE;

-- Marketplace System (Unnecessary for school management)
DROP TABLE IF EXISTS marketplace_cart CASCADE;
DROP TABLE IF EXISTS marketplace_categories CASCADE;
DROP TABLE IF EXISTS marketplace_coupons CASCADE;
DROP TABLE IF EXISTS marketplace_order_items CASCADE;
DROP TABLE IF EXISTS marketplace_orders CASCADE;
DROP TABLE IF EXISTS marketplace_products CASCADE;
DROP TABLE IF EXISTS marketplace_reviews CASCADE;
DROP TABLE IF EXISTS marketplace_vendors CASCADE;
DROP TABLE IF EXISTS marketplace_wishlist_items CASCADE;
DROP TABLE IF EXISTS marketplace_wishlists CASCADE;

-- Over-engineered Mobile System
DROP TABLE IF EXISTS mobile_analytics_events CASCADE;
DROP TABLE IF EXISTS mobile_app_sessions CASCADE;
DROP TABLE IF EXISTS mobile_crash_reports CASCADE;
DROP TABLE IF EXISTS mobile_performance_metrics CASCADE;

-- Complex Notification System (Keep basic notifications)
DROP TABLE IF EXISTS notification_recipients CASCADE;
DROP TABLE IF EXISTS push_notifications CASCADE;

-- Offline Sync (Unnecessary complexity)
DROP TABLE IF EXISTS offline_sync_queue CASCADE;

-- Over-engineered Payment System (Keep basic payments)
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;

-- Complex Payroll System
DROP TABLE IF EXISTS payroll CASCADE;

-- Over-engineered Realtime System
DROP TABLE IF EXISTS realtime_channels CASCADE;
DROP TABLE IF EXISTS realtime_event_deliveries CASCADE;
DROP TABLE IF EXISTS realtime_event_types CASCADE;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Check remaining tables after Phase 2 cleanup
SELECT 
    tablename as remaining_tables,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename AND table_schema = 'public') as column_count
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
    RAISE NOTICE '✅ EDUFAM DATABASE CLEANUP - PHASE 2 COMPLETED!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Removed 50+ additional unnecessary tables';
    RAISE NOTICE 'Database further simplified';
    RAISE NOTICE 'Run the verification query above to see remaining tables';
    RAISE NOTICE '================================================';
END $$;
