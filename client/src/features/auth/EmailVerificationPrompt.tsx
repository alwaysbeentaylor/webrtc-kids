import { useState } from 'react';
import { firebaseService } from '../../services/FirebaseService';

export function EmailVerificationPrompt() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await firebaseService.resendVerificationEmail();
      setSent(true);
    } catch (error) {
      alert('Kon verificatie email niet verzenden: ' + (error instanceof Error ? error.message : 'Onbekende fout'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      maxWidth: '500px',
      textAlign: 'center',
      width: '100%'
    }}>
        <h1 style={{ color: '#333', marginTop: 0 }}>Email verificatie vereist</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Je moet je email adres verifiëren voordat je de app kunt gebruiken.
          Controleer je inbox en klik op de verificatie link.
        </p>
        {sent && (
          <p style={{ color: '#4CAF50', marginBottom: '1rem' }}>
            ✓ Een nieuwe verificatie email is verzonden!
          </p>
        )}
        <button
          onClick={handleResend}
          disabled={sending}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.6 : 1
          }}
        >
          {sending ? 'Verzenden...' : 'Verstuur verificatie email opnieuw'}
        </button>
        <p style={{ marginTop: '1.5rem', fontSize: '14px', color: '#999' }}>
          Na verificatie, ververs de pagina om verder te gaan.
        </p>
      </div>
    );
}

