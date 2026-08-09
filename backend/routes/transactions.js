const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

router.get('/', transactionController.getTransactions);
router.get('/customers', transactionController.getCustomers);
router.post('/customers', transactionController.createCustomer);
router.get('/cashiers', authorize('owner'), transactionController.getCashiers);
router.post('/cashiers', authorize('owner'), transactionController.createCashier);
router.put('/cashiers/:id', authorize('owner'), transactionController.updateCashier);
router.put('/cashiers/:id/reset-password', authorize('owner'), transactionController.resetCashierPassword);
router.get('/:id', transactionController.getTransactionById);
router.post('/', transactionController.createTransaction);

module.exports = router;
