"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateSocket = authenticateSocket;
const firebase_admin_1 = require("../config/firebase-admin");
async function authenticateSocket(socket) {
    try {
        // Get token from handshake auth
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
            console.log('No token provided for socket:', socket.id);
            return false;
        }
        // Try to verify token with Firebase Admin
        try {
            const decodedToken = await (0, firebase_admin_1.verifyIdToken)(token);
            // Attach user info to socket
            socket.userId = decodedToken.uid;
            if (decodedToken.email) {
                socket.email = decodedToken.email;
            }
            socket.userRole = decodedToken.email_verified ? 'parent' : 'child';
            console.log('Authenticated socket:', socket.id, 'User:', socket.userId, socket.email);
            return true;
        }
        catch (verifyError) {
            console.error('Token verification failed:', verifyError);
            // Development mode fallback: allow connection with unverified token
            // This allows testing without proper Firebase Admin setup
            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️  Development mode: Allowing connection without full token verification');
                try {
                    // Try to extract user info from JWT payload (without verification)
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                        socket.userId = payload.user_id || payload.sub || 'dev-user';
                        socket.email = payload.email || undefined;
                        socket.userRole = payload.email_verified ? 'parent' : 'child';
                        console.log('⚠️  Development mode: Using unverified token data for user:', socket.userId);
                        return true;
                    }
                }
                catch (e) {
                    console.error('Could not parse token:', e);
                }
            }
            return false;
        }
    }
    catch (error) {
        console.error('Authentication failed for socket:', socket.id, error);
        return false;
    }
}
//# sourceMappingURL=socketAuth.js.map