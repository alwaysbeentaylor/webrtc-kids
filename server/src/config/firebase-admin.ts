import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// For development, we'll use service account or project ID
// In production, use service account JSON file or environment variables

let firebaseAdmin: admin.app.App;

try {
  // Try to initialize with existing app
  firebaseAdmin = admin.app();
} catch (error) {
  // Initialize new app
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  
  if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
    // Use service account file if provided
    const serviceAccount = require(serviceAccountPath);
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else if (projectId && projectId !== 'your-project-id') {
    // Initialize with project ID (will use Application Default Credentials)
    firebaseAdmin = admin.initializeApp({
      projectId: projectId
    });
  } else {
    // Fallback: initialize without project (will use default credentials)
    // This might fail in some environments, but will work if ADC is configured
    try {
      firebaseAdmin = admin.initializeApp();
    } catch (initError) {
      console.warn('Firebase Admin initialization warning:', initError);
      // For development, we can still continue - token verification will fail gracefully
      firebaseAdmin = admin.initializeApp({
        projectId: 'demo-project'
      });
    }
  }
}

export default firebaseAdmin;

// Helper to verify Firebase ID token
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  try {
    // Skip verification for child tokens
    if (idToken.startsWith('child-token-')) {
      throw new Error('Child token - should be handled before this');
    }
    
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

