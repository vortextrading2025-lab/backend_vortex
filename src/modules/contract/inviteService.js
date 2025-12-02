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

    // Check if user has an active unit (required to invite others)
    const ContractService = require('./contractService');
    const activeUnit = await ContractService.findActiveUnit(inviterId);
    
    if (!activeUnit) {
      throw new Error('You must have an active unit to create invite links. Please purchase units first.');
    }

    // Check if active unit has space (max 2 children per parent in binary tree)
    const childrenCount = await database.getClient().contract.count({
      where: { parentId: activeUnit.id }
    });

    if (childrenCount >= 2) {
      throw new Error('Your active unit already has 2 children (maximum allowed). You cannot invite more people until one of your units becomes active.');
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
}

module.exports = InviteService;

