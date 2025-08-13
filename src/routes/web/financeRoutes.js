const express = require('express');
const router = express.Router();

const { schoolAuth, requireRole } = require('../../middleware/auth');
const financeController = require('../../controllers/web/financeController');

router.use(schoolAuth);
router.use(requireRole(['finance']));

router.get('/dashboard', financeController.getDashboard);
router.get('/overview', financeController.getFinancialOverview);
router.get('/mpesa/transactions', financeController.getMpesaTransactions);
router.get('/fees/assignments/pending', financeController.getPendingFeeAssignments);
router.post('/fees/assignments/:id/approve', financeController.approveFeeAssignment);
router.post('/fees/assignments/:id/reject', financeController.rejectFeeAssignment);

module.exports = router;


