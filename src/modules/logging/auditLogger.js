const database = require('../../config/database');
const logger = require('./logger');

class AuditLogger {
  static async log({
    userId = null,
    action,
    resource = null,
    resourceId = null,
    details = null,
    ipAddress = null,
    userAgent = null,
    level = 'INFO',
    message,
    metadata = null
  }) {
    try {
      // Create audit log entry
      const auditLog = await database.getClient().auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          details,
          ipAddress,
          userAgent,
          level,
          message,
          metadata
        }
      });

      // Also log to Winston
      const logMessage = `AUDIT: ${action} - ${message}`;
      const logData = {
        userId,
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        auditLogId: auditLog.id
      };

      switch (level) {
        case 'ERROR':
          logger.error(logMessage, logData);
          break;
        case 'WARN':
          logger.warn(logMessage, logData);
          break;
        case 'DEBUG':
          logger.debug(logMessage, logData);
          break;
        default:
          logger.info(logMessage, logData);
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  // Convenience methods for common actions
  static async logLogin(userId, ipAddress, userAgent, success = true) {
    return this.log({
      userId,
      action: 'LOGIN',
      level: success ? 'INFO' : 'WARN',
      message: success ? 'User logged in successfully' : 'Failed login attempt',
      ipAddress,
      userAgent,
      metadata: { success }
    });
  }

  static async logLogout(userId, ipAddress, userAgent) {
    return this.log({
      userId,
      action: 'LOGOUT',
      message: 'User logged out',
      ipAddress,
      userAgent
    });
  }

  static async logUserAction(userId, action, resource, resourceId, details, ipAddress, userAgent) {
    return this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      message: `User performed ${action} on ${resource}`
    });
  }

  static async logSystemEvent(action, message, details = null, level = 'INFO') {
    return this.log({
      action,
      message,
      details,
      level,
      metadata: { systemEvent: true }
    });
  }

  static async logError(userId, action, error, ipAddress = null, userAgent = null) {
    return this.log({
      userId,
      action,
      level: 'ERROR',
      message: `Error during ${action}: ${error.message}`,
      details: {
        error: error.message,
        stack: error.stack
      },
      ipAddress,
      userAgent
    });
  }

  // Get audit logs with filtering
  static async getAuditLogs({
    userId = null,
    action = null,
    resource = null,
    level = null,
    startDate = null,
    endDate = null,
    limit = 100,
    offset = 0
  } = {}) {
    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (level) where.level = level;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return database.getClient().auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }
}

module.exports = AuditLogger;
