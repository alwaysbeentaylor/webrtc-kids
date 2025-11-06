import { useEffect, useRef, useState } from 'react';
import { webrtcService, type CallState, type CallPermissions, type UserRole } from '../../services/WebRTCService';
import { socketService } from '../../services/SocketService';
import { familyService } from '../../services/FamilyService';

// Function to play outgoing call sound (dialing tone)
let outgoingCallAudioContext: AudioContext | null = null;
let outgoingCallInterval: ReturnType<typeof setInterval> | null = null;

const playOutgoingCallSound = () => {
  stopOutgoingCallSound();
  
  try {
    outgoingCallAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playDialTone = () => {
      if (!outgoingCallAudioContext) return;
      
      try {
        const oscillator = outgoingCallAudioContext.createOscillator();
        const gainNode = outgoingCallAudioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(outgoingCallAudioContext.destination);
        
        // Dial tone: two tones playing simultaneously
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(350, outgoingCallAudioContext.currentTime);
        
        // Create second oscillator for dual tone
        const oscillator2 = outgoingCallAudioContext.createOscillator();
        const gainNode2 = outgoingCallAudioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(outgoingCallAudioContext.destination);
        
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(440, outgoingCallAudioContext.currentTime);
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0, outgoingCallAudioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, outgoingCallAudioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, outgoingCallAudioContext.currentTime + 0.4);
        gainNode.gain.linearRampToValueAtTime(0, outgoingCallAudioContext.currentTime + 0.5);
        
        gainNode2.gain.setValueAtTime(0, outgoingCallAudioContext.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.2, outgoingCallAudioContext.currentTime + 0.1);
        gainNode2.gain.setValueAtTime(0.2, outgoingCallAudioContext.currentTime + 0.4);
        gainNode2.gain.linearRampToValueAtTime(0, outgoingCallAudioContext.currentTime + 0.5);
        
        oscillator.start(outgoingCallAudioContext.currentTime);
        oscillator.stop(outgoingCallAudioContext.currentTime + 0.5);
        
        oscillator2.start(outgoingCallAudioContext.currentTime);
        oscillator2.stop(outgoingCallAudioContext.currentTime + 0.5);
      } catch (error) {
        console.error('Error playing dial tone:', error);
      }
    };
    
    // Play immediately
    playDialTone();
    
    // Repeat every 0.5 seconds for continuous dial tone
    outgoingCallInterval = setInterval(() => {
      playDialTone();
    }, 500);
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

interface CallScreenProps {
  targetUserId: string;
  targetUserName: string;
  isParent: boolean;
  remoteRole?: UserRole; // Role of the person being called
  onEndCall: () => void;
}

export function CallScreen({ targetUserId, targetUserName, isParent, remoteRole, onEndCall }: CallScreenProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [permissions, setPermissions] = useState<CallPermissions>({ canEndCall: false, canCancelCall: false });
  const [error, setError] = useState<string | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const localRole: UserRole = isParent ? 'parent' : 'child';

  useEffect(() => {
    const unsubscribe = webrtcService.subscribe((state) => {
      console.log('Call state changed:', state);
      setCallState(state);
      
      // Update isIncomingCall based on current call direction
      const currentCall = webrtcService.getCurrentCall();
      if (currentCall && currentCall.direction === 'incoming') {
        setIsIncomingCall(true);
      } else if (currentCall && currentCall.direction === 'outgoing') {
        setIsIncomingCall(false);
      }
      
      // Stop outgoing call sound when call is answered, ended, or failed
      if (state === 'active' || state === 'ended' || state === 'failed') {
        stopOutgoingCallSound();
      }
      
      if (state === 'ended' || state === 'failed') {
        // Auto-close after 2 seconds
        setTimeout(() => {
          onEndCall();
        }, 2000);
      }
    });

    // Subscribe to permissions changes
    const unsubscribePermissions = webrtcService.subscribePermissions((perms) => {
      console.log('Call permissions changed:', perms);
      setPermissions(perms);
    });

    // Listen for permission denied events
    const handlePermissionDenied = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      setError(customEvent.detail.reason);
      setTimeout(() => setError(null), 5000); // Clear after 5 seconds
    };
    window.addEventListener('call:permission-denied', handlePermissionDenied);

    // Listen for call cancelled events
    const handleCallCancelled = async (event: Event) => {
      const customEvent = event as CustomEvent<{ fromUserId: string }>;
      console.log('📞 Call cancelled event received:', customEvent.detail);
      stopOutgoingCallSound();
      
      // Get the name of who cancelled
      try {
        const userInfo = await familyService.getUserInfo(customEvent.detail.fromUserId);
        const cancelledByName = userInfo?.displayName || 'Papa of mama';
        setError(`${cancelledByName} kan nu niet opnemen`);
        setCallState('ended');
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          onEndCall();
        }, 3000);
      } catch (err) {
        console.error('Error getting user info:', err);
        setError('Papa of mama kan nu niet opnemen');
        setCallState('ended');
        setTimeout(() => {
          onEndCall();
        }, 3000);
      }
    };
    window.addEventListener('call:cancelled', handleCallCancelled);

    // Listen for socket errors
    const handleError = (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setError(data.message);
      setCallState('failed');
    };

    socketService.on('error', handleError);

    let checkTimeout: ReturnType<typeof setTimeout> | null = null;

    // Check if this is an incoming call (user is already in a call)
    const currentCall = webrtcService.getCurrentCall();
    console.log('🔍 CallScreen mounted, currentCall:', currentCall, 'targetUserId:', targetUserId);
    
    if (currentCall) {
      // There's already a call active
      if (currentCall.direction === 'incoming') {
        // This is an incoming call - targetUserId in currentCall is the caller (fromUserId)
        // So we check if the caller matches our targetUserId
        console.log('✅ Incoming call detected in CallScreen', {
          currentCallTargetUserId: currentCall.targetUserId,
          propsTargetUserId: targetUserId,
          callState: currentCall.state
        });
        setIsIncomingCall(true);
        setCallState(currentCall.state);
        // Set roles if not already set
        if (!currentCall.localRole || !currentCall.remoteRole) {
          webrtcService.setCallRoles(localRole, remoteRole || 'child');
        }
      } else if (currentCall.direction === 'outgoing' && currentCall.targetUserId === targetUserId) {
        // Outgoing call to this target
        console.log('📞 Outgoing call detected');
        setIsIncomingCall(false);
        setCallState(currentCall.state);
      } else {
        // Different call, should not happen but handle it
        console.warn('⚠️  Call mismatch - current call is different from target');
        setCallState('failed');
        setError('Er is al een andere call actief');
      }
    } else {
      // No current call - check if this might be an incoming call that's being processed
      // Wait a bit for WebRTC service to process the incoming offer
      checkTimeout = setTimeout(() => {
        const updatedCall = webrtcService.getCurrentCall();
        if (updatedCall && updatedCall.direction === 'incoming') {
          console.log('✅ Incoming call detected after delay');
          setIsIncomingCall(true);
          setCallState(updatedCall.state);
          // Set roles if not already set
          if (!updatedCall.localRole || !updatedCall.remoteRole) {
            webrtcService.setCallRoles(localRole, remoteRole || 'child');
          }
        } else if (updatedCall && updatedCall.direction === 'outgoing' && updatedCall.targetUserId === targetUserId) {
          // Outgoing call
          console.log('📞 Outgoing call detected after delay');
          setIsIncomingCall(false);
          setCallState(updatedCall.state);
        } else {
          // Start outgoing call
          console.log('📞 Starting OUTGOING call to:', targetUserId);
          setIsIncomingCall(false);
          // Play outgoing call sound
          playOutgoingCallSound();
          const startCall = async () => {
            try {
              setError(null); // Clear any previous errors
              await webrtcService.startCall(targetUserId, localRole, remoteRole);
            } catch (err) {
              console.error('❌ Error starting call:', err);
              setError(err instanceof Error ? err.message : 'Kon call niet starten');
              setCallState('failed');
              stopOutgoingCallSound();
            }
          };
          startCall();
        }
      }, 500); // Wait 500ms for incoming call processing
    }

    return () => {
      unsubscribe();
      unsubscribePermissions();
      window.removeEventListener('call:permission-denied', handlePermissionDenied);
      window.removeEventListener('call:cancelled', handleCallCancelled);
      socketService.off('error', handleError);
      stopOutgoingCallSound();
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
  }, [targetUserId, onEndCall, localRole, remoteRole]);

  // Update video elements when streams change
  useEffect(() => {
    const updateVideos = () => {
      const localStream = webrtcService.getCurrentLocalStream();
      const remoteStream = webrtcService.getCurrentRemoteStream();

      if (localVideoRef.current && localStream) {
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          console.log('✅ Local video stream set', {
            tracks: localStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled }))
          });
        }
      }

      if (remoteVideoRef.current && remoteStream) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          console.log('✅✅✅ Remote video stream set!', {
            tracks: remoteStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })),
            active: remoteStream.active
          });
          
          // Force video to play
          remoteVideoRef.current.play().catch(err => {
            console.error('Error playing remote video:', err);
          });
        }
      } else if (remoteVideoRef.current && !remoteStream) {
        console.log('⚠️  Remote video element exists but no stream');
      }
    };

    updateVideos();
    const interval = setInterval(updateVideos, 500); // Check every 500ms

    return () => {
      clearInterval(interval);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [callState]);

  const handleEndCall = () => {
    console.log('📞 Ending call');
    webrtcService.endCall();
    // Don't call onEndCall immediately - let cleanup handle it
  };

  const handleCancelCall = () => {
    console.log('📞 Canceling call');
    stopOutgoingCallSound();
    webrtcService.cancelCall();
    onEndCall();
  };

  const handleAccept = async () => {
    try {
      stopOutgoingCallSound();
      await webrtcService.acceptCall(localRole, remoteRole);
      // user gesture helps autoplay policies
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.error('Accept error:', e);
      setError(e instanceof Error ? e.message : 'Kon oproep niet accepteren');
      setCallState('failed');
    }
  };

  const handleDecline = () => {
    stopOutgoingCallSound();
    webrtcService.declineCall();
    onEndCall();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* Remote video (main) */}
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000'
          }}
        />
        
        {/* Call status overlay */}
        {callState !== 'active' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: '2rem',
            borderRadius: '12px',
            color: 'white',
            textAlign: 'center',
            zIndex: 1001
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'pulse 1s ease-in-out infinite' }}>
              {callState === 'dialing' && '📞'}
              {callState === 'ringing' && '🔔'}
              {callState === 'failed' && '❌'}
            </div>
            <h2 style={{ marginTop: 0 }}>{targetUserName}</h2>
            <p>
              {callState === 'dialing' && 'Bellen...'}
              {callState === 'ringing' && 'Gaat over...'}
              {callState === 'ended' && 'Gesprek beëindigd'}
              {callState === 'failed' && 'Gesprek mislukt. Probeer opnieuw.'}
            </p>
            {/* Show accept/decline buttons for incoming calls */}
            {isIncomingCall && (callState === 'ringing' || callState === 'idle' || callState === 'dialing') && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                  onClick={handleAccept}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '16px'
                  }}
                >
                  Opnemen
                </button>
                <button
                  onClick={handleDecline}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '16px'
                  }}
                >
                  Weigeren
                </button>
              </div>
            )}
            {callState === 'failed' && (
              <button
                onClick={onEndCall}
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
                Terug
              </button>
            )}
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        {(callState === 'active' || localVideoRef.current?.srcObject) && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '150px',
            height: '200px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '3px solid white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1002
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#333'
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        flexDirection: 'column',
        zIndex: 1003
      }}>
        {/* Cancel button (only for outgoing calls - dialing state) */}
        {callState === 'dialing' && permissions.canCancelCall && (
          <button
            onClick={handleCancelCall}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              backgroundColor: '#f44336',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Annuleren"
          >
            ✕
          </button>
        )}

        {/* End call button (after answer, if allowed) */}
        {callState === 'active' && permissions.canEndCall && (
          <button
            onClick={handleEndCall}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              backgroundColor: '#f44336',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Ophangen"
          >
            📞
          </button>
        )}

        {/* Permission denied message */}
        {callState === 'active' && !permissions.canEndCall && (
          <div style={{
            color: 'white',
            padding: '1rem',
            textAlign: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            maxWidth: '300px'
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {permissions.reason || 'Vraag de ouder om te beëindigen'}
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f44336',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1004,
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center',
          maxWidth: '90%',
          lineHeight: '1.5'
        }}>
          {error}
          {error.includes('slotje') || error.includes('permissie') || error.includes('toegang') ? (
            <div style={{
              marginTop: '0.75rem',
              fontSize: '12px',
              opacity: 0.9,
              fontWeight: '400'
            }}>
              <div>📱 Op iPhone: Instellingen → Safari → Camera/Microfoon</div>
              <div style={{ marginTop: '0.25rem' }}>📱 Op Android: Tik op het slotje 🔒 in de adresbalk</div>
            </div>
          ) : null}
        </div>
      )}

              {/* Debug info */}
              {import.meta.env.DEV && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 1005
        }}>
          State: {callState}<br />
          Target: {targetUserId}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
