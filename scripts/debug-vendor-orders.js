const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugVendorOrders() {
  try {
    console.log('🔍 Debugging vendor orders query...\n');

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

    // Test the exact query used in listVendorOrders
    const where = {
      vendorId: vendor.id,
    };

    console.log('📋 Testing query with where clause:');
    console.log(JSON.stringify(where, null, 2));
    console.log('');

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          vendorId: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      }),
      prisma.order.count({ where }),
    ]);

    console.log(`📦 Query Results:`);
    console.log(`   Found ${orders.length} orders`);
    console.log(`   Total count: ${total}`);
    console.log('');

    if (orders.length > 0) {
      console.log('✅ Orders found:');
      orders.forEach((order, index) => {
        console.log(`   Order ${index + 1}:`);
        console.log(`      ID: ${order.id}`);
        console.log(`      Order Number: ${order.orderNumber}`);
        console.log(`      Vendor ID: ${order.vendorId}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Vendor ID Match: ${order.vendorId === vendor.id ? '✅ YES' : '❌ NO'}`);
        console.log('');
      });
    } else {
      console.log('❌ No orders found with this query!');
      
      // Check all orders to see what vendor IDs exist
      const allOrders = await prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          vendorId: true,
          status: true,
        },
        take: 10
      });

      console.log(`\n📋 All orders in database (first 10):`);
      allOrders.forEach((order, index) => {
        console.log(`   Order ${index + 1}:`);
        console.log(`      Order Number: ${order.orderNumber}`);
        console.log(`      Vendor ID: ${order.vendorId}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Matches vendor ID? ${order.vendorId === vendor.id ? '✅ YES' : '❌ NO'}`);
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

debugVendorOrders();
