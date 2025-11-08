import { useEffect, useState } from 'react';
import { firebaseService, type AuthState } from './services/FirebaseService';
import { socketService } from './services/SocketService';
import { familyService } from './services/FamilyService';
import { webrtcService } from './services/WebRTCService';
import { notificationService } from './services/NotificationService';
import { ParentLogin } from './features/auth/ParentLogin';
import { ChildCodeLogin } from './features/auth/ChildCodeLogin';
import { EmailVerificationPrompt } from './features/auth/EmailVerificationPrompt';
import { BubbleHome } from './features/home/BubbleHome';
import { CallScreen } from './features/call/CallScreen';

// Determine server URL based on environment
// On mobile/other devices, use the computer's IP address instead of localhost
// For external access (ngrok, etc.), set VITE_BACKEND_URL environment variable
const getServerUrl = () => {
  // Check for environment variable first (for ngrok/external access)
  if (import.meta.env.VITE_BACKEND_URL) {
    const url = import.meta.env.VITE_BACKEND_URL;
    console.log('🌐 Using VITE_BACKEND_URL:', url);
    return url;
  }
  
  // Check if we're running on localhost (development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🌐 Using localhost backend');
    return 'http://localhost:4000';
  }
  
  // PRODUCTION: If VITE_BACKEND_URL is not set in production, show error
  if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('railway.app')) {
    console.error('❌❌❌ VITE_BACKEND_URL is not set! Please set it in Vercel environment variables.');
    console.error('❌❌❌ Expected: VITE_BACKEND_URL=https://webrtc-kids-production.up.railway.app');
    // Still try to use Railway URL as fallback, but log the error
    return 'https://webrtc-kids-production.up.railway.app';
  }
  
  // For local network IPs, use HTTP
  const url = `http://${window.location.hostname}:4000`;
  console.log('🌐 Using local network backend:', url);
  return url;
};

const SERVER_URL = getServerUrl();
console.log('🌐🌐🌐 Final SERVER_URL:', SERVER_URL);

// Function to play incoming call sound (repeating)
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;

const playIncomingCallSound = () => {
  // Stop any existing ringtone
  stopIncomingCallSound();
  
  try {
    // CRITICAL: Resume AudioContext if suspended (browser autoplay policy)
    // This is needed for audio to work when app is in background or not visible
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playRing = () => {
      if (!audioContext) return;
      
      try {
        // Rustiger, zachter geluid met lagere frequenties
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Zachtere, lagere frequentie (523Hz = C5, rustiger dan 800Hz)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        
        // Zachtere volume envelope - langzamer opbouw, zachter volume
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.2); // Langzamer opbouw
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5); // Langzamer afbouw
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Tweede toon na langere pauze - nog zachter
        setTimeout(() => {
          if (!audioContext) return;
          
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          
          // Nog lagere frequentie (440Hz = A4, rustig)
          oscillator2.type = 'sine';
          oscillator2.frequency.setValueAtTime(440, audioContext.currentTime);
          
          // Nog zachter volume
          gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode2.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.2);
          gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
          
          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.5);
        }, 600); // Kortere pauze tussen tonen
      } catch (error) {
        console.error('Error playing ringtone:', error);
      }
    };
    
    // Resume audio context if suspended (required for autoplay policies)
    const startPlaying = () => {
      playRing();
      // Repeat every 3 seconds
      ringtoneInterval = setInterval(() => {
        playRing();
      }, 3000);
    };
    
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('✅ AudioContext resumed for incoming call sound');
        startPlaying();
      }).catch(err => {
        console.error('❌ Failed to resume AudioContext:', err);
        // Try to play anyway
        startPlaying();
      });
    } else {
      startPlaying();
    }
  } catch (error) {
    console.error('Error initializing call sound:', error);
  }
};

const stopIncomingCallSound = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (audioContext) {
    audioContext.close().catch(console.error);
    audioContext = null;
  }
};

// Function to play outgoing call sound (dialing tone) - exported for use in CallScreen
let outgoingCallAudioContext: AudioContext | null = null;
let outgoingCallInterval: ReturnType<typeof setInterval> | null = null;

export const playOutgoingCallSound = () => {
  stopOutgoingCallSound();
  
  try {
    outgoingCallAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playDialTone = () => {
      if (!outgoingCallAudioContext) return;
      
      try {
        // Rustigere, zachtere dial tone - lagere frequenties en zachter volume
        const oscillator = outgoingCallAudioContext.createOscillator();
        const gainNode = outgoingCallAudioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(outgoingCallAudioContext.destination);
        
        // Lagere, rustigere frequentie (400Hz in plaats van 350Hz)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, outgoingCallAudioContext.currentTime);
        
        // Create second oscillator for dual tone - ook rustiger
        const oscillator2 = outgoingCallAudioContext.createOscillator();
        const gainNode2 = outgoingCallAudioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(outgoingCallAudioContext.destination);
        
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(500, outgoingCallAudioContext.currentTime); // Lagere tweede toon
        
        // Zachtere volume envelope - langzamer opbouw, zachter volume
        gainNode.gain.setValueAtTime(0, outgoingCallAudioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.12, outgoingCallAudioContext.currentTime + 0.15); // Zachter volume
        gainNode.gain.setValueAtTime(0.12, outgoingCallAudioContext.currentTime + 0.4);
        gainNode.gain.linearRampToValueAtTime(0, outgoingCallAudioContext.currentTime + 0.6); // Langzamer afbouw
        
        gainNode2.gain.setValueAtTime(0, outgoingCallAudioContext.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.1, outgoingCallAudioContext.currentTime + 0.15); // Nog zachter
        gainNode2.gain.setValueAtTime(0.1, outgoingCallAudioContext.currentTime + 0.4);
        gainNode2.gain.linearRampToValueAtTime(0, outgoingCallAudioContext.currentTime + 0.6);
        
        oscillator.start(outgoingCallAudioContext.currentTime);
        oscillator.stop(outgoingCallAudioContext.currentTime + 0.6);
        
        oscillator2.start(outgoingCallAudioContext.currentTime);
        oscillator2.stop(outgoingCallAudioContext.currentTime + 0.6);
      } catch (error) {
        console.error('Error playing dial tone:', error);
      }
    };
    
    // Play immediately
    playDialTone();
    
    // Repeat every 1 second (langzamer dan 0.5s voor rustiger gevoel)
    outgoingCallInterval = setInterval(() => {
      playDialTone();
    }, 1000);
  } catch (error) {
    console.error('Error initializing outgoing call sound:', error);
  }
};

const stopOutgoingCallSound = () => {
  if (outgoingCallInterval) {
    clearInterval(outgoingCallInterval);
    outgoingCallInterval = null;
  }
  if (outgoingCallAudioContext) {
    outgoingCallAudioContext.close().catch(console.error);
    outgoingCallAudioContext = null;
  }
};

interface ChildSession {
  userId: string;
  childName: string;
  familyId: string;
  role: 'child';
}

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });
  const [_socketConnected, setSocketConnected] = useState(false);
  const [activeCall, setActiveCall] = useState<{ contactId: string; contactName: string; remoteRole?: 'parent' | 'child' } | null>(null);
  const [loginMode, setLoginMode] = useState<'parent' | 'child'>('parent');
  const [childSession, setChildSession] = useState<ChildSession | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [isParent, setIsParent] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Initialize notification service and service worker
  useEffect(() => {
    notificationService.initialize().catch(console.error);
  }, []);

  // Check for child session on mount
  useEffect(() => {
    console.log('🔍 Checking for child session in localStorage...');
    const storedSession = localStorage.getItem('childSession');
    console.log('🔍 Stored session:', storedSession ? 'found' : 'not found');
    
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession) as ChildSession;
        console.log('✅ Child session parsed successfully:', {
          userId: session.userId,
          childName: session.childName,
          familyId: session.familyId,
          role: session.role
        });
        setChildSession(session);
        setFamilyId(session.familyId);
        setCurrentUserId(session.userId);
        setCurrentUserName(session.childName);
        setIsParent(false);
        setAuthState({ user: null, loading: false, error: null });
        console.log('✅ Child session state set');
      } catch (e) {
        console.error('❌ Error parsing child session:', e);
        localStorage.removeItem('childSession');
        setAuthState({ user: null, loading: false, error: null });
      }
    } else {
      console.log('⚠️ No child session found in localStorage');
      // No child session, wait for Firebase auth
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Listen for child account deletion (only for child sessions)
  useEffect(() => {
    if (!childSession || !childSession.userId) return;

    console.log('👂 Setting up child deletion listener for:', childSession.userId);
    
    const unsubscribe = familyService.subscribeToChildDeletion(childSession.userId, () => {
      console.log('⚠️ Child account has been deleted by parent');
      
      // Show notification first
      alert('⚠️ Je account is verwijderd door de ouder.\n\nJe wordt nu uitgelogd.');
      
      // Clean up session
      localStorage.removeItem('childSession');
      
      // Disconnect socket
      socketService.disconnect();
      
      // Reset all state
      setChildSession(null);
      setFamilyId(null);
      setCurrentUserId(null);
      setCurrentUserName('');
      setIsParent(false);
      setAuthState({ user: null, loading: false, error: null });
      
      // Force reload to go back to login screen
      setTimeout(() => {
        window.location.reload();
      }, 500);
    });

    return () => {
      console.log('🔇 Cleaning up child deletion listener');
      unsubscribe();
    };
  }, [childSession]);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribe((state) => {
      console.log('Auth state changed:', state);
      setAuthState(state);
      
      // Initialize family when parent logs in
      if (state.user && firebaseService.isEmailVerified() && !familyId && !childSession) {
        console.log('Initializing family for user:', state.user.uid);
        initializeFamily(state.user.uid, state.user.email || '', state.user.displayName || 'Ouder');
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const initializeFamily = async (userId: string, email: string, displayName: string) => {
    try {
      console.log('Starting family initialization...');
      setInitializationError(null);
      
      const fid = await familyService.getOrCreateFamily(userId, email, displayName);
      console.log('Family ID:', fid);
      
      setFamilyId(fid);
      setCurrentUserId(userId);
      setCurrentUserName(displayName || email.split('@')[0]);
      setIsParent(true);
      
      // Update user info (include parent gender if chosen during registration)
      const storedParentGender = localStorage.getItem('parent_gender_choice');
      if (storedParentGender) {
        // Clear after use
        localStorage.removeItem('parent_gender_choice');
      }

      await familyService.addFamilyMember(userId, fid, {
        email,
        displayName,
        role: 'parent',
        parentGender: storedParentGender === 'father' ? 'father' : (storedParentGender === 'mother' ? 'mother' : null)
      });
      
      console.log('Family initialization complete');
    } catch (error) {
      console.error('Error initializing family:', error);
      setInitializationError(error instanceof Error ? error.message : 'Fout bij initialiseren familie');
    }
  };

  // Connect socket when authenticated
  useEffect(() => {
    // Use childSession userId if available, otherwise use currentUserId or authState.user
    const userId = childSession?.userId || currentUserId || authState.user?.uid;
    const fid = childSession?.familyId || familyId;
    
    console.log('🔌 Socket useEffect triggered:', {
      userId,
      familyId: fid,
      currentUserId,
      hasAuthUser: !!authState.user,
      authUserId: authState.user?.uid,
      hasChildSession: !!childSession,
      childSessionUserId: childSession?.userId,
      childSessionFamilyId: childSession?.familyId,
      shouldConnect: !!(userId && fid && (authState.user || childSession))
    });
    
    // CRITICAL CHECK: If we have a child session, we MUST use it, not Firebase
    if (childSession && childSession.userId) {
      console.log('✅✅✅ CHILD SESSION DETECTED - Will use child token:', {
        userId: childSession.userId,
        familyId: childSession.familyId
      });
    } else if (authState.user) {
      console.log('⚠️⚠️⚠️ NO CHILD SESSION - Will use Firebase token (this may fail on mobile):', {
        userId: authState.user.uid
      });
    }
    
    if (userId && fid && (authState.user || childSession)) {
      console.log('🔌🔌🔌 Socket connection conditions met:', {
        userId,
        familyId,
        hasAuthUser: !!authState.user,
        hasChildSession: !!childSession,
        childSessionUserId: childSession?.userId,
        willConnect: true
      });
      
      const connectSocket = async () => {
        try {
          console.log('🔌🔌🔌 Attempting to connect socket...', {
            serverUrl: SERVER_URL,
            userId: userId,
            hasTokenGetter: true
          });
          
          // CRITICAL: Set up event handlers BEFORE connecting
          const handleConnect = async () => {
            console.log('✅✅✅ Socket connected for user:', userId);
            setSocketConnected(true);
            
            try {
              // Join user room and wait for ACK before initializing WebRTC
              await socketService.joinUserRoom();
              console.log('📢 Joined user room for:', userId);
              
              // CRITICAL: Initialize WebRTC listeners AFTER room join ACK
              webrtcService.initializeListeners();
              console.log('✅ WebRTC listeners initialized');
            } catch (error) {
              console.error('❌ Failed to join room or initialize WebRTC:', error);
              // Still try to initialize WebRTC listeners even if room join fails
              webrtcService.initializeListeners();
            }
            
            if (userId) {
              // Small delay to ensure room is joined before updating status
              setTimeout(() => {
                familyService.updateOnlineStatus(userId, true).catch(console.error);
              }, 500);
            }
          };
          
          // Listen for room join confirmation (for logging/debugging)
          const handleRoomJoined = (data: { room: string; userId: string }) => {
            console.log('✅✅✅ Room joined event received:', data);
            console.log('✅✅✅ Current userId:', currentUserId);
            console.log('✅✅✅ Expected room:', `user:${currentUserId}`);
            if (data.room !== `user:${currentUserId}`) {
              console.warn('⚠️  Room mismatch! Expected:', `user:${currentUserId}`, 'Got:', data.room);
            }
          };
          
          const handleDisconnect = () => {
            console.log('❌ Socket disconnected');
            setSocketConnected(false);
            if (userId) {
              familyService.updateOnlineStatus(userId, false).catch(console.error);
            }
          };
          
          // Register handlers BEFORE connecting
          socketService.on('connect', handleConnect);
          socketService.on('room:joined', handleRoomJoined);
          socketService.on('disconnect', handleDisconnect);
          
          console.log('📋 Event handlers registered, now connecting...');
          
          await socketService.connect(SERVER_URL, async () => {
            console.log('🔐🔐🔐 Token getter called:', {
              hasChildSession: !!childSession,
              childSessionUserId: childSession?.userId,
              childSessionRole: childSession?.role,
              hasAuthUser: !!authState.user,
              authUserId: authState.user?.uid,
              userId: userId,
              currentUserId: currentUserId
            });
            
            // CRITICAL: Check childSession FIRST before checking authState.user
            if (childSession && childSession.userId) {
              const childToken = 'child-token-' + childSession.userId;
              console.log('🔐🔐🔐 Generating child token:', {
                userId: childSession.userId,
                token: childToken,
                tokenLength: childToken.length,
                startsWithChildToken: childToken.startsWith('child-token-')
              });
              return childToken;
            }
            
            // Only use Firebase token if no child session
            if (authState.user) {
              const firebaseToken = await firebaseService.getIdToken();
              if (firebaseToken) {
                console.log('🔐🔐🔐 Using Firebase token:', {
                  tokenPrefix: firebaseToken.substring(0, 30) + '...'
                });
                return firebaseToken;
              }
            }
            
            // DEV fallback: allow parent dev token when Firebase token not available
            if (import.meta.env.DEV && import.meta.env.VITE_DEV_FAKE_PARENT_AUTH === 'true' && userId) {
              const devParentToken = 'dev-parent-token-' + userId;
              console.warn('⚠️ Using DEV parent token fallback');
              return devParentToken;
            }
            console.error('❌ No token available for socket connection');
            return null;
          });
          
          console.log('✅ Socket connect() call completed');
          
          // Give socket a moment to connect
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const connected = socketService.isConnected();
          console.log('🔍 Socket connection status after 2s:', connected);
          if (!connected) {
            console.warn('⚠️ Socket still not connected after 2 seconds. Check backend logs.');
          }
        } catch (error) {
          console.error('❌❌❌ Failed to connect socket:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
        }
      };

      connectSocket();
      
      // Cleanup function
      return () => {
        console.log('🔇 Cleaning up socket listeners');
        socketService.disconnect();
        if (userId) {
          familyService.updateOnlineStatus(userId, false).catch(console.error);
        }
      };
    } else {
      console.log('⚠️ Socket connection skipped - missing requirements:', {
        userId: !!userId,
        familyId: !!familyId,
        hasAuthUser: !!authState.user,
        hasChildSession: !!childSession
      });
      socketService.disconnect();
      setSocketConnected(false);
    }
  }, [authState.user, childSession, familyId, currentUserId]);

  // Listen for incoming calls - MUST be before all conditional returns
  useEffect(() => {
            if (!familyId || !currentUserId) return;

            const handleIncomingCall = async (data: { fromUserId: string; offer: any; targetUserId: string }) => {
              console.log('📞📞📞📞📞 INCOMING CALL DETECTED in App.tsx:', {
                fromUserId: data.fromUserId,
                targetUserId: data.targetUserId,
                currentUserId: currentUserId,
                match: data.targetUserId === currentUserId,
                hasOffer: !!data.offer
              });
              
              // Check if this call is for us
              if (data.targetUserId !== currentUserId) {
                console.log('⚠️  Call not for us, ignoring. Target:', data.targetUserId, 'Us:', currentUserId);
                return;
              }

              console.log('✅✅✅✅✅ This call is for us! Processing...');
              
              // Log device info for debugging inconsistent connections
              const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                isAndroid: /Android/i.test(navigator.userAgent),
                isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
                connectionType: (navigator as any).connection?.effectiveType || 'unknown',
                socketConnected: socketService.isConnected(),
                timestamp: new Date().toISOString()
              };
              console.log('📱 Device info for incoming call:', deviceInfo);

              // Play incoming call sound
              playIncomingCallSound();
              
              // Show push notification (works even when app is closed/background)
              // Check if notification service is ready
              if (notificationService.isReady()) {
                notificationService.showNotification('Nieuwe oproep', {
                  body: 'Je hebt een oproep ontvangen',
                  icon: '/icon-192.png',
                  tag: `call-${data.fromUserId}`,
                  data: {
                    fromUserId: data.fromUserId
                  }
                }).catch(err => {
                  console.error('Failed to show notification:', err);
                });
              } else {
                console.warn('⚠️ Notification service not ready, permission:', notificationService.getPermission());
              }

              // Get caller name and role from family service
              let callerName = data.fromUserId;
              let callerRole: 'parent' | 'child' | undefined = undefined;
              try {
                const callerInfo = await familyService.getUserInfo(data.fromUserId);
                callerName = callerInfo?.displayName || data.fromUserId;
                callerRole = callerInfo?.role as 'parent' | 'child' | undefined;
                console.log('✅ Caller info retrieved:', callerName, 'role:', callerRole);
                
                // Update notification with caller name if we got it
                if (callerName !== data.fromUserId) {
                  notificationService.showNotification(`Oproep van ${callerName}`, {
                    body: 'Je hebt een oproep ontvangen',
                    icon: '/icon-192.png',
                    tag: `call-${data.fromUserId}`,
                    data: {
                      fromUserId: data.fromUserId,
                      callerName: callerName
                    }
                  }).catch(() => {}); // Ignore errors on update
                }
              } catch (error) {
                console.error('❌ Error getting caller info:', error);
              }
              
              // Show call screen for incoming call
              // The WebRTC service will handle the offer automatically via its own listener
              console.log('✅ Setting active call in App.tsx:', { contactId: data.fromUserId, contactName: callerName, remoteRole: callerRole });
              setActiveCall({
                contactId: data.fromUserId,
                contactName: callerName,
                remoteRole: callerRole
              });
            };

            console.log('👂👂👂👂👂 Setting up call:offer listener for user:', currentUserId);
            socketService.on('call:offer', handleIncomingCall);
            
            // Also log when socket receives ANY event
            socketService.on('connect', () => {
              console.log('✅✅✅ Socket connected, ready to receive calls');
            });

            return () => {
              console.log('🔇 Removing call:offer listener');
              socketService.off('call:offer', handleIncomingCall);
              // Stop ringtone when listener is removed
              stopIncomingCallSound();
            };
          }, [familyId, currentUserId]);

  // Cleanup ringtone on unmount
  useEffect(() => {
    return () => {
      stopIncomingCallSound();
    };
  }, []);

  // Show loading state
  if (authState.loading && !childSession) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui'
      }}>
        <p>Laden...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!authState.user && !childSession) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui',
        width: '100%',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Login mode selector */}
        <div style={{
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '1rem'
        }}>
          <button
            onClick={() => setLoginMode('parent')}
            style={{
              padding: '10px 20px',
              backgroundColor: loginMode === 'parent' ? '#4CAF50' : '#e0e0e0',
              color: loginMode === 'parent' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Ouder
          </button>
          <button
            onClick={() => setLoginMode('child')}
            style={{
              padding: '10px 20px',
              backgroundColor: loginMode === 'child' ? '#2196F3' : '#e0e0e0',
              color: loginMode === 'child' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Kind
          </button>
        </div>

        {loginMode === 'parent' ? (
          <>
            <ParentLogin />
            <div style={{
              backgroundColor: 'white',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                📝 <strong>Firebase niet geconfigureerd?</strong><br />
                Zie <code>FIREBASE_SETUP_GUIDE.md</code> voor instructies
              </p>
            </div>
          </>
        ) : (
          <ChildCodeLogin onLoginSuccess={(userId, name, fid, role) => {
            console.log('✅ Child login success:', { userId, name, fid, role });
            if (role === 'child') {
              const newChildSession: ChildSession = { userId, childName: name, familyId: fid, role: 'child' };
              console.log('💾 Saving child session to localStorage:', newChildSession);
              localStorage.setItem('childSession', JSON.stringify(newChildSession));
              setChildSession(newChildSession);
              setFamilyId(fid);
              setCurrentUserId(userId);
              setCurrentUserName(name);
              setIsParent(false);
              // Ensure authState is set correctly for child session
              setAuthState({ user: null, loading: false, error: null });
              console.log('✅ Child session state set');
            } else {
              // For parent code login, we need to handle it differently
              // For now, treat it similar to child but mark as parent
              const tempChildSession: ChildSession = { userId, childName: name, familyId: fid, role: 'child' };
              setChildSession(tempChildSession); // Temporary
              setFamilyId(fid);
              setCurrentUserId(userId);
              setCurrentUserName(name);
              setIsParent(true);
              setAuthState({ user: null, loading: false, error: null });
            }
          }} />
        )}
      </div>
    );
  }

  // Show email verification prompt if parent email not verified
  if (authState.user && !firebaseService.isEmailVerified()) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui',
        width: '100%'
      }}>
        <EmailVerificationPrompt />
      </div>
    );
  }

  // Show error if initialization failed
  if (initializationError) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#f44336', marginTop: 0 }}>Initialisatie Fout</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>{initializationError}</p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            Controleer browser console (F12) voor meer details.<br />
            Mogelijk moet je Firestore rules deployen.
          </p>
          <button
            onClick={() => {
              setInitializationError(null);
              window.location.reload();
            }}
            style={{
              marginTop: '1rem',
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Probeer opnieuw
          </button>
        </div>
      </div>
    );
  }

  // Show call screen if active call
  if (activeCall && familyId && currentUserId) {
    // Stop ringtone when call screen is shown
    stopIncomingCallSound();
    
    return (
      <CallScreen
        targetUserId={activeCall.contactId}
        targetUserName={activeCall.contactName}
        isParent={isParent}
        remoteRole={activeCall.remoteRole}
        onEndCall={() => {
          setActiveCall(null);
          webrtcService.endCall();
          stopIncomingCallSound();
        }}
      />
    );
  }

  // Show main app (BubbleHome)
  if (familyId && currentUserId) {
    console.log('✅ Rendering BubbleHome:', { familyId, currentUserId, isParent, currentUserName });
    try {
      return (
        <div>
          <BubbleHome
            onCallContact={(contactId, contactName, remoteRole) => {
              setActiveCall({ contactId, contactName, remoteRole });
            }}
            isParent={isParent}
            familyId={familyId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </div>
      );
    } catch (error) {
      console.error('❌ Error rendering BubbleHome:', error);
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          fontFamily: 'system-ui',
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#f44336', marginTop: 0 }}>Fout bij laden</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Er is een fout opgetreden bij het laden van de app.
            </p>
            <p style={{ fontSize: '14px', color: '#999', marginBottom: '1.5rem' }}>
              {error instanceof Error ? error.message : 'Onbekende fout'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Herlaad pagina
            </button>
          </div>
        </div>
      );
    }
  }

  // Loading state while initializing - SHOW THIS WITH DEBUG INFO
  console.log('⚠️ Showing loading state:', { familyId, currentUserId, childSession, authState });
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui',
      gap: '1rem',
      padding: '2rem'
    }}>
      <p style={{ fontSize: '18px', fontWeight: '600' }}>Initialiseren...</p>
      
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        width: '100%',
        fontSize: '14px',
        fontFamily: 'monospace'
      }}>
        <p style={{ marginTop: 0, fontWeight: 'bold' }}>Debug Info:</p>
        <p>Auth User: {authState.user ? '✓ Ingelogd' : '✗ Niet ingelogd'}</p>
        <p>Child Session: {childSession ? '✓ Actief' : '✗ Geen'}</p>
        <p>Family ID: {familyId || 'Geen'}</p>
        <p>Current User ID: {currentUserId || 'Geen'}</p>
        <p>Is Parent: {isParent ? 'Ja' : 'Nee'}</p>
        <p>Email Verified: {authState.user ? (firebaseService.isEmailVerified() ? 'Ja' : 'Nee') : 'N/A'}</p>
      </div>
      
      <p style={{ fontSize: '14px', color: '#999' }}>
        Open browser console (F12) voor meer details
      </p>
      <button
        onClick={() => {
          console.log('Current state:', {
            authState,
            childSession,
            familyId,
            currentUserId,
            isParent,
            initializationError
          });
          window.location.reload();
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Debug Info (check console)
      </button>
    </div>
  );
}

export default App;
