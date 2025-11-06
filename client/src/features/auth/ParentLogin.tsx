import { useState } from 'react';
import { firebaseService } from '../../services/FirebaseService';

type Mode = 'login' | 'register';

export function ParentLogin() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentGender, setParentGender] = useState<'mother' | 'father'>('mother');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        await firebaseService.registerParent(email, password);
        // Store chosen parent gender locally; App will read it during family initialization
        localStorage.setItem('parent_gender_choice', parentGender);
        setSuccessMessage('Account aangemaakt! Controleer je email voor verificatie.');
        setEmail('');
        setPassword('');
      } else {
        await firebaseService.loginParent(email, password);
        // Check if email is verified
        if (!firebaseService.isEmailVerified()) {
          await firebaseService.logout();
          setError('Je email is nog niet geverifieerd. Controleer je inbox en klik op de verificatie link.');
          setSuccessMessage('We hebben een nieuwe verificatie email gestuurd.');
          await firebaseService.resendVerificationEmail();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Er is iets misgegaan';
      
      // Check if Firebase is not configured
      if (errorMessage.includes('api-key') || errorMessage.includes('API key') || 
          errorMessage.includes('invalid') && errorMessage.includes('key')) {
        setError('Firebase is niet geconfigureerd! Vul je .env bestand in met je Firebase configuratie. Zie FIREBASE_SETUP_GUIDE.md voor instructies.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: '400px',
      margin: '0 auto'
    }}>
        <h1 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
          {mode === 'login' ? 'Inloggen' : 'Registreren'}
        </h1>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            backgroundColor: '#efe',
            color: '#3c3',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '14px'
          }}>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Ik ben
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setParentGender('mother')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${parentGender === 'mother' ? '#E91E63' : '#ddd'}`,
                    borderRadius: '8px',
                    backgroundColor: parentGender === 'mother' ? 'rgba(233,30,99,0.1)' : 'white',
                    cursor: 'pointer',
                    fontWeight: parentGender === 'mother' ? 600 : 400,
                    color: parentGender === 'mother' ? '#E91E63' : '#666'
                  }}
                >
                  👩 Mama
                </button>
                <button
                  type="button"
                  onClick={() => setParentGender('father')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${parentGender === 'father' ? '#2196F3' : '#ddd'}`,
                    borderRadius: '8px',
                    backgroundColor: parentGender === 'father' ? 'rgba(33,150,243,0.1)' : 'white',
                    cursor: 'pointer',
                    fontWeight: parentGender === 'father' ? 600 : 400,
                    color: parentGender === 'father' ? '#2196F3' : '#666'
                  }}
                >
                  👨 Papa
                </button>
              </div>
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Bezig...' : (mode === 'login' ? 'Inloggen' : 'Account aanmaken')}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
              setSuccessMessage(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#4CAF50',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px'
            }}
          >
            {mode === 'login' ? 'Nog geen account? Registreer hier' : 'Al een account? Log hier in'}
          </button>
        </div>
    </div>
  );
}

