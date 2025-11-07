import { socketService } from './SocketService';

export type CallState = 'idle' | 'dialing' | 'ringing' | 'active' | 'ended' | 'failed';
export type CallDirection = 'outgoing' | 'incoming';
export type UserRole = 'parent' | 'child';

export interface CallPermissions {
  canEndCall: boolean;
  canCancelCall: boolean;
  reason?: string; // Optional reason why action is not allowed
}

export interface CallInfo {
  callId: string;
  targetUserId: string;
  state: CallState;
  direction: CallDirection;
  localRole?: UserRole;
  remoteRole?: UserRole;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

class WebRTCService {
  private static instance: WebRTCService | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCall: CallInfo | null = null;
  private callStateListeners: Set<(state: CallState) => void> = new Set();
  private permissionsListeners: Set<(permissions: CallPermissions) => void> = new Set();
  private callTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingOffer: { fromUserId: string; offer: RTCSessionDescriptionInit } | null = null;

  // STUN/TURN servers - TURN servers zijn essentieel voor Android NAT traversal
  // Android heeft vaak restrictievere NAT/firewall settings dan iOS
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Additional STUN servers
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipbuster.com' },
      // Free TURN servers - Multiple options for reliability
      // OpenRelay (free, no auth required for basic usage)
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:80?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Additional TURN servers for Android reliability
      {
        urls: 'turn:relay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:relay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:relay.metered.ca:80?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:relay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10, // Pre-gather more candidates for faster connection
    iceTransportPolicy: 'all' // Use both relay and non-relay candidates (important for Android)
  };

  private constructor() {
    // Don't setup listeners immediately - wait for socket to be ready
    // This will be called when socket connects
  }

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  // Call this after socket is connected to ensure listeners are attached
  initializeListeners(): void {
    console.log('🔧🔧🔧 WebRTCService: Initializing listeners NOW...');
    console.log('🔧 Socket connected:', socketService.isConnected());
    this.setupSocketListeners();
    console.log('✅✅✅ WebRTCService listeners initialized successfully');
  }

  private setupSocketListeners(): void {
    console.log('🔧🔧🔧 WebRTCService: Setting up socket listeners...');
    
    // Listen for incoming call offers (do NOT auto-answer)
    // We store the offer and switch to 'ringing' so the UI can present Accept/Decline
    socketService.on('call:offer', async (data: { fromUserId: string; offer: RTCSessionDescriptionInit; targetUserId: string }) => {
      console.log('📞📞📞📞📞📞📞📞📞 WebRTCService received call:offer event:', {
        fromUserId: data.fromUserId,
        targetUserId: data.targetUserId,
        hasOffer: !!data.offer,
        offerType: data.offer?.type,
        offerSdp: data.offer?.sdp ? data.offer.sdp.substring(0, 50) + '...' : 'none',
        currentCall: this.currentCall ? 'EXISTS' : 'NONE',
        hasPeerConnection: !!this.peerConnection
      });
      
      // Only handle if we're not already in a call
      if (this.currentCall) {
        console.warn('⚠️  Already in a call, ignoring incoming offer. Current call:', this.currentCall);
        return;
      }

      // Hold the offer until the user accepts
      this.pendingOffer = { fromUserId: data.fromUserId, offer: data.offer };

      // Set call to ringing state
      this.currentCall = {
        callId: `call-${Date.now()}`,
        targetUserId: data.fromUserId,
        state: 'ringing',
        direction: 'incoming'
      };
      this.notifyCallStateChange('ringing');
    });

    // Listen for call answers
    socketService.on('call:answer', async (data: { fromUserId: string; answer: RTCSessionDescriptionInit; targetUserId: string }) => {
      console.log('📞📞📞📞📞 WebRTCService received call:answer event:', {
        fromUserId: data.fromUserId,
        targetUserId: data.targetUserId,
        hasAnswer: !!data.answer,
        answerType: data.answer?.type
      });
      await this.handleAnswer(data.answer);
    });

    // Listen for ICE candidates
    socketService.on('call:ice-candidate', async (data: { fromUserId: string; candidate: RTCIceCandidateInit; targetUserId: string }) => {
      await this.handleIceCandidate(data.candidate);
    });

    // Listen for call end (legacy and new signals)
    socketService.on('call:end', (_data: { fromUserId: string }) => {
      // Normal call end - set to ended, not failed
      if (this.currentCall && this.currentCall.state !== 'failed') {
        this.updateCallState('ended');
      }
      this.cleanup();
    });
    socketService.on('call:cancel', (data: { fromUserId: string }) => {
      // Call was cancelled before answer
      console.log('📞 Call cancelled by:', data.fromUserId);
      // Dispatch event to show notification
      const cancelEvent = new CustomEvent('call:cancelled', {
        detail: { fromUserId: data.fromUserId }
      });
      window.dispatchEvent(cancelEvent);
      // Set to ended, not failed (normal cancellation)
      if (this.currentCall && this.currentCall.state !== 'failed') {
        this.updateCallState('ended');
      }
      this.cleanup();
    });
    socketService.on('call:hangup', (_data: { fromUserId: string }) => {
      // Call was hung up after answer - normal end
      // Update state immediately for faster feedback
      if (this.currentCall && this.currentCall.state !== 'failed') {
        this.updateCallState('ended');
      }
      // Cleanup immediately
      this.cleanup();
    });
    // Listen for socket errors (including permission denied)
    socketService.on('error', (data: { message: string; code?: string }) => {
      if (data.code === 'ERR_POLICY_CHILD_CANNOT_HANGUP_PARENT_ACTIVE') {
        console.warn('❌ Permission denied:', data.message);
        const errorEvent = new CustomEvent('call:permission-denied', {
          detail: { reason: 'Je kunt deze call niet beëindigen. Vraag de ouder om te beëindigen.' }
        });
        window.dispatchEvent(errorEvent);
      } else {
        console.error('Socket error:', data.message);
      }
    });
  }

  // Public: accept/decline for incoming calls
  async acceptCall(localRole?: UserRole, remoteRole?: UserRole): Promise<void> {
    if (!this.pendingOffer) {
      console.warn('No pending offer to accept');
      // Check if call is already being processed
      if (this.currentCall && this.currentCall.direction === 'incoming' && this.currentCall.state === 'ringing') {
        console.log('⚠️  Call already in ringing state, checking if peer connection exists');
        if (this.peerConnection && this.peerConnection.localDescription) {
          console.log('✅ Peer connection already has local description, call should be active');
          // Call is already being processed, just update roles
          this.setCallRoles(localRole || 'child', remoteRole || 'child');
          return;
        }
      }
      return;
    }
    const { fromUserId, offer } = this.pendingOffer;
    this.pendingOffer = null;
    try {
      await this.handleIncomingOffer(fromUserId, offer, localRole, remoteRole);
    } catch (e) {
      console.error('Error accepting call:', e);
      this.updateCallState('failed');
      throw e; // Re-throw so UI can handle it
    }
  }

  // Set roles for current call (useful when roles are determined after call starts)
  setCallRoles(localRole: UserRole, remoteRole: UserRole): void {
    if (this.currentCall) {
      this.currentCall.localRole = localRole;
      this.currentCall.remoteRole = remoteRole;
      this.notifyPermissionsChange();
    }
  }

  declineCall(): void {
    if (!this.pendingOffer) {
      console.warn('No pending offer to decline');
      return;
    }
    const { fromUserId } = this.pendingOffer;
    this.pendingOffer = null;
    try {
      // Send cancel signal when declining
      socketService.sendCallCancel(fromUserId);
    } finally {
      this.cleanup();
    }
  }

  // Subscribe to call state changes
  subscribe(callback: (state: CallState) => void): () => void {
    this.callStateListeners.add(callback);
    if (this.currentCall) {
      callback(this.currentCall.state);
    }
    return () => {
      this.callStateListeners.delete(callback);
    };
  }

  private notifyCallStateChange(state: CallState): void {
    this.callStateListeners.forEach(callback => callback(state));
  }

  // Get user media (camera + microphone)
  async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) {
      // Check if stream is still active
      const activeTracks = this.localStream.getTracks().filter(t => t.readyState === 'live');
      if (activeTracks.length > 0) {
        console.log('✅ Reusing existing local stream');
        return this.localStream;
      } else {
        console.warn('⚠️  Existing stream is inactive, creating new one');
        // Clean up old stream
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
    }

    try {
      console.log('🎥 Requesting camera/microphone access...');
      
      // First check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera/microfoon wordt niet ondersteund in deze browser');
      }

      // Request permissions with better error handling
      // Try video + audio first, fallback to audio only if video fails
      // Android-optimized constraints
      const isAndroid = /Android/i.test(navigator.userAgent);
      const videoConstraints = isAndroid ? {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        facingMode: 'user', // Front camera
        frameRate: { ideal: 30, max: 30 } // Lower frame rate for Android
      } : {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      };

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000 // Better quality for Android
          }
        });
      } catch (videoError) {
        console.warn('⚠️  Video access failed, trying audio only...', videoError);
        // Fallback to audio only
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        });
        console.log('✅ Audio-only stream created (no video)');
      }
      
      console.log('✅✅✅ Camera/microphone access granted!', {
        tracks: this.localStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled }))
      });
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Microfoon/camera toegang geweigerd. Tik op het slotje 🔒 in de adresbalk en geef toegang tot microfoon en camera.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new Error('Geen camera/microfoon gevonden. Controleer of je apparaat een camera/microfoon heeft.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          throw new Error('Camera/microfoon wordt al gebruikt door een andere app. Sluit andere apps en probeer opnieuw.');
        } else {
          throw new Error(`Kan camera/microfoon niet openen: ${error.message}`);
        }
      }
      
      throw new Error('Kan camera/microfoon niet openen. Controleer je browser permissies.');
    }
  }

  // Start an outgoing call with role information
  async startCall(targetUserId: string, localRole?: UserRole, remoteRole?: UserRole): Promise<void> {
    if (this.currentCall) {
      throw new Error('Er is al een actieve call');
    }

    // Cleanup any existing peer connection first
    if (this.peerConnection) {
      console.warn('⚠️  Cleaning up existing peer connection before starting new call');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    try {
      // Get local media stream (try audio only if video fails)
      let stream: MediaStream;
      try {
        stream = await this.getLocalStream();
      } catch (mediaError) {
        console.error('❌ Failed to get local stream for outgoing call:', mediaError);
        // Try audio only as fallback
        try {
          console.log('🔄 Trying audio-only stream for outgoing call...');
          const isAndroid = /Android/i.test(navigator.userAgent);
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: isAndroid ? 48000 : undefined
            }
          });
          console.log('✅ Audio-only stream created for outgoing call');
        } catch (audioError) {
          console.error('❌ Failed to get audio-only stream:', audioError);
          if (audioError instanceof Error) {
            if (audioError.name === 'NotAllowedError' || audioError.name === 'PermissionDeniedError') {
              throw new Error('Microfoon toegang geweigerd. Tik op het slotje 🔒 in de adresbalk en geef toegang tot microfoon.');
            } else {
              throw new Error(`Kan geen audio/microfoon openen: ${audioError.message}`);
            }
          }
          throw new Error('Kan geen audio/microfoon openen. Controleer je browser permissies.');
        }
      }
      
      // Create fresh peer connection
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, stream);
      });

      // Handle ICE candidates with Android-specific logging
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateType = event.candidate.type;
          const candidateProtocol = event.candidate.protocol;
          const isRelay = event.candidate.candidate.includes('relay') || event.candidate.candidate.includes('turn');
          const isAndroid = /Android/i.test(navigator.userAgent);
          
          console.log('🧊 ICE candidate generated:', {
            type: candidateType,
            protocol: candidateProtocol,
            isRelay: isRelay,
            candidate: event.candidate.candidate.substring(0, 100),
            platform: isAndroid ? 'Android' : 'Other'
          });
          
          // Log specifically for Android if using relay (TURN)
          if (isAndroid && isRelay) {
            console.log('✅✅✅ Android using TURN server (relay) - this is good for NAT traversal!');
          }
          
          socketService.sendIceCandidate(targetUserId, event.candidate.toJSON());
        } else {
          console.log('✅ All ICE candidates gathered');
        }
      };
      
      // Log ICE connection state with Android-specific handling
      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection) {
          const isAndroid = /Android/i.test(navigator.userAgent);
          const state = this.peerConnection.iceConnectionState;
          
          console.log('🧊 ICE connection state:', state, isAndroid ? '(Android)' : '');
          
          if (state === 'connected' || state === 'completed') {
            console.log('✅✅✅ ICE connection established!', isAndroid ? '(Android)' : '');
            // Clear timeout once connected
            if (this.callTimeout) {
              clearTimeout(this.callTimeout);
              this.callTimeout = null;
            }
          } else if (state === 'failed') {
            console.error('❌ ICE connection failed', isAndroid ? '(Android - TURN servers may be needed)' : '');
            
            // For Android, try more aggressive restart
            if (isAndroid) {
              console.log('🔄 Android: Attempting ICE restart with more TURN servers...');
              // Try to restart ICE gathering
              if (this.peerConnection.restartIce) {
                this.peerConnection.restartIce();
                console.log('🔄 Restarting ICE gathering on Android...');
              }
              
              // Give Android more time before failing
              setTimeout(() => {
                if (this.peerConnection && this.peerConnection.iceConnectionState === 'failed') {
                  console.error('❌ Android ICE connection still failed after retry');
                  console.error('💡 Tip: Check if TURN servers are accessible from Android device');
                  this.updateCallState('failed');
                }
              }, 10000); // 10 seconds for Android
            } else {
              // Non-Android: shorter timeout
              setTimeout(() => {
                if (this.peerConnection && this.peerConnection.iceConnectionState === 'failed') {
                  console.error('❌ ICE connection still failed after retry');
                  this.updateCallState('failed');
                }
              }, 5000);
            }
          } else if (state === 'disconnected') {
            console.warn('⚠️ ICE connection disconnected', isAndroid ? '(Android - may reconnect)' : '');
            // Give it more time to reconnect on Android
            const timeout = isAndroid ? 15000 : 10000;
            setTimeout(() => {
              if (this.peerConnection && this.peerConnection.iceConnectionState === 'disconnected') {
                console.error('❌ ICE connection failed to reconnect', isAndroid ? '(Android)' : '');
                this.updateCallState('failed');
              }
            }, timeout);
          } else if (state === 'checking') {
            console.log('🔍 ICE connection checking...', isAndroid ? '(Android - gathering candidates)' : '');
          }
        }
      };

      // Handle remote stream - CRITICAL: This fires when remote media arrives
      this.peerConnection.ontrack = (event) => {
        console.log('📹📹📹 REMOTE STREAM RECEIVED in startCall!', {
          streams: event.streams.length,
          tracks: event.streams[0]?.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })),
          streamId: event.streams[0]?.id
        });
        
        if (event.streams && event.streams.length > 0) {
          this.remoteStream = event.streams[0];
          if (this.currentCall) {
            this.currentCall.remoteStream = event.streams[0];
          }
          // Transition to active when remote stream is received (call is answered)
          console.log('✅✅✅ Updating call state to ACTIVE - remote stream received!');
          this.updateCallState('active');
        } else {
          console.warn('⚠️  ontrack event but no streams in event');
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          console.log('Connection state:', this.peerConnection.connectionState);
          if (this.peerConnection.connectionState === 'failed') {
            // Only mark as failed for actual failures, not disconnects
            this.updateCallState('failed');
          } else if (this.peerConnection.connectionState === 'disconnected' || 
                     this.peerConnection.connectionState === 'closed') {
            // Normal disconnect/close - set to ended if not already failed
            if (this.currentCall && this.currentCall.state !== 'failed') {
              this.updateCallState('ended');
            }
          } else if (this.peerConnection.connectionState === 'connected' && this.currentCall) {
            // Only update to active if we have remote stream (call is answered)
            // Otherwise keep current state (dialing/ringing)
            if (this.remoteStream) {
              this.updateCallState('active');
            }
          }
        }
      };

      // Create call info first (before creating offer)
      this.currentCall = {
        callId: `call-${Date.now()}`,
        targetUserId,
        state: 'dialing',
        direction: 'outgoing',
        localRole,
        remoteRole,
        localStream: stream.getTracks().length > 0 ? stream : undefined
      };
      this.notifyCallStateChange('dialing');
      this.notifyPermissionsChange();

      // Create offer
      const offer = await this.peerConnection.createOffer();
      
      // Check if local description is already set (shouldn't be, but safety check)
      if (this.peerConnection.localDescription) {
        console.warn('⚠️  Local description already set, skipping setLocalDescription');
      } else {
        await this.peerConnection.setLocalDescription(offer);
      }

      // Send offer through signaling server (after local description is set)
      socketService.sendOffer(targetUserId, offer);

      console.log('📞 Call started to:', targetUserId);

      // Set timeout for call - if no answer in 60 seconds, fail (increased from 30s)
      this.callTimeout = setTimeout(() => {
        if (this.currentCall && (this.currentCall.state === 'dialing' || this.currentCall.state === 'ringing')) {
          console.warn('⏱️ Call timeout - no answer received after 60 seconds');
          this.updateCallState('failed');
        }
      }, 60000); // Increased to 60 seconds
    } catch (error) {
      console.error('Error starting call:', error);
      this.cleanup();
      throw error;
    }
  }

  // Handle incoming call offer
  private async handleIncomingOffer(fromUserId: string, offer: RTCSessionDescriptionInit, localRole?: UserRole, remoteRole?: UserRole): Promise<void> {
    if (this.currentCall) {
      // If we are in incoming ringing for the same caller, we ARE allowed to proceed
      const sameIncomingRinging =
        this.currentCall.direction === 'incoming' &&
        this.currentCall.state === 'ringing' &&
        this.currentCall.targetUserId === fromUserId;
      if (!sameIncomingRinging) {
        console.log('⚠️  Already in a different call, ignoring incoming offer');
        return;
      }
    }

    // Cleanup any existing peer connection first
    if (this.peerConnection) {
      console.warn('⚠️  Cleaning up existing peer connection before handling incoming offer');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    console.log('📞📞📞 Incoming call from:', fromUserId);
    console.log('📞 Offer type:', offer.type);

    try {
      // Get local media stream (try audio only if video fails)
      console.log('🎥 Requesting local stream for incoming call...');
      let stream: MediaStream;
      try {
        stream = await this.getLocalStream();
      } catch (mediaError) {
        console.error('❌ Failed to get local stream:', mediaError);
        // Try audio only as last resort
        try {
          console.log('🔄 Trying audio-only stream...');
          const isAndroid = /Android/i.test(navigator.userAgent);
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: isAndroid ? 48000 : undefined
            }
          });
          console.log('✅ Audio-only stream created for incoming call');
        } catch (audioError) {
          console.error('❌ Failed to get audio-only stream:', audioError);
          // Last resort: empty stream (call can still work for receiving)
          console.warn('⚠️  Continuing call without local stream (audio/video)...');
          stream = new MediaStream(); // Empty stream as fallback
        }
      }

      // Create fresh peer connection
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);

      // Add local stream tracks (only if stream has tracks)
      if (stream && stream.getTracks().length > 0) {
        stream.getTracks().forEach(track => {
          console.log('➕ Adding local track:', track.kind, track.id);
          this.peerConnection!.addTrack(track, stream);
        });
      } else {
        console.warn('⚠️  No local tracks to add (stream is empty or camera unavailable)');
      }

      // Handle ICE candidates with Android-specific logging (incoming)
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateType = event.candidate.type;
          const candidateProtocol = event.candidate.protocol;
          const isRelay = event.candidate.candidate.includes('relay') || event.candidate.candidate.includes('turn');
          const isAndroid = /Android/i.test(navigator.userAgent);
          
          console.log('🧊 ICE candidate generated (incoming):', {
            type: candidateType,
            protocol: candidateProtocol,
            isRelay: isRelay,
            candidate: event.candidate.candidate.substring(0, 100),
            platform: isAndroid ? 'Android' : 'Other'
          });
          
          if (isAndroid && isRelay) {
            console.log('✅✅✅ Android using TURN server (relay) for incoming call!');
          }
          
          socketService.sendIceCandidate(fromUserId, event.candidate.toJSON());
        } else {
          console.log('✅ All ICE candidates gathered (incoming)');
        }
      };
      
      // Log ICE connection state with Android-specific handling (incoming)
      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection) {
          const isAndroid = /Android/i.test(navigator.userAgent);
          const state = this.peerConnection.iceConnectionState;
          
          console.log('🧊 ICE connection state (incoming):', state, isAndroid ? '(Android)' : '');
          
          if (state === 'connected' || state === 'completed') {
            console.log('✅✅✅ ICE connection established (incoming)!', isAndroid ? '(Android)' : '');
          } else if (state === 'failed') {
            console.error('❌ ICE connection failed (incoming)', isAndroid ? '(Android - TURN servers may be needed)' : '');
            
            if (isAndroid) {
              console.log('🔄 Android: Attempting ICE restart for incoming call...');
              if (this.peerConnection.restartIce) {
                this.peerConnection.restartIce();
                console.log('🔄 Restarting ICE gathering (incoming) on Android...');
              }
              
              setTimeout(() => {
                if (this.peerConnection && this.peerConnection.iceConnectionState === 'failed') {
                  console.error('❌ Android ICE connection still failed after retry (incoming)');
                  console.error('💡 Tip: Check if TURN servers are accessible from Android device');
                  this.updateCallState('failed');
                }
              }, 10000);
            } else {
              setTimeout(() => {
                if (this.peerConnection && this.peerConnection.iceConnectionState === 'failed') {
                  console.error('❌ ICE connection still failed after retry (incoming)');
                  this.updateCallState('failed');
                }
              }, 5000);
            }
          } else if (state === 'disconnected') {
            console.warn('⚠️ ICE connection disconnected (incoming)', isAndroid ? '(Android - may reconnect)' : '');
            const timeout = isAndroid ? 15000 : 10000;
            setTimeout(() => {
              if (this.peerConnection && this.peerConnection.iceConnectionState === 'disconnected') {
                console.error('❌ ICE connection failed to reconnect (incoming)', isAndroid ? '(Android)' : '');
                this.updateCallState('failed');
              }
            }, timeout);
          } else if (state === 'checking') {
            console.log('🔍 ICE connection checking (incoming)...', isAndroid ? '(Android - gathering candidates)' : '');
          }
        }
      };

      // Handle remote stream - CRITICAL: This fires when remote media arrives
      this.peerConnection.ontrack = (event) => {
        console.log('📹📹📹 REMOTE STREAM RECEIVED in handleIncomingOffer!', {
          streams: event.streams.length,
          tracks: event.streams[0]?.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })),
          streamId: event.streams[0]?.id
        });
        
        if (event.streams && event.streams.length > 0) {
          this.remoteStream = event.streams[0];
          if (this.currentCall) {
            this.currentCall.remoteStream = event.streams[0];
          }
          // Transition to active when remote stream is received (call is answered)
          console.log('✅✅✅ Updating call state to ACTIVE - remote stream received!');
          this.updateCallState('active');
        } else {
          console.warn('⚠️  ontrack event but no streams in event');
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          console.log('Connection state:', this.peerConnection.connectionState);
          if (this.peerConnection.connectionState === 'failed') {
            // Only mark as failed for actual failures, not disconnects
            this.updateCallState('failed');
          } else if (this.peerConnection.connectionState === 'disconnected' || 
                     this.peerConnection.connectionState === 'closed') {
            // Normal disconnect/close - set to ended if not already failed
            if (this.currentCall && this.currentCall.state !== 'failed') {
              this.updateCallState('ended');
            }
          } else if (this.peerConnection.connectionState === 'connected' && this.currentCall) {
            // Only update to active if we have remote stream (call is answered)
            // Otherwise keep current state (dialing/ringing)
            if (this.remoteStream) {
              this.updateCallState('active');
            }
          }
        }
      };

      // Set remote description FIRST (this is critical for WebRTC)
      if (this.peerConnection.remoteDescription) {
        console.warn('⚠️  Remote description already set, skipping setRemoteDescription');
      } else {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('✅✅✅ Remote description set for incoming call');
      }

      // Create answer AFTER setting remote description
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Check if local description is already set before setting it
      if (this.peerConnection.localDescription) {
        console.warn('⚠️  Local description already set, skipping setLocalDescription');
      } else {
        await this.peerConnection.setLocalDescription(answer);
        console.log('✅✅✅ Local description set for incoming call');
      }

      // Update call info with roles and stream
      if (!this.currentCall) {
        this.currentCall = {
          callId: `call-${Date.now()}`,
          targetUserId: fromUserId,
          state: 'ringing',
          direction: 'incoming',
          localRole,
          remoteRole,
          localStream: stream.getTracks().length > 0 ? stream : undefined
        };
      } else {
        // Update existing call with roles and stream
        this.currentCall.localRole = localRole;
        this.currentCall.remoteRole = remoteRole;
        this.currentCall.localStream = stream.getTracks().length > 0 ? stream : undefined;
      }
      
      this.notifyCallStateChange('ringing');
      this.notifyPermissionsChange();

      // Send answer through signaling server (this accepts the call)
      socketService.sendAnswer(fromUserId, answer);
      console.log('✅✅✅ Answer sent to caller:', fromUserId);
      
      // Emit answered signal after sending answer
      socketService.emit('call:answered', { fromUserId, targetUserId: fromUserId });
      
      // Don't auto-update to active - let ontrack handle it when remote stream arrives
      // This prevents race conditions

      console.log('✅✅✅ Call accepted and answer sent from:', fromUserId);
    } catch (error) {
      console.error('❌❌❌ Error handling incoming offer:', error);
      // Don't cleanup immediately - let the user see the error
      // The error will be shown in the UI
      if (error instanceof Error && error.message.includes('camera')) {
        // Camera error - but we can still try to continue
        console.warn('⚠️  Camera error, but call might still work');
      } else {
        // Other errors - cleanup
        this.cleanup();
      }
      throw error; // Re-throw so caller can handle it
    }
  }

  // Handle answer to our offer
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📞📞📞📞📞 ANSWER RECEIVED!', {
      hasAnswer: !!answer,
      answerType: answer.type,
      hasPeerConnection: !!this.peerConnection,
      hasCurrentCall: !!this.currentCall
    });
    
    if (!this.peerConnection || !this.currentCall) {
      console.warn('⚠️  Received answer but no active call or peer connection');
      return;
    }

    // Clear timeout since we got an answer
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
      console.log('✅ Call timeout cleared - answer received');
    }

    try {
      // Check if remote description is already set
      if (this.peerConnection.remoteDescription) {
        console.warn('⚠️  Remote description already set, skipping setRemoteDescription');
        // If it's already set, check if it matches
        if (this.peerConnection.remoteDescription.type !== answer.type) {
          console.error('❌ Remote description type mismatch!');
          this.updateCallState('failed');
          return;
        }
      } else {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('✅✅✅ Remote description set successfully!');
      }
      console.log('✅✅✅ Answer processed, waiting for ICE connection...');
      // State will be updated by ontrack when remote stream arrives (call becomes active)
      // Don't update to active here - wait for remote stream
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      // Check if it's the SDP mismatch error
      if (error instanceof Error && error.message.includes('SDP')) {
        console.error('❌ SDP mismatch error - this usually means the offer/answer was already processed');
        // Try to continue anyway - the connection might still work
      } else {
        this.updateCallState('failed');
      }
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    console.log('🧊🧊🧊 ICE candidate received:', {
      candidate: candidate.candidate?.substring(0, 50),
      hasPeerConnection: !!this.peerConnection,
      hasCurrentCall: !!this.currentCall,
      callState: this.currentCall?.state
    });
    
    if (!this.peerConnection) {
      console.warn('⚠️  Received ICE candidate but no peer connection - this means offer was not processed!');
      console.warn('⚠️  This usually means the call:offer event was not received or processed');
      return;
    }

    try {
      console.log('🧊 Adding ICE candidate:', candidate.candidate?.substring(0, 50));
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
      // Don't fail the call if ICE candidate fails - it might already be added
    }
  }

  // Derive call permissions based on current call state and roles
  private derivePermissions(): CallPermissions {
    if (!this.currentCall) {
      return { canEndCall: false, canCancelCall: false };
    }

    const { state, localRole, remoteRole } = this.currentCall;
    const isPreAnswer = state === 'dialing' || state === 'ringing';
    const isActive = state === 'active';

    // Cancel is allowed before answer (dialing/ringing)
    const canCancelCall = isPreAnswer;

    // End call permissions:
    // - Child cannot end active call with parent
    // - Otherwise, end call is allowed
    const isChildToParentActive = localRole === 'child' && remoteRole === 'parent' && isActive;
    const canEndCall = !isChildToParentActive;

    return {
      canEndCall,
      canCancelCall,
      reason: isChildToParentActive 
        ? 'Vraag de ouder om te beëindigen' 
        : undefined
    };
  }

  // Notify permissions listeners
  private notifyPermissionsChange(): void {
    const permissions = this.derivePermissions();
    this.permissionsListeners.forEach(callback => callback(permissions));
  }

  // Subscribe to permissions changes
  subscribePermissions(callback: (permissions: CallPermissions) => void): () => void {
    this.permissionsListeners.add(callback);
    // Immediately notify with current permissions
    callback(this.derivePermissions());
    return () => {
      this.permissionsListeners.delete(callback);
    };
  }

  // Get current permissions
  getPermissions(): CallPermissions {
    return this.derivePermissions();
  }

  // Cancel call (before answer)
  cancelCall(): void {
    if (!this.currentCall) {
      console.warn('No active call to cancel');
      return;
    }

    const permissions = this.derivePermissions();
    if (!permissions.canCancelCall) {
      console.warn('Cannot cancel call in current state:', this.currentCall.state);
      return;
    }

    const targetUserId = this.currentCall.targetUserId;
    // Send cancel signal
    socketService.sendCallCancel(targetUserId);
    this.cleanup();
  }

  // End the call (after answer or anytime if allowed)
  endCall(): void {
    if (!this.currentCall) {
      console.warn('No active call to end');
      return;
    }

    const permissions = this.derivePermissions();
    if (!permissions.canEndCall) {
      console.warn('Cannot end call:', permissions.reason);
      // Emit error event for UI to display
      const errorEvent = new CustomEvent('call:permission-denied', {
        detail: { reason: permissions.reason || 'Je kunt deze call niet beëindigen' }
      });
      window.dispatchEvent(errorEvent);
      return;
    }

    if (this.currentCall.state !== 'ended') {
      const targetUserId = this.currentCall.targetUserId;
      
      // Update state immediately for faster UI feedback
      this.updateCallState('ended');
      
      // Send hangup signal (after answer) or cancel (before answer)
      const isPreAnswer = this.currentCall.state === 'dialing' || this.currentCall.state === 'ringing';
      if (isPreAnswer) {
        socketService.sendCallCancel(targetUserId);
      } else {
        socketService.sendCallHangup(targetUserId);
      }
      
      // Cleanup immediately instead of waiting
      this.cleanup();
    } else {
      // Already ended, just cleanup
      this.cleanup();
    }
  }

  // Cleanup resources
  private cleanup(): void {
    console.log('🧹 Cleaning up WebRTC resources...');
    
    // Clear timeout
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Close peer connection properly
    if (this.peerConnection) {
      // Remove all event listeners first
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      
      // Close the connection
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('✅ Peer connection closed');
    }

    // Clear call state - always set to 'ended' for normal cleanup
    // Only set to 'failed' explicitly when there's an actual error
    if (this.currentCall && this.currentCall.state !== 'failed') {
      this.notifyCallStateChange('ended');
    }
    this.currentCall = null;
    this.remoteStream = null;
  }

  private updateCallState(state: CallState): void {
    if (this.currentCall) {
      this.currentCall.state = state;
      this.notifyCallStateChange(state);
      // Permissions may change when state changes
      this.notifyPermissionsChange();
    }
  }

  // Getters
  getCurrentCall(): CallInfo | null {
    return this.currentCall;
  }

  getCurrentLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getCurrentRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

export const webrtcService = WebRTCService.getInstance();

