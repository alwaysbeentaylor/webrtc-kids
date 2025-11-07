import { io, Socket } from 'socket.io-client';

export type SocketEvents = {
  connect: () => void;
  disconnect: (reason: string) => void;
  pong: (data: { at: number; userId?: string }) => void;
  'call:offer': (data: { fromUserId: string; offer: RTCSessionDescriptionInit; targetUserId: string }) => void;
  'call:answer': (data: { fromUserId: string; answer: RTCSessionDescriptionInit; targetUserId: string }) => void;
  'call:answered': (data: { fromUserId: string; targetUserId: string }) => void; // New: call was answered
  'call:ice-candidate': (data: { fromUserId: string; candidate: RTCIceCandidateInit; targetUserId: string }) => void;
  'call:end': (data: { fromUserId: string }) => void; // Legacy - kept for backward compatibility
  'call:cancel': (data: { fromUserId: string }) => void; // New: cancel before answer
  'call:hangup': (data: { fromUserId: string }) => void; // New: hangup after answer
  'room:joined': (data: { room: string; userId: string }) => void;
  error: (data: { message: string; code?: string }) => void;
};

type TokenGetter = () => Promise<string | null>;

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private serverUrl: string = '';
  private tokenGetter: TokenGetter | null = null;
  private maxReconnectAttempts = 5;

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
        
        console.log(`✅ Socket connected successfully on attempt ${attempt}`);
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

    console.log('🔐🔐🔐 Establishing socket connection with token:', {
      tokenPrefix: token.substring(0, 30) + '...',
      isChildToken: token.startsWith('child-token-'),
      tokenLength: token.length
    });

    // FORCE token to be sent in multiple ways
    const connectionOptions: any = {
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      auth: {
        token: token
      },
      query: {
        token: token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      forceNew: true // Force new connection
    };
    
    console.log('🔐🔐🔐 Connecting with options:', {
      serverUrl: this.serverUrl,
      tokenPrefix: token.substring(0, 30),
      isChildToken: token.startsWith('child-token-')
    });
    
    this.socket = io(this.serverUrl, connectionOptions);

    // Add connection event listeners IMMEDIATELY after creating socket
    this.socket.on('connect', () => {
      console.log('✅✅✅✅✅ Socket.IO CONNECTED!', {
        socketId: this.socket?.id,
        connected: this.socket?.connected,
        serverUrl: this.serverUrl
      });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌❌❌ Socket connection error:', error);
      const anyError: any = error as any;
      console.error('❌ Error details:', {
        message: (error as Error).message,
        type: anyError?.type,
        description: anyError?.description,
        serverUrl: this.serverUrl,
        tokenPrefix: token.substring(0, 30)
      });
      
      // Show user-friendly error
      if (error.message.includes('xhr poll error') || error.message.includes('websocket error')) {
        console.error('❌ Backend server is not reachable. Check if backend is running and VITE_BACKEND_URL is correct.');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
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
  async joinUserRoom(): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Cannot join user room - socket not connected');
    }
    
    const socket = this.socket; // Store reference to avoid null checks
    if (!socket) {
      throw new Error('Socket is null');
    }
    
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
