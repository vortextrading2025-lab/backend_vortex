const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const productService = require('../../services/productService');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(authenticate);

// Configure multer for file uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  },
});

/**
 * @swagger
 * /api/vendor/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - stock
 *               - categoryId
 *               - subcategoryId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               categoryId:
 *                 type: string
 *               subcategoryId:
 *                 type: string
 *               sku:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authorize(['VENDOR']),
  upload.array('images', 5), // Max 5 images
  async (req, res) => {
    try {
      const vendorId = req.user.id;

      // Extract product data from form
      const productData = {
        name: req.body.name,
        description: req.body.description || null,
        price: parseFloat(req.body.price),
        stock: parseInt(req.body.stock, 10),
        categoryId: req.body.categoryId,
        subcategoryId: req.body.subcategoryId,
        sku: req.body.sku || null,
        currency: req.body.currency || 'CAD',
        attributes: req.body.attributes ? (typeof req.body.attributes === 'string' ? JSON.parse(req.body.attributes) : req.body.attributes) : null,
      };

      // Get uploaded files
      const imageFiles = req.files || [];

      const product = await productService.createProduct(productData, vendorId, imageFiles);

      sendResponse(res, 201, product, 'Product created successfully');
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * @swagger
 * /api/vendor/products:
 *   get:
 *     summary: List vendor's products
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subcategoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Products list
 */
router.get('/', authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      search: req.query.search || '',
      categoryId: req.query.categoryId || null,
      subcategoryId: req.query.subcategoryId || null,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : null,
    };

    const result = await productService.listVendorProducts(vendorId, filters);

    sendResponse(res, 200, result, 'Products retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/products/categories:
 *   get:
 *     summary: Get all categories and subcategories
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories list
 */
router.get('/categories', authorize(['VENDOR']), async (req, res) => {
  try {
    const categories = await productService.getCategories();
    sendResponse(res, 200, categories, 'Categories retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/products/:id:
 *   get:
 *     summary: Get product by ID
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product details
 */
router.get('/:id', authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const product = await productService.getProductById(req.params.id, vendorId);

    sendResponse(res, 200, product, 'Product retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/products/:id:
 *   put:
 *     summary: Update product
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product updated
 */
router.put(
  '/:id',
  authorize(['VENDOR']),
  upload.array('images', 5),
  async (req, res) => {
    try {
      const vendorId = req.user.id;
      const productId = req.params.id;

      // Extract update data
      const updateData = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description || null;
      if (req.body.price) updateData.price = parseFloat(req.body.price);
      if (req.body.stock !== undefined) updateData.stock = parseInt(req.body.stock, 10);
      if (req.body.categoryId) updateData.categoryId = req.body.categoryId;
      if (req.body.subcategoryId) updateData.subcategoryId = req.body.subcategoryId;
      if (req.body.sku) updateData.sku = req.body.sku;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive === 'true';
      if (req.body.attributes !== undefined) {
        updateData.attributes = typeof req.body.attributes === 'string' 
          ? JSON.parse(req.body.attributes) 
          : req.body.attributes;
      }

      // Get new images if uploaded
      const newImageFiles = req.files && req.files.length > 0 ? req.files : null;

      const product = await productService.updateProduct(productId, vendorId, updateData, newImageFiles);

      sendResponse(res, 200, product, 'Product updated successfully');
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * @swagger
 * /api/vendor/products/:id:
 *   delete:
 *     summary: Delete product
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product deleted
 */
router.delete('/:id', authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    await productService.deleteProduct(req.params.id, vendorId);

    sendResponse(res, 200, null, 'Product deleted successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/products/:id/stock:
 *   put:
 *     summary: Update product stock
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock updated
 */
router.put('/:id/stock', authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const stock = parseInt(req.body.stock, 10);

    if (isNaN(stock) || stock < 0) {
      return sendError(res, new Error('Invalid stock value'));
    }

    const product = await productService.updateStock(req.params.id, vendorId, stock);

    sendResponse(res, 200, product, 'Stock updated successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
