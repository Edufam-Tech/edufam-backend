const express = require('express');
const router = express.Router();

const { schoolAuth, requireRole } = require('../../middleware/auth');
const parentController = require('../../controllers/web/parentController');

router.use(schoolAuth);
router.use(requireRole(['parent']));

router.get('/dashboard', parentController.getDashboard);
router.get('/children', parentController.getChildren);
router.get('/children/:childId/academic', parentController.getChildAcademic);

module.exports = router;


