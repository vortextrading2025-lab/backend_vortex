const database = require('../config/database');
const { z } = require('zod');
const productService = require('./productService');
const cartService = require('./cartService');
const WalletService = require('../modules/wallet/walletService');

const prisma = database.getClient();

// Validation schemas
const createOrderSchema = z.object({
  vendorId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('Canada'),
  }).optional(),
  shippingName: z.string().optional(),
  shippingPhone: z.string().optional(),
  notes: z.string().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING_VENDOR_APPROVAL', 'PENDING_USER_APPROVAL', 'ACCEPTED', 'REJECTED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

const acceptOrderSchema = z.object({
  deliveryDate: z.string().datetime().or(z.date()),
});

class OrderService {
  /**
   * Generate unique order number
   * @returns {String} Order number
   */
  generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create order from cart
   * @param {String} userId - User ID
   * @param {Object} shippingInfo - Shipping information
   * @returns {Promise<Object|Array>} Created order(s) - single order or array if multiple vendors
   */
  async createOrderFromCart(userId, shippingInfo = {}) {
    // Get cart items
    const cartItems = await cartService.getCartItems(userId);
    
    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Group items by vendor
    const itemsByVendor = cartItems.reduce((acc, item) => {
      const vendorId = item.product.vendorId;
      if (!vendorId) return acc;
      
      if (!acc[vendorId]) {
        acc[vendorId] = [];
      }
      acc[vendorId].push({
        productId: item.product.id,
        quantity: item.quantity,
      });
      return acc;
    }, {});

    // Create orders for each vendor
    const orders = [];
    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      const order = await this.createOrder({
        vendorId,
        items,
        shippingAddress: shippingInfo.shippingAddress,
        shippingName: shippingInfo.shippingName,
        shippingPhone: shippingInfo.shippingPhone,
        notes: shippingInfo.notes,
      }, userId);
      orders.push(order);
    }

    // Clear cart after successful order creation
    if (orders.length > 0) {
      await cartService.clearCart(userId);
    }

    return orders.length === 1 ? orders[0] : orders;
  }

  /**
   * Create a new order
   * @param {Object} data - Order data
   * @param {String} userId - User ID placing the order
   * @returns {Promise<Object>} Created order
   */
  async createOrder(data, userId) {
    try {
      // Validate order data
      const validatedData = createOrderSchema.parse(data);

      // Verify vendor exists
      const vendor = await prisma.user.findUnique({
        where: { id: validatedData.vendorId },
        include: { vendorProfile: true },
      });

      if (!vendor || vendor.role !== 'VENDOR') {
        throw new Error('Invalid vendor');
      }

      // Fetch all products and validate
      const productIds = validatedData.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          vendorId: validatedData.vendorId,
          isActive: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error('One or more products not found or inactive');
      }

      // Validate stock and calculate totals
      const orderItems = [];
      let totalAmount = 0;

      for (const item of validatedData.items) {
        const product = products.find((p) => p.id === item.productId);
        
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }

        const subtotal = Number(product.price) * item.quantity;
        totalAmount += subtotal;

        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
          subtotal: subtotal,
        });
      }

      // Check wallet balance before creating order
      const userWallet = await WalletService.getWallet(userId);
      if (userWallet.balance < totalAmount) {
        throw new Error(`Insufficient wallet balance. Required: C$${totalAmount.toFixed(2)}, Available: C$${userWallet.balance.toFixed(2)}`);
      }

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order in transaction with increased timeout (15 seconds)
      const order = await prisma.$transaction(async (tx) => {
        // Get wallet within transaction
        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { id: true, balance: true }
        });

        if (!wallet || wallet.balance < totalAmount) {
          throw new Error(`Insufficient wallet balance. Required: C$${totalAmount.toFixed(2)}, Available: C$${(wallet?.balance || 0).toFixed(2)}`);
        }

        // Deduct from wallet
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: totalAmount }
          }
        });

        // Create order with PENDING_VENDOR_APPROVAL status (minimal select for speed)
        const newOrder = await tx.order.create({
          data: {
            userId,
            vendorId: validatedData.vendorId,
            orderNumber,
            totalAmount,
            currency: 'CAD',
            status: 'PENDING_VENDOR_APPROVAL', // Wait for vendor approval
            shippingAddress: validatedData.shippingAddress || null,
            shippingName: validatedData.shippingName || null,
            shippingPhone: validatedData.shippingPhone || null,
            notes: validatedData.notes || null,
            items: {
              create: orderItems,
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        });

        // Create transaction record linked to order (wallet already deducted above)
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId: userId,
            type: 'ORDER_PAYMENT',
            amount: -totalAmount, // Negative for deduction
            status: 'COMPLETED',
            referenceId: newOrder.id,
            referenceType: 'ORDER',
            description: `Order payment - ${orderNumber}`
          }
        });

        // NOTE: Stock is NOT decreased until vendor accepts the order
        // This allows vendor to reject if they cannot fulfill

        return newOrder;
      }, {
        maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
        timeout: 15000, // Maximum time the transaction can run (15 seconds)
      });

      // Fetch full order details after transaction completes (to avoid timeout)
      const fullOrder = await this.getOrderById(order.id, userId);
      return fullOrder;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Get order by ID
   * @param {String} orderId - Order ID
   * @param {String} userId - Optional user ID for ownership check
   * @param {String} vendorId - Optional vendor ID for ownership check
   * @returns {Promise<Object>} Order
   */
  async getOrderById(orderId, userId = null, vendorId = null) {
    // Optimize: Use select for better performance
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        vendorId: true,
        orderNumber: true,
        totalAmount: true,
        currency: true,
        status: true,
        shippingAddress: true,
        shippingName: true,
        shippingPhone: true,
        notes: true,
        proposedDeliveryDate: true,
        userApprovedDate: true,
        confirmedAt: true,
        shippedAt: true,
        deliveredAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            price: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                images: true,
                stock: true,
                sku: true,
                attributes: true,
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
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check ownership
    if (userId && order.userId !== userId) {
      throw new Error('Unauthorized: Order does not belong to this user');
    }

    if (vendorId && order.vendorId !== vendorId) {
      throw new Error('Unauthorized: Order does not belong to this vendor');
    }

    return order;
  }

  /**
   * List orders for a user
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Orders with pagination
   */
  async listUserOrders(userId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(status && { status }),
    };

      // Optimize: Use select for better performance
      const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          userId: true,
          vendorId: true,
          orderNumber: true,
          totalAmount: true,
          currency: true,
          status: true,
          shippingAddress: true,
          shippingName: true,
          shippingPhone: true,
          notes: true,
          proposedDeliveryDate: true,
          userApprovedDate: true,
          confirmedAt: true,
          shippedAt: true,
          deliveredAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true,
              subtotal: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  images: true,
                  price: true,
                  sku: true,
                  attributes: true,
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
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List orders for a vendor
   * @param {String} vendorId - Vendor ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Orders with pagination
   */
  async listVendorOrders(vendorId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      search = '',
    } = filters;

    const skip = (page - 1) * limit;

    // Debug logging
    console.log(`[listVendorOrders] vendorId: ${vendorId}, filters:`, filters);

    const where = {
      vendorId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    console.log(`[listVendorOrders] where clause:`, JSON.stringify(where, null, 2));

    // Optimize: Use select for better performance
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          userId: true,
          vendorId: true,
          orderNumber: true,
          totalAmount: true,
          currency: true,
          status: true,
          shippingAddress: true,
          shippingName: true,
          shippingPhone: true,
          notes: true,
          proposedDeliveryDate: true,
          userApprovedDate: true,
          confirmedAt: true,
          shippedAt: true,
          deliveredAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true,
              subtotal: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  images: true,
                  price: true,
                  sku: true,
                  attributes: true,
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
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    console.log(`[listVendorOrders] Found ${orders.length} orders, total: ${total}`);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order status
   * @param {String} orderId - Order ID
   * @param {String} vendorId - Vendor ID (for vendor updates)
   * @param {String} userId - User ID (for user cancellations)
   * @param {Object} data - Update data with status
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, vendorId = null, userId = null, data) {
    const validatedData = updateOrderStatusSchema.parse(data);
    const { status } = validatedData;

    // Get order
    const order = await this.getOrderById(orderId, userId, vendorId);

    // Validate status transition
    const validTransitions = {
      PENDING_VENDOR_APPROVAL: ['PENDING_USER_APPROVAL', 'REJECTED', 'CANCELLED'], // Vendor can accept (with date) -> PENDING_USER_APPROVAL, reject, user can cancel
      PENDING_USER_APPROVAL: ['ACCEPTED', 'PENDING_VENDOR_APPROVAL', 'CANCELLED'], // User can approve -> ACCEPTED, reject -> back to vendor, or cancel
      ACCEPTED: ['CONFIRMED', 'SHIPPED', 'CANCELLED'], // Vendor can confirm/ship, user can cancel
      REJECTED: [], // Final state
      CONFIRMED: ['SHIPPED', 'CANCELLED'], // Vendor can ship, user can cancel
      SHIPPED: ['DELIVERED'], // Vendor marks as delivered
      DELIVERED: [], // Final state - triggers settlement
      CANCELLED: [], // Final state
    };

    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      throw new Error(`Invalid status transition from ${order.status} to ${status}`);
    }

    // Handle cancellation
    if (status === 'CANCELLED') {
      // User can cancel PENDING_VENDOR_APPROVAL, PENDING_USER_APPROVAL, or ACCEPTED orders
      // Vendor can cancel ACCEPTED or CONFIRMED orders
      if ((order.status === 'PENDING_VENDOR_APPROVAL' || order.status === 'PENDING_USER_APPROVAL' || order.status === 'ACCEPTED') && !userId && !vendorId) {
        throw new Error('Only the user or vendor can cancel this order');
      }

      if (order.status === 'CONFIRMED' && !vendorId) {
        throw new Error('Only the vendor can cancel confirmed orders');
      }

      // Restore stock if order was accepted (stock was decreased)
      if (order.status === 'ACCEPTED' || order.status === 'CONFIRMED' || order.status === 'SHIPPED') {
        const stockRestores = order.items.map((item) =>
          productService.increaseStock(item.productId, item.quantity)
        );
        await Promise.all(stockRestores);
      }

      // Refund wallet if order was paid (PENDING_VENDOR_APPROVAL, PENDING_USER_APPROVAL, ACCEPTED, CONFIRMED)
      if (order.status === 'PENDING_VENDOR_APPROVAL' || order.status === 'PENDING_USER_APPROVAL' || order.status === 'ACCEPTED' || order.status === 'CONFIRMED') {
        await WalletService.addToWallet(
          order.userId,
          Number(order.totalAmount),
          orderId,
          'ORDER_REFUND',
          `Refund for cancelled order ${order.orderNumber}`
        );
      }

      // Optimize: Use select
      return await prisma.order.update({
        where: { id: orderId },
        data: {
          status,
          cancelledAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          vendorId: true,
          orderNumber: true,
          totalAmount: true,
          currency: true,
          status: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true,
              subtotal: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                },
              },
            },
          },
        },
      });
    }

    // Handle status updates with timestamps
    const updateData = { status };

    if (status === 'ACCEPTED' || status === 'CONFIRMED') {
      updateData.confirmedAt = new Date();
    } else if (status === 'SHIPPED') {
      updateData.shippedAt = new Date();
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        vendor: true,
        user: true,
      },
    });

    return updatedOrder;
  }

  /**
   * Cancel order (user only, for PENDING orders)
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Cancelled order
   */
  async cancelOrder(orderId, userId) {
    return this.updateOrderStatus(orderId, null, userId, { status: 'CANCELLED' });
  }

  /**
   * Vendor accepts order with delivery date
   * @param {String} orderId - Order ID
   * @param {String} vendorId - Vendor ID
   * @param {String|Date} deliveryDate - Proposed delivery date
   * @returns {Promise<Object>} Order with PENDING_USER_APPROVAL status
   */
  async acceptOrder(orderId, vendorId, deliveryDate) {
    const order = await this.getOrderById(orderId, null, vendorId);

    if (order.status !== 'PENDING_VENDOR_APPROVAL') {
      throw new Error(`Order must be in PENDING_VENDOR_APPROVAL status. Current status: ${order.status}`);
    }

    // Validate delivery date
    if (!deliveryDate) {
      throw new Error('Delivery date is required when accepting an order');
    }

    const parsedDate = new Date(deliveryDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid delivery date format');
    }

    // Verify stock is still available
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, name: true },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`);
      }
    }

    // Accept order and set status to PENDING_USER_APPROVAL (waiting for user to approve delivery date)
    return await prisma.$transaction(async (tx) => {
      // Update order status to PENDING_USER_APPROVAL with proposed delivery date
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PENDING_USER_APPROVAL',
          proposedDeliveryDate: parsedDate,
          userApprovedDate: null, // Reset approval status
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          vendor: true,
          user: true,
        },
      });

      // Don't decrease stock yet - wait for user approval
      // Stock will be decreased when user approves the delivery date

      return updatedOrder;
    });
  }

  /**
   * User approves delivery date
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Accepted order with stock decreased
   */
  async approveDeliveryDate(orderId, userId) {
    const order = await this.getOrderById(orderId, userId, null);

    if (order.status !== 'PENDING_USER_APPROVAL') {
      throw new Error(`Order must be in PENDING_USER_APPROVAL status. Current status: ${order.status}`);
    }

    if (!order.proposedDeliveryDate) {
      throw new Error('No delivery date proposed for this order');
    }

    // Approve delivery date and decrease stock in transaction
    return await prisma.$transaction(async (tx) => {
      // Update order status to ACCEPTED and mark date as approved
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'ACCEPTED',
          userApprovedDate: true,
          confirmedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          vendor: true,
          user: true,
        },
      });

      // Decrease stock for each product now that user approved
      const stockUpdates = order.items.map((item) =>
        productService.decreaseStock(item.productId, item.quantity)
      );
      await Promise.all(stockUpdates);

      return updatedOrder;
    });
  }

  /**
   * User rejects delivery date
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Order back to PENDING_VENDOR_APPROVAL
   */
  async rejectDeliveryDate(orderId, userId) {
    const order = await this.getOrderById(orderId, userId, null);

    if (order.status !== 'PENDING_USER_APPROVAL') {
      throw new Error(`Order must be in PENDING_USER_APPROVAL status. Current status: ${order.status}`);
    }

    // Reject delivery date - send order back to vendor for new date
    return await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PENDING_VENDOR_APPROVAL',
          proposedDeliveryDate: null,
          userApprovedDate: false,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          vendor: true,
          user: true,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Vendor rejects order
   * @param {String} orderId - Order ID
   * @param {String} vendorId - Vendor ID
   * @param {String} reason - Optional rejection reason
   * @returns {Promise<Object>} Rejected order
   */
  async rejectOrder(orderId, vendorId, reason = null) {
    const order = await this.getOrderById(orderId, null, vendorId);

    if (order.status !== 'PENDING_VENDOR_APPROVAL') {
      throw new Error(`Order must be in PENDING_VENDOR_APPROVAL status. Current status: ${order.status}`);
    }

    // Reject order and refund wallet in transaction
    return await prisma.$transaction(async (tx) => {
      // Update order status to REJECTED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'REJECTED',
          notes: reason ? `${order.notes || ''}\nRejection reason: ${reason}`.trim() : order.notes,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          vendor: true,
          user: true,
        },
      });

      // Refund amount to user wallet
      await WalletService.addToWallet(
        order.userId,
        Number(order.totalAmount),
        orderId,
        'ORDER_REFUND',
        `Refund for rejected order ${order.orderNumber}${reason ? ` - ${reason}` : ''}`
      );

      return updatedOrder;
    });
  }
}

module.exports = new OrderService();
