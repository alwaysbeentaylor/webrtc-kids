import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// For development, we'll use service account or project ID
// In production, use service account JSON file or environment variables

let firebaseAdmin: admin.app.App | null = null;

try {
  // Try to initialize with existing app
  firebaseAdmin = admin.app();
} catch (error) {
  // Initialize new app
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON string from Railway
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  // Option 1: Service Account JSON string (from Railway environment variable)
  if (serviceAccountJson && !firebaseAdmin) {
    try {
      const serviceAccount = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson) 
        : serviceAccountJson;
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
    } catch (parseError) {
      console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError);
    }
  }
  
  // Option 2: Individual environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
  if (!firebaseAdmin && projectId && privateKey && clientEmail) {
    try {
      // Replace \\n with actual newlines in private key
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          privateKey: formattedPrivateKey,
          clientEmail: clientEmail
        })
      });
      console.log('✅ Firebase Admin initialized with individual variables');
    } catch (certError) {
      console.error('❌ Error initializing with individual variables:', certError);
    }
  }
  
  // Option 3: Service Account file path (for local development)
  if (!firebaseAdmin && serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account file');
  }
  
  // Option 4: Project ID only (will use Application Default Credentials)
  if (!firebaseAdmin && projectId && projectId !== 'your-project-id') {
    firebaseAdmin = admin.initializeApp({
      projectId: projectId
    });
    console.log('✅ Firebase Admin initialized with project ID');
  }
  
  // Fallback: initialize without project (will use default credentials)
  if (!firebaseAdmin) {
    try {
      firebaseAdmin = admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials');
    } catch (initError) {
      console.warn('⚠️ Firebase Admin initialization warning:', initError);
      // For development, we can still continue - token verification will fail gracefully
      firebaseAdmin = admin.initializeApp({
        projectId: 'demo-project'
      });
      console.warn('⚠️ Using demo project - Firebase auth will not work');
    }
  }
}

// Ensure firebaseAdmin is never null
if (!firebaseAdmin) {
  firebaseAdmin = admin.initializeApp({
    projectId: 'demo-project'
  });
  console.warn('⚠️ Firebase Admin fallback initialization');
}

export default firebaseAdmin;

// Helper to verify Firebase ID token
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  try {
    // Skip verification for child tokens
    if (idToken.startsWith('child-token-')) {
      throw new Error('Child token - should be handled before this');
    }
    
    if (!firebaseAdmin) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    // Log more details about the error
    console.error('❌ Firebase token verification error:', error);
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message);
      console.error('❌ Error name:', error.name);
      if (error.stack) {
        console.error('❌ Error stack:', error.stack);
      }
    }
    throw new Error(`Invalid or expired token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

