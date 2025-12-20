const database = require('../config/database');
const { z } = require('zod');
const firebaseStorageService = require('./firebaseStorageService');
const { validateAttributes } = require('../utils/productAttributes');

// Get prisma client - ensure it's always available
const getPrisma = () => {
  try {
    const client = database.getClient();
    if (!client || !client.product) {
      throw new Error('Database client not properly initialized. Prisma client or product model is undefined.');
    }
    return client;
  } catch (error) {
    console.error('Error getting Prisma client:', error);
    throw new Error(`Database client error: ${error.message}`);
  }
};

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  categoryId: z.string(),
  subcategoryId: z.string(),
  sku: z.string().optional(),
  currency: z.string().default('CAD'),
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  sku: z.string().optional(),
  isActive: z.boolean().optional(),
  attributes: z.record(z.any()).optional(), // Category-specific attributes (JSON object)
});

class ProductService {
  /**
   * Create a new product
   * @param {Object} data - Product data
   * @param {String} vendorId - Vendor user ID
   * @param {Array} imageFiles - Array of image files (max 5)
   * @returns {Promise<Object>} Created product
   */
  async createProduct(data, vendorId, imageFiles = []) {
    try {
      // Validate vendor has vendor profile
      const prisma = getPrisma();
      const vendor = await prisma.user.findUnique({
        where: { id: vendorId },
        include: { vendorProfile: true },
      });

      if (!vendor || vendor.role !== 'VENDOR') {
        throw new Error('User must be a vendor to create products');
      }

      if (!vendor.vendorProfile) {
        throw new Error('Vendor profile is required to create products');
      }

      // Validate product data
      const validatedData = createProductSchema.parse(data);

      // Validate images
      if (imageFiles.length === 0) {
        throw new Error('At least one product image is required');
      }

      if (imageFiles.length > 5) {
        throw new Error('Maximum 5 images allowed per product');
      }

      const imageValidation = firebaseStorageService.validateImages(imageFiles);
      if (!imageValidation.valid) {
        throw new Error(imageValidation.error);
      }

      // Verify category and subcategory exist and are active (optimize: parallel queries)
      const [category, subcategory] = await Promise.all([
        prisma.category.findUnique({
          where: { id: validatedData.categoryId },
          select: {
            id: true,
            isActive: true,
            subcategories: {
              where: { id: validatedData.subcategoryId },
              select: { id: true, isActive: true, categoryId: true },
            },
          },
        }),
        prisma.subcategory.findUnique({
          where: { id: validatedData.subcategoryId },
          select: {
            id: true,
            isActive: true,
            categoryId: true,
          },
        }),
      ]);

      if (!subcategory || !subcategory.isActive || subcategory.categoryId !== validatedData.categoryId) {
        throw new Error('Subcategory not found, inactive, or does not belong to the selected category');
      }

      // Upload images to Firebase Storage
      const imageUrls = await firebaseStorageService.uploadMultipleImages(imageFiles, 'products');

      // Generate SKU if not provided
      let sku = validatedData.sku;
      if (!sku) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        sku = `PRD-${timestamp}-${random}`;
      }

      // Check if SKU already exists (optimize: only check existence)
      const existingSku = await prisma.product.findUnique({
        where: { sku },
        select: { id: true }, // Only check existence, don't fetch full record
      });

      if (existingSku) {
        throw new Error('SKU already exists');
      }

      // Validate attributes if provided
      if (validatedData.attributes) {
        const category = await prisma.category.findUnique({
          where: { id: validatedData.categoryId },
          select: { name: true },
        });
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: validatedData.subcategoryId },
          select: { name: true },
        });

        if (category && subcategory) {
          const attrValidation = validateAttributes(
            validatedData.attributes,
            category.name,
            subcategory.name
          );
          if (!attrValidation.valid) {
            throw new Error(`Attribute validation failed: ${attrValidation.errors.join(', ')}`);
          }
        }
      }

      // Create product (optimize: use select)
      const product = await prisma.product.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          price: validatedData.price,
          stock: validatedData.stock,
          categoryId: validatedData.categoryId,
          subcategoryId: validatedData.subcategoryId,
          sku,
          vendorId,
          images: imageUrls,
          currency: validatedData.currency || 'CAD',
          attributes: validatedData.attributes || null,
        },
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
          isActive: true,
          createdAt: true,
          updatedAt: true,
          vendor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
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

      return product;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Get product by ID
   * @param {String} productId - Product ID
   * @param {String} vendorId - Optional vendor ID for ownership check
   * @returns {Promise<Object>} Product
   */
  async getProductById(productId, vendorId = null) {
    const prisma = getPrisma();
    // Optimize: Use select for better performance
    const product = await prisma.product.findUnique({
      where: { id: productId },
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
      throw new Error('Product not found');
    }

    // If vendorId provided, check ownership
    if (vendorId && product.vendorId !== vendorId) {
      throw new Error('Unauthorized: Product does not belong to this vendor');
    }

    return product;
  }

  /**
   * List products for a vendor
   * @param {String} vendorId - Vendor ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Products with pagination
   */
  async listVendorProducts(vendorId, filters = {}) {
    const prisma = getPrisma();
    const {
      page = 1,
      limit = 20,
      search = '',
      categoryId = null,
      subcategoryId = null,
      isActive = null,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      vendorId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(subcategoryId && { subcategoryId }),
      ...(isActive !== null && { isActive }),
    };

    // Optimize: Use select instead of include for better performance
    const [products, total] = await Promise.all([
      prisma.product.findMany({
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
          isActive: true,
          vendorId: true,
          categoryId: true,
          subcategoryId: true,
          createdAt: true,
          updatedAt: true,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update product
   * @param {String} productId - Product ID
   * @param {String} vendorId - Vendor ID
   * @param {Object} data - Update data
   * @param {Array} newImageFiles - Optional new image files (will replace all images)
   * @returns {Promise<Object>} Updated product
   */
  async updateProduct(productId, vendorId, data, newImageFiles = null) {
    const prisma = getPrisma();
    // Check ownership
    const product = await this.getProductById(productId, vendorId);

    // Validate update data
    const validatedData = updateProductSchema.parse(data);

    // If category or subcategory is being updated, validate (optimize: parallel queries)
    if (validatedData.categoryId || validatedData.subcategoryId) {
      const categoryId = validatedData.categoryId || product.categoryId;
      const subcategoryId = validatedData.subcategoryId || product.subcategoryId;

      const [category, subcategory] = await Promise.all([
        prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, isActive: true },
        }),
        prisma.subcategory.findUnique({
          where: { id: subcategoryId },
          select: { id: true, isActive: true, categoryId: true },
        }),
      ]);

      if (!category || !category.isActive) {
        throw new Error('Category not found or inactive');
      }

      if (!subcategory || !subcategory.isActive || subcategory.categoryId !== categoryId) {
        throw new Error('Subcategory not found, inactive, or does not belong to the selected category');
      }
    }

    // Handle image updates
    let imageUrls = product.images;
    if (newImageFiles && newImageFiles.length > 0) {
      // Validate new images
      if (newImageFiles.length > 5) {
        throw new Error('Maximum 5 images allowed per product');
      }

      const imageValidation = firebaseStorageService.validateImages(newImageFiles);
      if (!imageValidation.valid) {
        throw new Error(imageValidation.error);
      }

      // Delete old images
      if (product.images && product.images.length > 0) {
        await firebaseStorageService.deleteMultipleImages(product.images);
      }

      // Upload new images
      imageUrls = await firebaseStorageService.uploadMultipleImages(newImageFiles, 'products');
    }

    // Check SKU uniqueness if updating
    if (validatedData.sku && validatedData.sku !== product.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { sku: validatedData.sku },
        select: { id: true },
      });

      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

      // Validate attributes if provided and category/subcategory changed
      if (validatedData.attributes || validatedData.categoryId || validatedData.subcategoryId) {
        const finalCategoryId = validatedData.categoryId || product.categoryId;
        const finalSubcategoryId = validatedData.subcategoryId || product.subcategoryId;
        
        const category = await prisma.category.findUnique({
          where: { id: finalCategoryId },
          select: { name: true },
        });
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: finalSubcategoryId },
          select: { name: true },
        });

        if (category && subcategory && validatedData.attributes) {
          const attrValidation = validateAttributes(
            validatedData.attributes,
            category.name,
            subcategory.name
          );
          if (!attrValidation.valid) {
            throw new Error(`Attribute validation failed: ${attrValidation.errors.join(', ')}`);
          }
        }
      }

      // Update product (optimize: use select)
      const updateData = {
        ...validatedData,
        images: imageUrls,
      };
      
      // Only include attributes if provided
      if (validatedData.attributes !== undefined) {
        updateData.attributes = validatedData.attributes;
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: updateData,
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
            },
          },
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
        },
      });

    return updatedProduct;
  }

  /**
   * Delete product
   * @param {String} productId - Product ID
   * @param {String} vendorId - Vendor ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteProduct(productId, vendorId) {
    // Check ownership
    const product = await this.getProductById(productId, vendorId);

    const prisma = getPrisma();
    // Check if product has orders
    const orderCount = await prisma.orderItem.count({
      where: { productId },
    });

    if (orderCount > 0) {
      throw new Error('Cannot delete product with existing orders. Deactivate instead.');
    }

    // Delete images from Firebase Storage
    if (product.images && product.images.length > 0) {
      await firebaseStorageService.deleteMultipleImages(product.images);
    }

    // Delete product
    await prisma.product.delete({
      where: { id: productId },
    });

    return true;
  }

  /**
   * Update product stock
   * @param {String} productId - Product ID
   * @param {String} vendorId - Vendor ID
   * @param {Number} stock - New stock quantity
   * @returns {Promise<Object>} Updated product
   */
  async updateStock(productId, vendorId, stock) {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('Stock must be a non-negative integer');
    }

    // Check ownership
    await this.getProductById(productId, vendorId);

    const prisma = getPrisma();
    // Optimize: Use select
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { stock },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
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
      },
    });

    return updatedProduct;
  }

  /**
   * Decrease stock (for orders)
   * @param {String} productId - Product ID
   * @param {Number} quantity - Quantity to decrease
   * @returns {Promise<Object>} Updated product
   */
  async decreaseStock(productId, quantity) {
    const prisma = getPrisma();
    // Optimize: Use atomic update with stock check
    const updatedProduct = await prisma.product.updateMany({
      where: {
        id: productId,
        stock: {
          gte: quantity, // Only update if stock is sufficient
        },
      },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    });

    if (updatedProduct.count === 0) {
      // Check if product exists or if stock is insufficient
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, stock: true },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
    }

    // Return updated product
    return await prisma.product.findUnique({
      where: { id: productId },
    });
  }

  /**
   * Increase stock (for cancellations/returns)
   * @param {String} productId - Product ID
   * @param {Number} quantity - Quantity to increase
   * @returns {Promise<Object>} Updated product
   */
  async increaseStock(productId, quantity) {
    const prisma = getPrisma();
    // Optimize: Direct atomic update
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });

    if (!updatedProduct) {
      throw new Error('Product not found');
    }

    return updatedProduct;
  }

  /**
   * Get all categories with subcategories
   * @returns {Promise<Array>} Categories with subcategories
   */
  async getCategories() {
    const prisma = getPrisma();
    // Optimize: Use select and cache-friendly query
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        image: true,
        isActive: true,
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            slug: true,
            categoryId: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories;
  }
}

module.exports = new ProductService();
