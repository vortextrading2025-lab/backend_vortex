/**
 * Find User Script
 * Searches for a user by email, username, or name
 * 
 * Usage: node src/database/scripts/findUser.js [searchTerm]
 * Example: node src/database/scripts/findUser.js meyer-schulte
 */

require('dotenv').config();
const database = require('../../config/database');

const findUser = async () => {
  try {
    const searchTerm = process.argv[2];
    
    if (!searchTerm) {
      console.log('❌ Please provide a search term');
      console.log('Usage: node src/database/scripts/findUser.js [searchTerm]');
      console.log('Example: node src/database/scripts/findUser.js meyer-schulte');
      process.exit(1);
    }

    console.log(`🔍 Searching for user: "${searchTerm}"\n`);
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Search by email (exact match or contains)
    const usersByEmail = await prisma.user.findMany({
      where: {
        email: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      include: {
        wallet: {
          select: {
            balance: true,
            totalEarned: true,
            totalWithdrawn: true
          }
        },
        ownedUnits: {
          where: {
            isSystemRoot: false
          },
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            stage: true,
            isActive: true,
            isCompleted: true,
            level: true
          },
          orderBy: { unitNumber: 'asc' }
        },
        inviteLinks: {
          where: {
            invitedUserId: { not: null }
          },
          include: {
            invitedUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Search by username
    const usersByUsername = await prisma.user.findMany({
      where: {
        username: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      include: {
        wallet: {
          select: {
            balance: true,
            totalEarned: true,
            totalWithdrawn: true
          }
        },
        ownedUnits: {
          where: {
            isSystemRoot: false
          },
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            stage: true,
            isActive: true,
            isCompleted: true,
            level: true
          },
          orderBy: { unitNumber: 'asc' }
        },
        inviteLinks: {
          where: {
            invitedUserId: { not: null }
          },
          include: {
            invitedUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Search by first name or last name
    const usersByName = await prisma.user.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            lastName: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        ]
      },
      include: {
        wallet: {
          select: {
            balance: true,
            totalEarned: true,
            totalWithdrawn: true
          }
        },
        ownedUnits: {
          where: {
            isSystemRoot: false
          },
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            stage: true,
            isActive: true,
            isCompleted: true,
            level: true
          },
          orderBy: { unitNumber: 'asc' }
        },
        inviteLinks: {
          where: {
            invitedUserId: { not: null }
          },
          include: {
            invitedUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Combine all results and remove duplicates
    const allUsers = new Map();
    
    [...usersByEmail, ...usersByUsername, ...usersByName].forEach(user => {
      if (!allUsers.has(user.id)) {
        allUsers.set(user.id, user);
      }
    });

    const uniqueUsers = Array.from(allUsers.values());

    if (uniqueUsers.length === 0) {
      console.log(`❌ No users found matching "${searchTerm}"`);
      console.log('\nTried searching by:');
      console.log('  - Email');
      console.log('  - Username');
      console.log('  - First Name');
      console.log('  - Last Name');
    } else {
      console.log(`✅ Found ${uniqueUsers.length} user(s):\n`);

      for (let index = 0; index < uniqueUsers.length; index++) {
        const user = uniqueUsers[index];
        console.log(`${'='.repeat(70)}`);
        console.log(`User ${index + 1}:`);
        console.log(`${'='.repeat(70)}`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Username: ${user.username || 'N/A'}`);
        console.log(`  Name: ${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A');
        console.log(`  Role: ${user.role}`);
        console.log(`  Status: ${user.status}`);
        console.log(`  Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
        console.log(`  Phone Verified: ${user.phoneVerified ? 'Yes' : 'No'}`);
        console.log(`  Created At: ${new Date(user.createdAt).toLocaleString()}`);

        // Wallet information
        if (user.wallet) {
          console.log(`\n  💰 Wallet:`);
          console.log(`     Balance: C$${Number(user.wallet.balance).toFixed(2)}`);
          console.log(`     Total Earned: C$${Number(user.wallet.totalEarned).toFixed(2)}`);
          console.log(`     Total Withdrawn: C$${Number(user.wallet.totalWithdrawn).toFixed(2)}`);
        } else {
          console.log(`\n  💰 Wallet: No wallet found`);
        }

        // Units information
        if (user.ownedUnits && user.ownedUnits.length > 0) {
          console.log(`\n  📦 Units (${user.ownedUnits.length}):`);
          user.ownedUnits.forEach(unit => {
            const status = unit.isActive ? 'ACTIVE' : unit.isCompleted ? 'COMPLETED' : 'INACTIVE';
            console.log(`     - ${unit.unitName} (#${unit.unitNumber}): Stage ${unit.stage}, Level ${unit.level}, ${status}`);
          });
        } else {
          console.log(`\n  📦 Units: No units found`);
        }

        // Invite links information
        if (user.inviteLinks && user.inviteLinks.length > 0) {
          console.log(`\n  🔗 Invited Users (${user.inviteLinks.length}):`);
          user.inviteLinks.forEach(link => {
            const invitedUser = link.invitedUser;
            if (invitedUser) {
              const name = `${invitedUser.firstName || ''} ${invitedUser.lastName || ''}`.trim() || 'N/A';
              console.log(`     - ${name} (${invitedUser.email})`);
            }
          });
        } else {
          console.log(`\n  🔗 Invited Users: None`);
        }

        // Check if user was invited
        const wasInvited = await prisma.inviteLink.findFirst({
          where: {
            invitedUserId: user.id
          },
          include: {
            inviter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        });

        if (wasInvited) {
          console.log(`\n  👤 Invited By:`);
          const inviterName = `${wasInvited.inviter.firstName || ''} ${wasInvited.inviter.lastName || ''}`.trim() || 'N/A';
          console.log(`     ${inviterName} (${wasInvited.inviter.email})`);
          console.log(`     Invite Code: ${wasInvited.inviteCode}`);
        }

        console.log('');
      }
    }

    console.log('='.repeat(70));
    console.log('✅ Search completed\n');

  } catch (error) {
    console.error('❌ Error searching for user:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
};

// Run the script
findUser();

