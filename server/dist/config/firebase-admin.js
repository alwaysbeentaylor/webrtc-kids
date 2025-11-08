"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIdToken = verifyIdToken;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
// For development, we'll use service account or project ID
// In production, use service account JSON file or environment variables
let firebaseAdmin = null;
let initializationAttempted = false;
function initializeFirebaseAdmin() {
    if (initializationAttempted) {
        return; // Already attempted initialization
    }
    initializationAttempted = true;
    try {
        // Try to initialize with existing app
        firebaseAdmin = admin.app();
        console.log('✅ Firebase Admin already initialized');
        return;
    }
    catch (error) {
        // No existing app, continue with initialization
    }
    // Initialize new app
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON string from Railway
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    console.log('🔍 Firebase Admin initialization check:', {
        hasServiceAccountJson: !!serviceAccountJson,
        hasProjectId: !!projectId,
        hasPrivateKey: !!privateKey,
        hasClientEmail: !!clientEmail,
        projectId: projectId || 'not set'
    });
    // Option 1: Service Account JSON string (from Railway environment variable)
    if (serviceAccountJson && !firebaseAdmin) {
        try {
            console.log('🔍 Attempting to parse FIREBASE_SERVICE_ACCOUNT...');
            const serviceAccount = typeof serviceAccountJson === 'string'
                ? JSON.parse(serviceAccountJson)
                : serviceAccountJson;
            console.log('🔍 Parsed service account, project_id:', serviceAccount.project_id);
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
            console.log('✅ Firebase project:', serviceAccount.project_id);
            return;
        }
        catch (parseError) {
            console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError);
            if (parseError instanceof Error) {
                console.error('❌ Parse error message:', parseError.message);
                console.error('❌ Parse error stack:', parseError.stack);
            }
        }
    }
    // Option 2: Individual environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
    if (!firebaseAdmin && projectId && privateKey && clientEmail) {
        try {
            console.log('🔍 Attempting to initialize with individual variables...');
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
            console.log('✅ Firebase project:', projectId);
            return;
        }
        catch (certError) {
            console.error('❌ Error initializing with individual variables:', certError);
            if (certError instanceof Error) {
                console.error('❌ Cert error message:', certError.message);
            }
        }
    }
    // Option 3: Service Account file path (for local development)
    if (!firebaseAdmin && serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
        try {
            const serviceAccount = require(serviceAccountPath);
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin initialized with service account file');
            return;
        }
        catch (fileError) {
            console.error('❌ Error loading service account file:', fileError);
        }
    }
    // Option 4: Project ID only (will use Application Default Credentials)
    if (!firebaseAdmin && projectId && projectId !== 'your-project-id') {
        try {
            firebaseAdmin = admin.initializeApp({
                projectId: projectId
            });
            console.log('✅ Firebase Admin initialized with project ID');
            console.log('⚠️  Note: Using Application Default Credentials - may not work in Railway');
            return;
        }
        catch (projectError) {
            console.error('❌ Error initializing with project ID:', projectError);
        }
    }
    // Fallback: initialize without project (will use default credentials)
    if (!firebaseAdmin) {
        try {
            firebaseAdmin = admin.initializeApp();
            console.log('✅ Firebase Admin initialized with default credentials');
            console.log('⚠️  Warning: May not work correctly without proper credentials');
        }
        catch (initError) {
            console.error('❌ Firebase Admin initialization failed:', initError);
            if (initError instanceof Error) {
                console.error('❌ Init error message:', initError.message);
            }
            // For development, we can still continue - token verification will fail gracefully
            try {
                firebaseAdmin = admin.initializeApp({
                    projectId: 'demo-project'
                });
                console.warn('⚠️ Using demo project - Firebase auth will not work');
            }
            catch (fallbackError) {
                console.error('❌ Fallback initialization also failed:', fallbackError);
            }
        }
    }
}
// Initialize on module load
initializeFirebaseAdmin();
// Ensure firebaseAdmin is never null
if (!firebaseAdmin) {
    try {
        firebaseAdmin = admin.initializeApp({
            projectId: 'demo-project'
        });
        console.warn('⚠️ Firebase Admin fallback initialization');
    }
    catch (error) {
        console.error('❌ Firebase Admin fallback initialization failed:', error);
    }
}
exports.default = firebaseAdmin;
// Helper to verify Firebase ID token
async function verifyIdToken(idToken) {
    try {
        // Skip verification for child tokens
        if (idToken.startsWith('child-token-')) {
            throw new Error('Child token - should be handled before this');
        }
        if (!firebaseAdmin) {
            throw new Error('Firebase Admin SDK not initialized');
        }
        // Log which project we're using
        const projectId = firebaseAdmin.options.projectId || 'unknown';
        console.log('🔍 Verifying token with Firebase project:', projectId);
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
        console.log('✅ Token verified successfully for user:', decodedToken.uid);
        return decodedToken;
    }
    catch (error) {
        // Log more details about the error
        const projectId = firebaseAdmin?.options.projectId || 'unknown';
        console.error('❌ Firebase token verification error:', {
            projectId: projectId,
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : 'Unknown',
            tokenPrefix: idToken.substring(0, 50) + '...'
        });
        if (error instanceof Error) {
            // Check for specific Firebase errors
            if (error.message.includes('expired')) {
                console.error('❌ Token is expired');
            }
            else if (error.message.includes('invalid')) {
                console.error('❌ Token is invalid - may be from different Firebase project');
            }
            else if (error.message.includes('project')) {
                console.error('❌ Project mismatch - token may be from different Firebase project');
            }
        }
        throw new Error(`Invalid or expired token: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=firebase-admin.js.map