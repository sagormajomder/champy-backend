import admin from 'firebase-admin';

// Initialize Firebase Admin safely (prevents duplicate app errors in reloads)
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_KEY) {
    try {
      const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_KEY,
        'base64',
      ).toString('utf8');
      const serviceAccount = JSON.parse(decoded);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (err) {
      console.error('Firebase Admin initialization error:', err);
    }
  } else {
    console.warn('FIREBASE_SERVICE_KEY environment variable is missing.');
  }
}

export default admin;
