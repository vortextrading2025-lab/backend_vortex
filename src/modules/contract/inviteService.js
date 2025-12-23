const database = require('../../config/database');
const logger = require('../logging/logger');
const crypto = require('crypto');

class InviteService {
  /**
   * Generate a unique invite code
   */
  static generateInviteCode() {
    // Generate a random 8-character alphanumeric code
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Create an invite link for a user
   */
  static async createInviteLink(inviterId, options = {}) {
    const {
      maxUses = null, // null = unlimited
      expiresAt = null, // null = never expires
      customCode = null // Optional custom code
    } = options;

    // Check if user has any odd unit (101, 103, 105, etc.) with available space
    // Odd units are the ones that can receive invites (placed under host's active unit)
    const userUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: inviterId,
        isSystemRoot: false
      }
    });

    if (userUnits.length === 0) {
      throw new Error('You must have at least one unit to create invite links. Please purchase units first.');
    }

    // Filter to get odd units (101, 103, 105, etc.) - these are the ones that can receive invites
    const oddUnits = userUnits.filter(unit => {
      const unitNum = unit.unitNumber || 0;
      return unitNum % 2 === 1; // Odd numbers: 101, 103, 105, etc.
    });

    if (oddUnits.length === 0) {
      throw new Error('You must have at least one odd unit (101, 103, 105, etc.) to create invite links. Odd units are required to receive invites.');
    }

    // Find the first odd unit with available space (less than 2 children)
    let availableUnit = null;
    for (const unit of oddUnits) {
      // Count direct children of this unit
      const childrenCount = await database.getClient().unit.count({
        where: {
          parentUnitId: unit.id
        }
      });
      
      if (childrenCount < 2) {
        availableUnit = unit;
        break; // Found a unit with space
      }
    }

    if (!availableUnit) {
      throw new Error('You must have at least one unit (101, 103, 105, etc.) with available space to create invite links. All your odd units are full (2/2 children each).');
    }

    // Generate unique invite code
    let inviteCode = customCode || this.generateInviteCode();
    
    // Ensure code is unique
    let existingLink = await database.getClient().inviteLink.findUnique({
      where: { inviteCode }
    });
    
    let attempts = 0;
    while (existingLink && attempts < 10) {
      inviteCode = this.generateInviteCode();
      existingLink = await database.getClient().inviteLink.findUnique({
        where: { inviteCode }
      });
      attempts++;
    }

    if (existingLink) {
      throw new Error('Failed to generate unique invite code. Please try again.');
    }

    // Get frontend URL from environment
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const inviteUrl = `${frontendUrl}/register?invite=${inviteCode}`;

    // Create invite link
    const inviteLink = await database.getClient().inviteLink.create({
      data: {
        inviterId,
        inviteCode,
        inviteUrl,
        maxUses,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        currentUses: 0
      }
    });

    logger.info(`Invite link created: ${inviteCode} by user ${inviterId}`);
    return inviteLink;
  }

  /**
   * Get invite link by code
   */
  static async getInviteLinkByCode(inviteCode) {
    const inviteLink = await database.getClient().inviteLink.findUnique({
      where: { inviteCode },
      include: {
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!inviteLink) {
      return null;
    }

    // Check if invite is valid
    if (!inviteLink.isActive) {
      throw new Error('This invite link is no longer active.');
    }

    if (inviteLink.expiresAt && new Date(inviteLink.expiresAt) < new Date()) {
      throw new Error('This invite link has expired.');
    }

    if (inviteLink.maxUses && inviteLink.currentUses >= inviteLink.maxUses) {
      throw new Error('This invite link has reached its maximum uses.');
    }

    return inviteLink;
  }

  /**
   * Use an invite link (mark as used when user registers/joins)
   */
  static async useInviteLink(inviteCode, invitedUserId) {
    const inviteLink = await this.getInviteLinkByCode(inviteCode);

    if (!inviteLink) {
      throw new Error('Invalid invite code.');
    }

    // Check if already used by this user
    if (inviteLink.invitedUserId) {
      throw new Error('This invite link has already been used.');
    }

    // Update invite link
    const updatedLink = await database.getClient().inviteLink.update({
      where: { id: inviteLink.id },
      data: {
        invitedUserId,
        currentUses: { increment: 1 },
        lastUsedAt: new Date(),
        isActive: inviteLink.maxUses ? inviteLink.currentUses + 1 < inviteLink.maxUses : true
      }
    });

    logger.info(`Invite link ${inviteCode} used by user ${invitedUserId}`);
    return updatedLink;
  }

  /**
   * Get all invite links for a user
   */
  static async getUserInviteLinks(userId) {
    return await database.getClient().inviteLink.findMany({
      where: { inviterId: userId },
      include: {
        invitedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get invite link details (for checking before registration)
   */
  static async getInviteLinkDetails(inviteCode) {
    const inviteLink = await this.getInviteLinkByCode(inviteCode);
    
    if (!inviteLink) {
      return null;
    }

    return {
      inviteCode: inviteLink.inviteCode,
      inviter: inviteLink.inviter,
      isActive: inviteLink.isActive,
      expiresAt: inviteLink.expiresAt,
      maxUses: inviteLink.maxUses,
      currentUses: inviteLink.currentUses,
      isUsed: !!inviteLink.invitedUserId
    };
  }

  /**
   * Deactivate an invite link
   */
  static async deactivateInviteLink(inviteLinkId, userId) {
    const inviteLink = await database.getClient().inviteLink.findUnique({
      where: { id: inviteLinkId }
    });

    if (!inviteLink) {
      throw new Error('Invite link not found.');
    }

    if (inviteLink.inviterId !== userId) {
      throw new Error('You do not have permission to deactivate this invite link.');
    }

    const updatedLink = await database.getClient().inviteLink.update({
      where: { id: inviteLinkId },
      data: { isActive: false }
    });

    logger.info(`Invite link ${inviteLink.inviteCode} deactivated by user ${userId}`);
    return updatedLink;
  }

  /**
   * Check if a user was invited (has an active invite link)
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} - True if user was invited, false otherwise
   */
  static async wasUserInvited(userId) {
    const inviteLink = await database.getClient().inviteLink.findFirst({
      where: {
        invitedUserId: userId,
        isActive: true
      }
    });

    return !!inviteLink;
  }

  /**
   * Get inviter details for a user
   * @param {string} userId - User ID to get inviter for
   * @returns {Promise<Object|null>} - Inviter details or null if not invited
   */
  static async getInviterForUser(userId) {
    const inviteLink = await database.getClient().inviteLink.findFirst({
      where: {
        invitedUserId: userId,
        isActive: true
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
      },
      orderBy: { lastUsedAt: 'desc' } // Get most recent invite
    });

    if (!inviteLink || !inviteLink.inviter) {
      return null;
    }

    return {
      inviter: inviteLink.inviter,
      inviteCode: inviteLink.inviteCode,
      invitedAt: inviteLink.lastUsedAt || inviteLink.createdAt
    };
  }

  /**
   * Get invitation status for a user
   * @param {string} userId - User ID to check
   * @returns {Promise<Object>} - Invitation status information
   */
  static async getInvitationStatus(userId) {
    const inviteLink = await database.getClient().inviteLink.findFirst({
      where: {
        invitedUserId: userId,
        isActive: true
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
      },
      orderBy: { lastUsedAt: 'desc' }
    });

    if (!inviteLink) {
      return {
        wasInvited: false,
        inviter: null,
        inviteCode: null,
        invitedAt: null
      };
    }

    return {
      wasInvited: true,
      inviter: inviteLink.inviter,
      inviteCode: inviteLink.inviteCode,
      invitedAt: inviteLink.lastUsedAt || inviteLink.createdAt,
      inviteLinkId: inviteLink.id
    };
  }
}

module.exports = InviteService;

