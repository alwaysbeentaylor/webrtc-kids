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
let firebaseAdmin;
try {
    // Try to initialize with existing app
    firebaseAdmin = admin.app();
}
catch (error) {
    // Initialize new app
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
        // Use service account file if provided
        const serviceAccount = require(serviceAccountPath);
        firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    else if (projectId && projectId !== 'your-project-id') {
        // Initialize with project ID (will use Application Default Credentials)
        firebaseAdmin = admin.initializeApp({
            projectId: projectId
        });
    }
    else {
        // Fallback: initialize without project (will use default credentials)
        // This might fail in some environments, but will work if ADC is configured
        try {
            firebaseAdmin = admin.initializeApp();
        }
        catch (initError) {
            console.warn('Firebase Admin initialization warning:', initError);
            // For development, we can still continue - token verification will fail gracefully
            firebaseAdmin = admin.initializeApp({
                projectId: 'demo-project'
            });
        }
    }
}
exports.default = firebaseAdmin;
// Helper to verify Firebase ID token
async function verifyIdToken(idToken) {
    try {
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
        return decodedToken;
    }
    catch (error) {
        throw new Error('Invalid or expired token');
    }
}
//# sourceMappingURL=firebase-admin.js.map