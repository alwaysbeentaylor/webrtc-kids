import { useState, useEffect } from 'react';
import { familyService } from '../../services/FamilyService';
import { firebaseService } from '../../services/FirebaseService';

interface ChildCodeGeneratorProps {
  familyId: string;
  onCodeGenerated: (code: string, childName: string) => void;
}

export function ChildCodeGenerator({ familyId, onCodeGenerated }: ChildCodeGeneratorProps) {
  const [name, setName] = useState('');
  const [codeType, setCodeType] = useState<'child' | 'parent'>('child');
  const [gender, setGender] = useState<'boy' | 'girl' | null>(null);
  const [parentGender, setParentGender] = useState<'mother' | 'father' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const currentUser = firebaseService.getCurrentUser();
      if (!currentUser) throw new Error('Niet ingelogd');

      const code = await familyService.generateCode(
        familyId,
        name,
        currentUser.uid,
        codeType,
        gender,
        parentGender
      );
      setGeneratedCode(code);
      setCopied(false);
      onCodeGenerated(code, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij genereren code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generatedCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Failed to copy:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleShare = async () => {
    if (!generatedCode || !name) return;

    const shareText = codeType === 'child'
      ? `Hoi ${name}! Je inlogcode is: ${generatedCode}\n\nDeze code is 24 uur geldig.`
      : `Hallo ${name}! Je inlogcode voor ouder is: ${generatedCode}\n\nDeze code is 24 uur geldig.`;

    // Check if Web Share API is available (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Inlogcode voor ${name}`,
          text: shareText
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copy to clipboard with message
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        handleCopy(); // Fallback to just copying the code
      }
    }
  };

  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.95)',
      padding: '2rem',
      borderRadius: '20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      maxWidth: '500px',
      width: '100%',
      marginBottom: '2rem',
      backdropFilter: 'blur(10px)'
    }}>
      <h2 style={{ marginTop: 0, color: '#333', fontSize: '1.5rem' }}>
        {codeType === 'child' ? '👶 Kind toevoegen' : '👨‍👩‍👧 Ouder toevoegen'}
      </h2>
      
      <form onSubmit={handleGenerate}>
        {/* Code Type Selection */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Type account
          </label>
          <div style={{
            display: 'flex',
            gap: '0.75rem'
          }}>
            <button
              type="button"
              onClick={() => {
                setCodeType('child');
                setGender(null); // Reset gender when switching
                setParentGender(null);
              }}
              disabled={loading || !!generatedCode}
              style={{
                flex: 1,
                padding: '12px',
                border: `2px solid ${codeType === 'child' ? '#2196F3' : '#ddd'}`,
                borderRadius: '8px',
                backgroundColor: codeType === 'child' ? 'rgba(33, 150, 243, 0.1)' : 'white',
                cursor: (loading || !!generatedCode) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: codeType === 'child' ? '600' : '400',
                color: codeType === 'child' ? '#2196F3' : '#666',
                transition: 'all 0.2s',
                opacity: (loading || !!generatedCode) ? 0.6 : 1
              }}
            >
              👶 Kind
            </button>
            <button
              type="button"
              onClick={() => {
                setCodeType('parent');
                setGender(null); // Reset gender when switching
                setParentGender(null);
              }}
              disabled={loading || !!generatedCode}
              style={{
                flex: 1,
                padding: '12px',
                border: `2px solid ${codeType === 'parent' ? '#9C27B0' : '#ddd'}`,
                borderRadius: '8px',
                backgroundColor: codeType === 'parent' ? 'rgba(156, 39, 176, 0.1)' : 'white',
                cursor: (loading || !!generatedCode) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: codeType === 'parent' ? '600' : '400',
                color: codeType === 'parent' ? '#9C27B0' : '#666',
                transition: 'all 0.2s',
                opacity: (loading || !!generatedCode) ? 0.6 : 1
              }}
            >
              👨‍👩‍👧 Ouder
            </button>
          </div>
          {codeType === 'parent' && (
            <p style={{
              marginTop: '0.5rem',
              fontSize: '12px',
              color: '#999',
              marginBottom: 0
            }}>
              Maximaal 2 ouders per gezin
            </p>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            {codeType === 'child' ? 'Naam van het kind' : 'Naam van de ouder'}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading || !!generatedCode}
            placeholder={codeType === 'child' ? 'Bijvoorbeeld: Emma' : 'Bijvoorbeeld: Papa'}
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

        {codeType === 'child' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Geslacht (optioneel)
            </label>
            <div style={{
              display: 'flex',
              gap: '0.75rem'
            }}>
              <button
                type="button"
                onClick={() => setGender(gender === 'boy' ? null : 'boy')}
                disabled={loading || !!generatedCode}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${gender === 'boy' ? '#2196F3' : '#ddd'}`,
                  borderRadius: '8px',
                  backgroundColor: gender === 'boy' ? 'rgba(33, 150, 243, 0.1)' : 'white',
                  cursor: (loading || !!generatedCode) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: gender === 'boy' ? '600' : '400',
                  color: gender === 'boy' ? '#2196F3' : '#666',
                  transition: 'all 0.2s',
                  opacity: (loading || !!generatedCode) ? 0.6 : 1
                }}
              >
                👦 Jongen
              </button>
              <button
                type="button"
                onClick={() => setGender(gender === 'girl' ? null : 'girl')}
                disabled={loading || !!generatedCode}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${gender === 'girl' ? '#E91E63' : '#ddd'}`,
                  borderRadius: '8px',
                  backgroundColor: gender === 'girl' ? 'rgba(233, 30, 99, 0.1)' : 'white',
                  cursor: (loading || !!generatedCode) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: gender === 'girl' ? '600' : '400',
                  color: gender === 'girl' ? '#E91E63' : '#666',
                  transition: 'all 0.2s',
                  opacity: (loading || !!generatedCode) ? 0.6 : 1
                }}
              >
                👧 Meisje
              </button>
            </div>
            <p style={{
              marginTop: '0.5rem',
              fontSize: '12px',
              color: '#999',
              marginBottom: 0
            }}>
              Als je geen geslacht kiest, worden de initialen van het kind getoond
            </p>
          </div>
        )}

        {codeType === 'parent' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Geslacht mede-ouder (optioneel)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setParentGender(parentGender === 'mother' ? null : 'mother')}
                disabled={loading || !!generatedCode}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${parentGender === 'mother' ? '#E91E63' : '#ddd'}`,
                  borderRadius: '8px',
                  backgroundColor: parentGender === 'mother' ? 'rgba(233, 30, 99, 0.1)' : 'white',
                  cursor: (loading || !!generatedCode) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: parentGender === 'mother' ? '600' : '400',
                  color: parentGender === 'mother' ? '#E91E63' : '#666',
                  transition: 'all 0.2s',
                  opacity: (loading || !!generatedCode) ? 0.6 : 1
                }}
              >
                👩 Mama
              </button>
              <button
                type="button"
                onClick={() => setParentGender(parentGender === 'father' ? null : 'father')}
                disabled={loading || !!generatedCode}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${parentGender === 'father' ? '#2196F3' : '#ddd'}`,
                  borderRadius: '8px',
                  backgroundColor: parentGender === 'father' ? 'rgba(33, 150, 243, 0.1)' : 'white',
                  cursor: (loading || !!generatedCode) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: parentGender === 'father' ? '600' : '400',
                  color: parentGender === 'father' ? '#2196F3' : '#666',
                  transition: 'all 0.2s',
                  opacity: (loading || !!generatedCode) ? 0.6 : 1
                }}
              >
                👨 Papa
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '12px', color: '#999', marginBottom: 0 }}>
              Zo kan een kind twee mama’s of twee papa’s hebben (maximaal 2 ouders).
            </p>
          </div>
        )}

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

        {generatedCode && (
          <div style={{
            background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
            padding: '1.5rem',
            borderRadius: '16px',
            marginBottom: '1rem',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(76, 175, 80, 0.3)',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
              Code voor {name}:
            </p>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
              wordBreak: 'break-all',
              overflowWrap: 'break-word'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: isMobile ? '28px' : '36px', 
                fontWeight: 'bold', 
                letterSpacing: isMobile ? '4px' : '8px',
                fontFamily: 'monospace',
                color: 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                lineHeight: '1.2'
              }}>
                {generatedCode}
              </p>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
              ⏰ Deze code is 24 uur geldig.
            </p>
            
            {/* Copy and Share buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '12px 20px',
                  backgroundColor: copied ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255,255,255,0.25)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = copied ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255,255,255,0.25)';
                }}
              >
                {copied ? '✅ Gekopieerd!' : '📋 Kopieer'}
              </button>
              
              <button
                type="button"
                onClick={handleShare}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '12px 20px',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)';
                }}
              >
                📤 Deel
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !!generatedCode || !name.trim()}
          style={{
            width: '100%',
            padding: '14px',
            background: generatedCode 
              ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
              : 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: (loading || !!generatedCode || !name.trim()) ? 'not-allowed' : 'pointer',
            opacity: (loading || !!generatedCode || !name.trim()) ? 0.6 : 1,
            boxShadow: (loading || !!generatedCode || !name.trim()) 
              ? 'none' 
              : '0 4px 12px rgba(33, 150, 243, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            transform: 'scale(1)'
          }}
        >
          {loading ? '⏳ Aanmaken...' : generatedCode ? '✅ Code gegenereerd!' : '✨ Code genereren'}
        </button>
      </form>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}

