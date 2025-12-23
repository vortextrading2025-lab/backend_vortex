const database = require('../config/database');
const prisma = database.getClient();

class WishlistService {
  /**
   * Get user's wishlist items
   * @param {String} userId - User ID
   * @returns {Promise<Array>} Wishlist items with products
   */
  async getWishlistItems(userId) {
    // Optimize: Use select instead of include
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        productId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            sellingPrice: true,
            costPrice: true,
            mrp: true,
            currency: true,
            stock: true,
            images: true,
            isActive: true,
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
                vendorProfile: {
                  select: {
                    businessName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return wishlistItems;
  }

  /**
   * Add product to wishlist
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Promise<Object>} Wishlist item
   */
  async addToWishlist(userId, productId) {
    // Optimize: Check product and existing wishlist item in parallel
    const [product, existing] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          isActive: true,
        },
      }),
      prisma.wishlistItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!product || !product.isActive) {
      throw new Error('Product not found or inactive');
    }

    if (existing) {
      return existing; // Already in wishlist
    }

    // Create wishlist item (optimize: use select)
    return await prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            sellingPrice: true,
            costPrice: true,
            mrp: true,
            currency: true,
            stock: true,
            images: true,
            isActive: true,
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
        },
      },
    });
  }

  /**
   * Remove product from wishlist
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Promise<Boolean>} Success status
   */
  async removeFromWishlist(userId, productId) {
    // Use deleteMany with AND condition for composite unique constraint
    const deleteResult = await prisma.wishlistItem.deleteMany({
      where: {
        AND: [
          { userId },
          { productId },
        ],
      },
    });

    if (deleteResult.count === 0) {
      throw new Error('Item not in wishlist');
    }

    return true;
  }

  /**
   * Check if product is in wishlist
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Promise<Boolean>} Is in wishlist
   */
  async isInWishlist(userId, productId) {
    // Optimize: Only check existence, don't fetch full record
    // For composite unique, use findFirst with AND
    const wishlistItem = await prisma.wishlistItem.findFirst({
      where: {
        AND: [
          { userId },
          { productId },
        ],
      },
      select: {
        id: true, // Only need to know if it exists
      },
    });

    return !!wishlistItem;
  }

  /**
   * Clear user's wishlist
   * @param {String} userId - User ID
   * @returns {Promise<Number>} Number of items removed
   */
  async clearWishlist(userId) {
    const result = await prisma.wishlistItem.deleteMany({
      where: { userId },
    });

    return result.count;
  }
}

module.exports = new WishlistService();
