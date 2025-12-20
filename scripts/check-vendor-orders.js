const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVendorOrders() {
  try {
    console.log('🔍 Checking vendor orders...\n');

    // Find vendor by email
    const vendor = await prisma.user.findUnique({
      where: { email: 'vendor1@gmail.com' },
      select: { id: true, email: true, role: true }
    });

    if (!vendor) {
      console.log('❌ Vendor not found: vendor1@gmail.com');
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Vendor found:');
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Email: ${vendor.email}`);
    console.log(`   Role: ${vendor.role}\n`);

    // Find all orders for this vendor
    const orders = await prisma.order.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        orderNumber: true,
        vendorId: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        vendor: {
          select: { id: true, email: true }
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📦 Found ${orders.length} order(s) for vendor1@gmail.com:\n`);
    
    if (orders.length === 0) {
      console.log('⚠️  No orders found!');
      
      // Check if there are any orders at all
      const allOrders = await prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          vendorId: true,
          status: true,
          vendor: {
            select: { id: true, email: true }
          }
        },
        take: 10
      });

      console.log(`\n📋 Total orders in database: ${allOrders.length}`);
      if (allOrders.length > 0) {
        console.log('\nSample orders:');
        allOrders.forEach(order => {
          console.log(`   Order ${order.orderNumber}: vendorId=${order.vendorId}, vendorEmail=${order.vendor?.email || 'N/A'}`);
        });
      }
    } else {
      orders.forEach((order, index) => {
        console.log(`Order ${index + 1}:`);
        console.log(`   ID: ${order.id}`);
        console.log(`   Order Number: ${order.orderNumber}`);
        console.log(`   Vendor ID: ${order.vendorId}`);
        console.log(`   Vendor Email: ${order.vendor?.email || 'N/A'}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: C$${Number(order.totalAmount).toFixed(2)}`);
        console.log(`   Customer: ${order.user?.firstName} ${order.user?.lastName} (${order.user?.email})`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('');
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkVendorOrders();
