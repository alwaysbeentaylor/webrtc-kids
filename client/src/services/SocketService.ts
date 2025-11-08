import { io, Socket } from 'socket.io-client';

export type SocketEvents = {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  pong: (data: { at: number; userId?: string }) => void;
  'call:offer': (data: { fromUserId: string; offer: RTCSessionDescriptionInit; targetUserId: string }) => void;
  'call:answer': (data: { fromUserId: string; answer: RTCSessionDescriptionInit; targetUserId: string }) => void;
  'call:answered': (data: { fromUserId: string; targetUserId: string }) => void; // New: call was answered
  'call:ice-candidate': (data: { fromUserId: string; candidate: RTCIceCandidateInit; targetUserId: string }) => void;
  'call:end': (data: { fromUserId: string }) => void; // Legacy - kept for backward compatibility
  'call:cancel': (data: { fromUserId: string }) => void; // New: cancel before answer
  'call:hangup': (data: { fromUserId: string }) => void; // New: hangup after answer
  'room:joined': (data: { room: string; userId: string }) => void;
  'auth:ok': (data: { userId: string; role: 'parent' | 'child' }) => void;
  'auth:error': (data: { message: string }) => void;
  error: (data: { message: string; code?: string }) => void;
};

type TokenGetter = () => Promise<string | null>;

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private serverUrl: string = '';
  private tokenGetter: TokenGetter | null = null;
  private maxReconnectAttempts = 5;
  private currentToken: string | null = null; // Store token for auth:join

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  async connect(serverUrl: string, tokenGetter: TokenGetter): Promise<void> {
    if (this.socket?.connected) return;
    
    this.serverUrl = serverUrl;
    this.tokenGetter = tokenGetter;

    // Retry connection up to 3 times
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 Socket connection attempt ${attempt}/3...`);
        await this.establishConnection();
        
        // Wait for connection to be established (with timeout)
        await new Promise<void>((resolve, reject) => {
          if (!this.socket) {
            reject(new Error('Socket not created'));
            return;
          }
          
          const timeout = setTimeout(() => {
            reject(new Error(`Connection timeout after ${attempt === 1 ? 5 : 3} seconds`));
          }, attempt === 1 ? 5000 : 3000);
          
          const onConnect = () => {
            clearTimeout(timeout);
            this.socket?.off('connect', onConnect);
            this.socket?.off('connect_error', onError);
            resolve();
          };
          
          const onError = (error: Error) => {
            clearTimeout(timeout);
            this.socket?.off('connect', onConnect);
            this.socket?.off('connect_error', onError);
            reject(error);
          };
          
          if (this.socket.connected) {
            clearTimeout(timeout);
            resolve();
          } else {
            this.socket.once('connect', onConnect);
            this.socket.once('connect_error', onError);
          }
        });
        
        // Wait for auth:ok after connection
        await new Promise<void>((resolve, reject) => {
          if (!this.socket) {
            reject(new Error('Socket not created'));
            return;
          }
          
          const authTimeout = setTimeout(() => {
            this.socket?.off('auth:ok', onAuthOk);
            this.socket?.off('auth:error', onAuthError);
            reject(new Error('Authentication timeout - no auth:ok received'));
          }, 5000);
          
          const onAuthOk = (data: { userId: string; role: 'parent' | 'child' }) => {
            clearTimeout(authTimeout);
            this.socket?.off('auth:ok', onAuthOk);
            this.socket?.off('auth:error', onAuthError);
            console.log('✅✅✅ Auth OK received:', data);
            resolve();
          };
          
          const onAuthError = (data: { message: string }) => {
            clearTimeout(authTimeout);
            this.socket?.off('auth:ok', onAuthOk);
            this.socket?.off('auth:error', onAuthError);
            reject(new Error(`Authentication failed: ${data.message}`));
          };
          
          // Check if already authenticated (shouldn't happen, but just in case)
          this.socket.once('auth:ok', onAuthOk);
          this.socket.once('auth:error', onAuthError);
        });
        
        console.log(`✅ Socket connected and authenticated successfully on attempt ${attempt}`);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Socket connection attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < 3) {
          // Wait before retry (exponential backoff)
          const delay = attempt * 1000; // 1s, 2s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Cleanup failed socket before retry
          if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
          }
        }
      }
    }
    
    // All retries failed
    throw new Error(`Socket connection failed after 3 attempts: ${lastError?.message || 'Unknown error'}`);
  }

  private async establishConnection(): Promise<void> {
    if (!this.tokenGetter) {
      throw new Error('Token getter not provided');
    }

    const token = await this.tokenGetter();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Store token for auth:join event
    this.currentToken = token;

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    console.log('🔐🔐🔐 Establishing socket connection with token:', {
      tokenPrefix: token.substring(0, 30) + '...',
      isChildToken: token.startsWith('child-token-'),
      tokenLength: token.length,
      isMobile,
      isIOS,
      isAndroid,
      userAgent: navigator.userAgent
    });

    // On mobile devices, prefer polling first (more reliable on mobile networks)
    // On desktop, prefer websocket first (faster)
    const transports = isMobile ? ['polling', 'websocket'] : ['websocket', 'polling'];

    // FORCE token to be sent in multiple ways
    const connectionOptions: any = {
      transports: transports, // Mobile: polling first, Desktop: websocket first
      upgrade: true, // Allow upgrade from polling to websocket
      rememberUpgrade: false, // Don't remember upgrade preference (try both each time)
      auth: {
        token: token
      },
      query: {
        token: token
      },
      reconnection: true,
      reconnectionDelay: isMobile ? 2000 : 1000, // Longer delay on mobile
      reconnectionDelayMax: isMobile ? 10000 : 5000, // Longer max delay on mobile
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: isMobile ? 20000 : 10000, // Longer timeout on mobile (20s vs 10s)
      forceNew: true // Force new connection
    };
    
    console.log('🔐🔐🔐 Connecting with options:', {
      serverUrl: this.serverUrl,
      tokenPrefix: token.substring(0, 30),
      isChildToken: token.startsWith('child-token-'),
      transports: transports,
      timeout: connectionOptions.timeout,
      isMobile
    });
    
    this.socket = io(this.serverUrl, connectionOptions);

    // DEBUG: log every incoming socket event to verify signaling flow
    this.socket.onAny((event, ...args) => {
      try {
        console.log('📨📨📨 Socket event received:', event, {
          arg0Keys: args && args[0] ? Object.keys(args[0]) : [],
          data: args[0]
        });
      } catch (err) {
        console.log('📨📨📨 Socket event (unable to serialize):', event);
      }
    });

    // Add connection event listeners IMMEDIATELY after creating socket
    this.socket.on('connect', async () => {
      console.log('✅✅✅✅✅ Socket.IO CONNECTED!', {
        socketId: this.socket?.id,
        connected: this.socket?.connected,
        serverUrl: this.serverUrl,
        transport: this.socket?.io?.engine?.transport?.name || 'unknown',
        isMobile
      });
      
      // Wait a tiny bit to ensure server has registered auth:join listener
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Immediately send auth:join event with token
      if (this.socket && this.currentToken) {
        console.log('🔐🔐🔐 Sending auth:join event with token...');
        this.socket.emit('auth:join', { token: this.currentToken });
      } else {
        console.error('❌❌❌ Cannot send auth:join - socket or token missing:', {
          hasSocket: !!this.socket,
          hasToken: !!this.currentToken
        });
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌❌❌ Socket connection error:', error);
      const anyError: any = error as any;
      console.error('❌ Error details:', {
        message: (error as Error).message,
        type: anyError?.type,
        description: anyError?.description,
        serverUrl: this.serverUrl,
        tokenPrefix: token.substring(0, 30),
        isMobile,
        userAgent: navigator.userAgent
      });
      
      // Show user-friendly error
      if (error.message.includes('xhr poll error') || error.message.includes('websocket error')) {
        console.error('❌ Backend server is not reachable. Check if backend is running and VITE_BACKEND_URL is correct.');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason, {
        isMobile,
        transport: this.socket?.io?.engine?.transport?.name || 'unknown'
      });
    });

    // Log transport upgrades
    this.socket.io?.engine?.on('upgrade', () => {
      console.log('⬆️ Transport upgraded to:', this.socket?.io?.engine?.transport?.name);
    });
  }

  // Note: reconnection/backoff handled by Socket.IO options

  disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  on<T extends keyof SocketEvents>(event: T, handler: SocketEvents[T]): void {
    console.log('🔧🔧🔧 SocketService.on() called for event:', event, 'socket exists:', !!this.socket, 'socket connected:', this.socket?.connected);
    
    if (!this.socket) {
      console.warn('⚠️⚠️⚠️ SocketService.on() called but socket is null! Event:', event);
      // Store handler to attach later when socket connects
      // This is a workaround - ideally we should wait for socket to connect
      setTimeout(() => {
        if (this.socket) {
          console.log('✅ Attaching listener after socket created:', event);
          (this.socket.on as any)(event, handler);
          // If socket is already connected and this is a connect event, call handler immediately
          if (event === 'connect' && this.socket.connected) {
            console.log('✅ Socket already connected, calling connect handler immediately');
            (handler as () => void)();
          }
        }
      }, 100);
      return;
    }
    
    (this.socket.on as any)(event, handler);
    
    // If socket is already connected and this is a connect event, call handler immediately
    if (event === 'connect' && this.socket.connected) {
      console.log('✅ Socket already connected, calling connect handler immediately');
      (handler as () => void)();
    }
  }

  off<T extends keyof SocketEvents>(event: T, handler?: SocketEvents[T]): void {
    if (!this.socket) return;
    if (handler) {
      this.socket.off(event, handler as any);
    } else {
      this.socket.removeAllListeners(event);
    }
  }

  emit(event: string, payload?: unknown): void {
    this.socket?.emit(event, payload);
  }

  // Join user room for targeted messaging - returns promise that resolves when ACK received
  // Note: Room is already joined after auth:ok, but we can still call this for confirmation
  async joinUserRoom(): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Cannot join user room - socket not connected');
    }
    
    const socket = this.socket; // Store reference to avoid null checks
    if (!socket) {
      throw new Error('Socket is null');
    }
    
    // Check if we already received room:joined (from auth:ok)
    // If so, resolve immediately
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('room:joined', onRoomJoined);
        reject(new Error('Room join timeout - no ACK received'));
      }, 5000); // 5 second timeout
      
      const onRoomJoined = (data: { room: string; userId: string }) => {
        clearTimeout(timeout);
        socket.off('room:joined', onRoomJoined);
        console.log('✅✅✅ Room join ACK received:', data);
        resolve();
      };
      
      console.log('🏠🏠🏠 Joining user room...');
      socket.once('room:joined', onRoomJoined);
      socket.emit('join:user-room');
    });
  }

  // WebRTC signaling methods
  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    console.log('📞📞📞📞📞 Sending call:offer:', {
      targetUserId,
      hasOffer: !!offer,
      offerType: offer.type,
      socketConnected: this.socket?.connected
    });
    this.emit('call:offer', { targetUserId, offer });
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    this.emit('call:answer', { targetUserId, answer });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidateInit): void {
    this.emit('call:ice-candidate', { targetUserId, candidate });
  }

  // Send cancel signal (before answer)
  sendCallCancel(targetUserId: string): void {
    console.log('📞 Sending call:cancel to:', targetUserId);
    this.emit('call:cancel', { targetUserId });
  }

  // Send hangup signal (after answer)
  sendCallHangup(targetUserId: string): void {
    console.log('📞 Sending call:hangup to:', targetUserId);
    this.emit('call:hangup', { targetUserId });
  }

  // Legacy method - kept for backward compatibility
  // Will send cancel if call is pre-answer, hangup if post-answer
  sendCallEnd(targetUserId: string): void {
    console.log('📞 Sending call:end (legacy) to:', targetUserId);
    this.emit('call:end', { targetUserId });
  }
}

export const socketService = SocketService.getInstance();
