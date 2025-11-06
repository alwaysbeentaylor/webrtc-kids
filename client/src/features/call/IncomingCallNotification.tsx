import { useState, useEffect } from 'react';
import { webrtcService } from '../../services/WebRTCService';
import { socketService } from '../../services/SocketService';

interface IncomingCallNotificationProps {
  fromUserId: string;
  fromUserName: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallNotification({ fromUserId: _fromUserId, fromUserName, onAccept, onReject }: IncomingCallNotificationProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '20px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animation: 'pulse 1s ease-in-out infinite'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem'
        }}>
          📞
        </div>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Inkomende oproep</h2>
        <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
          {fromUserName} belt je
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={onAccept}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#4CAF50',
              border: 'none',
              color: 'white',
              fontSize: '32px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            ✓
          </button>
          <button
            onClick={onReject}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#f44336',
              border: 'none',
              color: 'white',
              fontSize: '32px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

export function useIncomingCall() {
  const [incomingCall, setIncomingCall] = useState<{ fromUserId: string; fromUserName: string } | null>(null);

  useEffect(() => {
    const handleIncomingOffer = async (data: { fromUserId: string; offer: RTCSessionDescriptionInit; targetUserId: string }) => {
      // Check if we're already in a call
      if (webrtcService.getCurrentCall()) {
        console.log('Already in call, rejecting incoming');
        return;
      }

      // Get user name from family service (we'll need to import this)
      // For now, use userId as fallback
      setIncomingCall({
        fromUserId: data.fromUserId,
        fromUserName: data.fromUserId // Will be replaced with actual name
      });
    };

    socketService.on('call:offer', handleIncomingOffer);

    return () => {
      socketService.off('call:offer', handleIncomingOffer);
    };
  }, []);

  const acceptCall = () => {
    if (incomingCall) {
      // The WebRTCService will handle the offer automatically
      // We just need to trigger it
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      webrtcService.endCall();
      setIncomingCall(null);
    }
  };

  return { incomingCall, acceptCall, rejectCall };
}




