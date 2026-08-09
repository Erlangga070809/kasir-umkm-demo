const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

router.get('/owner', authorize('owner'), dashboardController.getOwnerDashboard);
router.get('/cashier', dashboardController.getCashierDashboard);
router.get('/reports', authorize('owner'), dashboardController.getReports);
router.get('/audit-logs', authorize('owner'), dashboardController.getAuditLogs);
router.get('/store-settings', authorize('owner'), dashboardController.getStoreSettings);
router.put('/store-settings', authorize('owner'), dashboardController.updateStoreSettings);

module.exports = router;
