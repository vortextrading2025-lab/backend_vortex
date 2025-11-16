/**
 * Standardized API Response Utilities
 * Provides consistent response structure for all API endpoints
 */

/**
 * Success Response Structure
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object} data - Response data
 * @param {Object} meta - Additional metadata (pagination, etc.)
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...(data && { data }),
    ...(meta && { meta })
  };

  return res.status(statusCode).json(response);
};

/**
 * Error Response Structure
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors or additional error details
 * @param {string} code - Error code for client handling
 */
const errorResponse = (res, statusCode = 400, message = 'An error occurred', errors = null, code = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    ...(errors && { errors }),
    ...(code && { code })
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && errors?.stack) {
    response.stack = errors.stack;
  }

  return res.status(statusCode).json(response);
};

/**
 * Validation Error Response
 * @param {Object} res - Express response object
 * @param {Array} validationErrors - Array of validation errors
 */
const validationErrorResponse = (res, validationErrors) => {
  return errorResponse(
    res,
    400,
    'Validation failed',
    {
      validation: validationErrors.map(error => ({
        field: error.path?.join('.') || 'unknown',
        message: error.message,
        value: error.input
      }))
    },
    'VALIDATION_ERROR'
  );
};

/**
 * Authentication Error Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const authErrorResponse = (res, message = 'Authentication required') => {
  return errorResponse(res, 401, message, null, 'AUTHENTICATION_ERROR');
};

/**
 * Authorization Error Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const authorizationErrorResponse = (res, message = 'Insufficient permissions') => {
  return errorResponse(res, 403, message, null, 'AUTHORIZATION_ERROR');
};

/**
 * Not Found Error Response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource that was not found
 */
const notFoundErrorResponse = (res, resource = 'Resource') => {
  return errorResponse(res, 404, `${resource} not found`, null, 'NOT_FOUND');
};

/**
 * Rate Limit Error Response
 * @param {Object} res - Express response object
 * @param {number} retryAfter - Seconds until retry is allowed
 */
const rateLimitErrorResponse = (res, retryAfter = 60) => {
  return errorResponse(
    res,
    429,
    'Too many requests, please try again later',
    { retryAfter },
    'RATE_LIMIT_EXCEEDED'
  );
};

/**
 * Server Error Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} error - Original error object
 */
const serverErrorResponse = (res, message = 'Internal server error', error = null) => {
  return errorResponse(
    res,
    500,
    message,
    process.env.NODE_ENV === 'development' ? { originalError: error?.message } : null,
    'INTERNAL_SERVER_ERROR'
  );
};

/**
 * Database Error Response
 * @param {Object} res - Express response object
 * @param {Object} error - Database error object
 */
const databaseErrorResponse = (res, error) => {
  let message = 'Database operation failed';
  let code = 'DATABASE_ERROR';

  // Handle specific Prisma errors
  if (error.code === 'P2002') {
    message = 'A record with this information already exists';
    code = 'DUPLICATE_ENTRY';
  } else if (error.code === 'P2025') {
    message = 'Record not found';
    code = 'RECORD_NOT_FOUND';
  } else if (error.code === 'P2003') {
    message = 'Foreign key constraint failed';
    code = 'FOREIGN_KEY_CONSTRAINT';
  }

  return errorResponse(res, 400, message, null, code);
};

/**
 * Pagination Metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {number} totalPages - Total pages
 */
const paginationMeta = (page, limit, total, totalPages) => ({
  pagination: {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages: parseInt(totalPages),
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
});

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  authErrorResponse,
  authorizationErrorResponse,
  notFoundErrorResponse,
  rateLimitErrorResponse,
  serverErrorResponse,
  databaseErrorResponse,
  paginationMeta
};

