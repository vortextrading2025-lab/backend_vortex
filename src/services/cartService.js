const database = require('../config/database');
const prisma = database.getClient();

class CartService {
  /**
   * Get user's cart items
   * @param {String} userId - User ID
   * @returns {Promise<Array>} Cart items with products
   */
  async getCartItems(userId) {
    // Optimize: Use select instead of include for better performance
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            stock: true,
            images: true,
            isActive: true,
            vendorId: true,
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

    return cartItems;
  }

  /**
   * Add item to cart
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @param {Number} quantity - Quantity (default: 1)
   * @returns {Promise<Object>} Cart item
   */
  async addToCart(userId, productId, quantity = 1) {
    // Optimize: Check product and existing cart item in parallel
    const [product, existingItem] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          isActive: true,
          stock: true,
        },
      }),
      prisma.cartItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: {
          id: true,
          quantity: true,
        },
      }),
    ]);

    if (!product || !product.isActive) {
      throw new Error('Product not found or inactive');
    }

    if (product.stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${product.stock}`);
    }

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${newQuantity}`);
      }

      // Optimize: Use select
      return await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        select: {
          id: true,
          userId: true,
          productId: true,
          quantity: true,
          createdAt: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
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

    // Create new cart item (optimize: use select)
    return await prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity,
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
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
   * Update cart item quantity
   * @param {String} cartItemId - Cart item ID
   * @param {String} userId - User ID
   * @param {Number} quantity - New quantity
   * @returns {Promise<Object>} Updated cart item
   */
  async updateCartItem(cartItemId, userId, quantity) {
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    // Optimize: Fetch cart item and product in parallel, only get needed fields
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      select: {
        id: true,
        userId: true,
        productId: true,
        product: {
          select: {
            id: true,
            stock: true,
          },
        },
      },
    });

    if (!cartItem) {
      throw new Error('Cart item not found');
    }

    if (cartItem.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (cartItem.product.stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${cartItem.product.stock}`);
    }

    // Optimize: Use select
    return await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
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
   * Remove item from cart
   * @param {String} cartItemId - Cart item ID
   * @param {String} userId - User ID
   * @returns {Promise<Boolean>} Success status
   */
  async removeFromCart(cartItemId, userId) {
    // Optimize: Check ownership and delete in one query if possible
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!cartItem) {
      throw new Error('Cart item not found');
    }

    if (cartItem.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    return true;
  }

  /**
   * Clear user's cart
   * @param {String} userId - User ID
   * @returns {Promise<Number>} Number of items removed
   */
  async clearCart(userId) {
    const result = await prisma.cartItem.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Get cart summary (total items, total amount)
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Cart summary
   */
  /**
   * Get cart summary (total items, total amount) - optimized version
   * @param {String} userId - User ID
   * @param {Array} cartItems - Optional pre-fetched cart items to avoid duplicate query
   * @returns {Promise<Object>} Cart summary
   */
  async getCartSummary(userId, cartItems = null) {
    // If cartItems provided, use them; otherwise fetch
    const items = cartItems || await this.getCartItems(userId);

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    return {
      totalItems,
      totalAmount,
      items,
    };
  }
}

module.exports = new CartService();
