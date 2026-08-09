const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

router.get('/', productController.getProducts);
router.get('/low-stock', productController.getLowStockProducts);
router.get('/categories', productController.getCategories);
router.post('/categories', authorize('owner'), productController.createCategory);
router.put('/categories/:id', authorize('owner'), productController.updateCategory);
router.delete('/categories/:id', authorize('owner'), productController.deleteCategory);
router.get('/stock-movements', productController.getStockMovements);
router.get('/:id', productController.getProductById);
router.post('/', authorize('owner'), productController.createProduct);
router.put('/:id', authorize('owner'), productController.updateProduct);
router.delete('/:id', authorize('owner'), productController.deleteProduct);
router.put('/:id/stock', authorize('owner'), productController.updateStock);

module.exports = router;
