const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// For production, use service account JSON file from environment variable
// For development, you can use the config directly or service account

let firebaseApp;

try {
  // Check if Firebase is already initialized
  if (admin.apps.length === 0) {
    // Try to initialize with service account from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vortex-web-platform.firebasestorage.app',
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Initialize with project ID (for emulator or default credentials)
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vortex-web-platform.firebasestorage.app',
      });
    } else {
      // Use default credentials (for GCP environments)
      firebaseApp = admin.initializeApp({
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vortex-web-platform.firebasestorage.app',
      });
    }
    console.log('✅ Firebase Admin SDK initialized');
  } else {
    firebaseApp = admin.app();
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  throw error;
}

// Get Storage bucket
const getStorageBucket = () => {
  return admin.storage().bucket();
};

module.exports = {
  admin,
  firebaseApp,
  getStorageBucket,
};
