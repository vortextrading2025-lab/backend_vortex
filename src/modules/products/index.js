const express = require('express');
const database = require('../../config/database');
const { apiLimiter } = require('../../middleware/rateLimit');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();
const prisma = database.getClient();

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Browse products (public)
 *     tags: [Products]
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
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *       - in: query
 *         name: attributeKey
 *         schema:
 *           type: string
 *       - in: query
 *         name: attributeValue
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products list
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      categoryId = null,
      subcategoryId = null,
      minPrice = null,
      maxPrice = null,
      inStock = null,
      brand = null,
      color = null,
      attributeKey = null,
      attributeValue = null,
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Build base where clause
    const where = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(subcategoryId && { subcategoryId }),
      ...(minPrice || maxPrice ? {
        price: {
          ...(minPrice && { gte: parseFloat(minPrice) }),
          ...(maxPrice && { lte: parseFloat(maxPrice) }),
        },
      } : {}),
      ...(inStock === 'true' || inStock === true || inStock === '1' ? {
        stock: { gt: 0 },
      } : {}),
    };

    // Fetch products first, then filter by attributes in memory
    // This is necessary because Prisma JSON filtering can be complex
    let products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        stock: true,
        images: true,
        sku: true,
        attributes: true,
        isActive: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            vendorProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by attributes if provided
    if (brand || color || (attributeKey && attributeValue)) {
      products = products.filter((product) => {
        if (!product.attributes) return false;
        
        const attrs = product.attributes;
        if (brand && attrs.brand?.toLowerCase() !== brand.toLowerCase()) {
          return false;
        }
        if (color && attrs.color?.toLowerCase() !== color.toLowerCase()) {
          return false;
        }
        if (attributeKey && attributeValue) {
          const value = attrs[attributeKey];
          if (!value || String(value).toLowerCase() !== attributeValue.toLowerCase()) {
            return false;
          }
        }
        return true;
      });
    }

    // Get total count after attribute filtering
    const total = products.length;

    // Apply pagination
    const paginatedProducts = products.slice(skip, skip + parseInt(limit, 10));

    sendResponse(res, 200, {
      products: paginatedProducts,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'Products retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Get all categories with subcategories
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Categories list
 */
// IMPORTANT: This route must come BEFORE /:id to avoid route conflicts
router.get('/categories', async (req, res) => {
  try {
    // Optimize: Use select for better performance
    // First try with isActive filter, if no results, try without filter
    let categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        image: true,
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            slug: true,
            categoryId: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // If no active categories found, try fetching all categories (for development)
    if (categories.length === 0) {
      console.log('⚠️  No active categories found, fetching all categories...');
      categories = await prisma.category.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          image: true,
          subcategories: {
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              categoryId: true,
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    // Ensure we return an array even if empty
    if (!Array.isArray(categories)) {
      categories = [];
    }

    sendResponse(res, 200, categories, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Error fetching categories:', error);
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/products/:id:
 *   get:
 *     summary: Get product details (public)
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Product details
 */
router.get('/:id', async (req, res) => {
  try {
    // Optimize: Use select for better performance
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        vendorId: true,
        categoryId: true,
        subcategoryId: true,
        name: true,
        description: true,
        price: true,
        currency: true,
          stock: true,
          images: true,
          sku: true,
          attributes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          vendor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            vendorProfile: {
              select: {
                businessName: true,
                description: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      return sendError(res, new Error('Product not found'), 404);
    }

    if (!product.isActive) {
      return sendError(res, new Error('Product is not available'), 404);
    }

    sendResponse(res, 200, product, 'Product retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
