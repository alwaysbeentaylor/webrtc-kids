import { useState } from 'react';
import { familyService } from '../../services/FamilyService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface ChildCodeLoginProps {
  onLoginSuccess: (userId: string, name: string, familyId: string, role: 'child' | 'parent') => void;
}

export function ChildCodeLogin({ onLoginSuccess }: ChildCodeLoginProps) {
  const [code, setCode] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [email, setEmail] = useState(''); // For parent codes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeType, setCodeType] = useState<'child' | 'parent' | null>(null); // Detect code type

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only single digit
    
    const newDigits = [...codeDigits];
    newDigits[index] = value.replace(/[^0-9]/g, ''); // Only numbers
    
    setCodeDigits(newDigits);
    const fullCode = newDigits.join('');
    setCode(fullCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (fullCode.length === 6) {
      handleSubmit(fullCode);
    }
  };

  const handleSubmit = async (submitCode?: string) => {
    const codeToSubmit = submitCode || code;
    if (codeToSubmit.length !== 6) {
      setError('Voer een 6-cijferige code in');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // First, check what type of code this is
      const codeRef = doc(db, 'childCodes', codeToSubmit);
      const codeDoc = await getDoc(codeRef);

      if (!codeDoc.exists()) {
        throw new Error('Code niet gevonden');
      }

      const codeData = codeDoc.data();
      const detectedType = codeData.codeType || 'child';

      // If parent code, require email
      if (detectedType === 'parent' && !email.trim()) {
        setCodeType('parent');
        setError('Voer je email adres in voor ouder account');
        setLoading(false);
        return;
      }

      // Redeem the code
      const result = await familyService.redeemCode(codeToSubmit, email.trim() || undefined);
      
      if (result.role === 'child') {
        // Create child session
        localStorage.setItem('childSession', JSON.stringify({
          userId: result.userId,
          childName: result.name,
          familyId: result.familyId,
          role: 'child'
        }));
      } else {
        // For parent, we need Firebase auth - but for now, store in session
        // In production, this should trigger Firebase auth flow
        localStorage.setItem('parentCodeSession', JSON.stringify({
          userId: result.userId,
          name: result.name,
          familyId: result.familyId,
          role: 'parent',
          email: email.trim()
        }));
      }

      onLoginSuccess(result.userId, result.name, result.familyId, result.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code is ongeldig');
      setCodeDigits(['', '', '', '', '', '']);
      setCode('');
      setCodeType(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '3rem 2rem',
      borderRadius: '20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      maxWidth: '450px',
      width: '100%'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          {codeType === 'parent' ? '👨‍👩‍👧' : '👶'}
        </div>
        <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'white', fontSize: '2rem', fontWeight: '700' }}>
          Log in met code
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>
          {codeType === 'parent' 
            ? 'Voer je email adres in' 
            : 'Vraag je code aan papa of mama'}
        </p>
      </div>

      {codeType === 'parent' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', color: 'white', fontWeight: '500' }}>
            Email adres
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="bijvoorbeeld: papa@email.com"
            style={{
              width: '100%',
              padding: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '12px',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'rgba(255,255,255,0.95)',
              color: '#333'
            }}
          />
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(244, 67, 54, 0.9)',
          color: 'white',
          padding: '14px',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          fontSize: '14px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        marginBottom: '2rem'
      }}>
        {codeDigits.map((digit, index) => (
          <input
            key={index}
            id={`code-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleCodeChange(index, e.target.value)}
            disabled={loading}
            style={{
              width: '55px',
              height: '70px',
              textAlign: 'center',
              fontSize: '28px',
              fontWeight: 'bold',
              border: digit ? '3px solid #4CAF50' : '3px solid rgba(255,255,255,0.3)',
              borderRadius: '12px',
              boxSizing: 'border-box',
              backgroundColor: 'rgba(255,255,255,0.95)',
              color: '#333',
              transition: 'border-color 0.2s, transform 0.2s',
              transform: digit ? 'scale(1.05)' : 'scale(1)'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digit && index > 0) {
                const prevInput = document.getElementById(`code-${index - 1}`);
                prevInput?.focus();
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#2196F3';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = e.currentTarget.value ? '#4CAF50' : 'rgba(255,255,255,0.3)';
              e.currentTarget.style.transform = e.currentTarget.value ? 'scale(1.05)' : 'scale(1)';
            }}
          />
        ))}
      </div>

      <button
        onClick={() => handleSubmit()}
        disabled={loading || code.length !== 6}
        style={{
          width: '100%',
          padding: '16px',
          background: (loading || code.length !== 6)
            ? 'linear-gradient(135deg, #ccc 0%, #999 100%)'
            : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '18px',
          fontWeight: '700',
          cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
          opacity: (loading || code.length !== 6) ? 0.6 : 1,
          boxShadow: (loading || code.length !== 6)
            ? 'none'
            : '0 6px 20px rgba(76, 175, 80, 0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: 'scale(1)'
        }}
        onMouseEnter={(e) => {
          if (!(loading || code.length !== 6)) {
            e.currentTarget.style.transform = 'scale(1.02)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {loading ? '⏳ Inloggen...' : '🚀 Inloggen'}
      </button>
    </div>
  );
}

