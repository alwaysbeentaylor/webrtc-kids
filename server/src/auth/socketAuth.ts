import { Socket } from 'socket.io';
import { verifyIdToken } from '../config/firebase-admin';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: 'parent' | 'child';
  email?: string;
}

export async function authenticateSocket(socket: AuthenticatedSocket): Promise<boolean> {
  try {
    // Get token from anywhere possible
    let token: string | undefined = undefined;
    
    // Try EVERY possible location
    const auth = socket.handshake.auth;
    const query = socket.handshake.query;
    const headers = socket.handshake.headers;
    
    // 1. auth.token (object)
    if (auth && typeof auth === 'object' && 'token' in auth) {
      token = (auth as any).token;
    }
    
    // 2. auth as string
    if (!token && typeof auth === 'string') {
      token = auth;
    }
    
    // 3. query.token
    if (!token && query && 'token' in query) {
      const qToken = query.token;
      token = Array.isArray(qToken) ? qToken[0] : String(qToken);
    }
    
    // 4. Authorization header
    if (!token && headers && headers.authorization) {
      const authHeader = String(headers.authorization);
      token = authHeader.replace(/^Bearer\s+/i, '').trim();
    }
    
    // LOG EVERYTHING
    console.log('🔐🔐🔐 AUTH DEBUG:', {
      socketId: socket.id,
      hasToken: !!token,
      token: token || 'MISSING',
      authObject: auth,
      authType: typeof auth,
      query: query,
      headersAuth: headers?.authorization || 'none'
    });
    
    // CRITICAL: Accept child tokens IMMEDIATELY
    if (token && typeof token === 'string' && token.startsWith('child-token-')) {
      const userId = token.replace('child-token-', '').trim();
      if (userId && userId.length > 0) {
        socket.userId = userId;
        socket.userRole = 'child';
        console.log('✅✅✅✅✅✅✅ CHILD AUTHENTICATED:', socket.id, 'User:', userId);
        return true;
      }
    }
    
    if (!token) {
      console.error('❌❌❌ NO TOKEN FOUND AT ALL');
      return false;
    }

    // For parents, verify with Firebase
    try {
      const decodedToken = await verifyIdToken(token);
      socket.userId = decodedToken.uid;
      if (decodedToken.email) {
        socket.email = decodedToken.email;
      }
      socket.userRole = decodedToken.email_verified ? 'parent' : 'child';
      console.log('✅ PARENT AUTHENTICATED:', socket.id, 'User:', socket.userId);
      return true;
    } catch (verifyError) {
      // Development fallback for unverified tokens
      if (process.env.NODE_ENV !== 'production') {
        try {
          const parts = token.split('.');
          if (parts.length === 3 && parts[1]) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            socket.userId = payload.user_id || payload.sub || 'dev-user';
            socket.email = payload.email || undefined;
            socket.userRole = payload.email_verified ? 'parent' : 'child';
            console.log('⚠️  DEV FALLBACK: User:', socket.userId);
            return true;
          }
        } catch (e) {
          // Ignore
        }
      }
      console.error('❌ Firebase verification failed:', verifyError);
      return false;
    }
  } catch (error) {
    console.error('❌ AUTH EXCEPTION:', error);
    return false;
  }
}
