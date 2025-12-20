const { getStorageBucket } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class FirebaseStorageService {
  /**
   * Upload a single image to Firebase Storage
   * @param {Buffer} fileBuffer - File buffer
   * @param {String} fileName - Original file name
   * @param {String} folder - Folder path in storage (e.g., 'products')
   * @returns {Promise<String>} Public URL of uploaded file
   */
  async uploadImage(fileBuffer, fileName, folder = 'products') {
    try {
      const bucket = getStorageBucket();
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${folder}/${uuidv4()}${fileExtension}`;
      
      const file = bucket.file(uniqueFileName);
      
      // Upload file
      await file.save(fileBuffer, {
        metadata: {
          contentType: this.getContentType(fileExtension),
          metadata: {
            originalName: fileName,
            uploadedAt: new Date().toISOString(),
          },
        },
        public: true, // Make file publicly accessible
      });

      // Make file publicly accessible
      await file.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image to Firebase Storage:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Upload multiple images (up to 5 for products)
   * @param {Array<{buffer: Buffer, originalname: String}>} files - Array of file objects
   * @param {String} folder - Folder path in storage
   * @returns {Promise<Array<String>>} Array of public URLs
   */
  async uploadMultipleImages(files, folder = 'products') {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files array is required and cannot be empty');
    }

    if (files.length > 5) {
      throw new Error('Maximum 5 images allowed per product');
    }

    try {
      const uploadPromises = files.map((file) => {
        if (!file.buffer || !file.originalname) {
          throw new Error('Invalid file object. Must have buffer and originalname');
        }
        return this.uploadImage(file.buffer, file.originalname, folder);
      });

      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Firebase Storage
   * @param {String} imageUrl - Public URL of the image
   * @returns {Promise<Boolean>} Success status
   */
  async deleteImage(imageUrl) {
    try {
      const bucket = getStorageBucket();
      
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)
      
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      
      if (exists) {
        await file.delete();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting image from Firebase Storage:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Delete multiple images
   * @param {Array<String>} imageUrls - Array of image URLs
   * @returns {Promise<Object>} Results with success and failed deletions
   */
  async deleteMultipleImages(imageUrls) {
    if (!Array.isArray(imageUrls)) {
      throw new Error('Image URLs must be an array');
    }

    const results = {
      success: [],
      failed: [],
    };

    const deletePromises = imageUrls.map(async (url) => {
      try {
        const deleted = await this.deleteImage(url);
        if (deleted) {
          results.success.push(url);
        } else {
          results.failed.push(url);
        }
      } catch (error) {
        results.failed.push({ url, error: error.message });
      }
    });

    await Promise.all(deletePromises);
    return results;
  }

  /**
   * Get content type from file extension
   * @param {String} extension - File extension (e.g., '.jpg')
   * @returns {String} MIME type
   */
  getContentType(extension) {
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    return contentTypes[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Validate image file
   * @param {Object} file - File object with buffer and originalname
   * @param {Number} maxSizeMB - Maximum file size in MB (default: 5MB)
   * @returns {Object} Validation result
   */
  validateImage(file, maxSizeMB = 5) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const extension = path.extname(file.originalname).toLowerCase();

    if (!file.buffer) {
      return { valid: false, error: 'File buffer is required' };
    }

    if (file.buffer.length > maxSizeBytes) {
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
    }

    if (!allowedExtensions.includes(extension)) {
      return { valid: false, error: `File type not allowed. Allowed: ${allowedExtensions.join(', ')}` };
    }

    return { valid: true };
  }

  /**
   * Validate multiple images
   * @param {Array<Object>} files - Array of file objects
   * @param {Number} maxSizeMB - Maximum file size in MB
   * @returns {Object} Validation result
   */
  validateImages(files, maxSizeMB = 5) {
    if (!Array.isArray(files)) {
      return { valid: false, error: 'Files must be an array' };
    }

    if (files.length === 0) {
      return { valid: false, error: 'At least one image is required' };
    }

    if (files.length > 5) {
      return { valid: false, error: 'Maximum 5 images allowed' };
    }

    for (let i = 0; i < files.length; i++) {
      const validation = this.validateImage(files[i], maxSizeMB);
      if (!validation.valid) {
        return { valid: false, error: `Image ${i + 1}: ${validation.error}` };
      }
    }

    return { valid: true };
  }
}

module.exports = new FirebaseStorageService();
