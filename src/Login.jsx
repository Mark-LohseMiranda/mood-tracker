// src/Login.jsx
import { useState, useRef, useEffect } from 'react';
import { signIn, verifyMFA } from './lib/auth';
import './Login.css';

export default function Login({ onLoginSuccess, onSwitchToSignUp, onSwitchToForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [mfaSession, setMfaSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preventAutoSubmit, setPreventAutoSubmit] = useState(false);
  const mfaInputRef = useRef(null);
  const formRef = useRef(null);

  // Auto-submit when 6 digits entered for MFA
  useEffect(() => {
    if (mfaCode.length === 6 && mfaSession) {
      handleMFASubmit(new Event('submit'));
    }
  }, [mfaCode]);

  // Detect autofill and auto-submit after a brief delay
  useEffect(() => {
    const form = formRef.current;
    if (!form || showMFA || preventAutoSubmit) return;

    let autoFillTimer;
    let changeTimer;
    
    const handleAnimationStart = (e) => {
      // Chrome/Edge autofill detection
      if (e.animationName === 'onAutoFillStart') {
        autoFillTimer = setTimeout(() => {
          if (email && password && !preventAutoSubmit) {
            form.requestSubmit();
          }
        }, 500);
      }
    };

    // iOS Safari autofill detection - uses input/change events
    const handleInputChange = () => {
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        if (email && password && !preventAutoSubmit && !loading) {
          form.requestSubmit();
        }
      }, 800); // Longer delay for iOS to ensure both fields populated
    };

    form.addEventListener('animationstart', handleAnimationStart);
    form.addEventListener('input', handleInputChange);
    form.addEventListener('change', handleInputChange);

    return () => {
      form.removeEventListener('animationstart', handleAnimationStart);
      form.removeEventListener('input', handleInputChange);
      form.removeEventListener('change', handleInputChange);
      if (autoFillTimer) clearTimeout(autoFillTimer);
      if (changeTimer) clearTimeout(changeTimer);
    };
  }, [email, password, showMFA, preventAutoSubmit, loading]);

  // Auto-focus and trigger 1Password autofill on MFA screen
  useEffect(() => {
    if (showMFA && mfaInputRef.current) {
      // Focus the input
      mfaInputRef.current.focus();
      
      // Trigger input event to make 1Password recognize the field
      setTimeout(() => {
        if (mfaInputRef.current) {
          const event = new Event('input', { bubbles: true });
          mfaInputRef.current.dispatchEvent(event);
        }
      }, 100);
    }
  }, [showMFA]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Store username temporarily for MFA flow
      localStorage.setItem('temp_username', email);
      
      const result = await signIn(email, password);

      if (result.challengeName === 'SOFTWARE_TOKEN_MFA') {
        setMfaSession(result.session);
        setShowMFA(true);
      } else if (result.success) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMFASubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await verifyMFA(mfaSession, mfaCode);
      if (result.success) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Invalid MFA code. Please try again.');
      setMfaCode(''); // Clear code on error
      mfaInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleMfaCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setMfaCode(value);
  };

  if (showMFA) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <img src="/logo-min.webp" alt="Mood Tracker" className="auth-logo" />
          <h2>Two-Factor Authentication</h2>
          <p className="auth-subtitle">Open your authenticator app and enter the 6-digit code</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleMFASubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="totp">Authentication Code</label>
              <input
                ref={mfaInputRef}
                type="text"
                id="totp"
                name="totp"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={handleMfaCodeChange}
                placeholder="••••••"
                required
                autoFocus
                style={{ 
                  fontSize: '1.5rem', 
                  letterSpacing: '0.5rem', 
                  textAlign: 'center',
                  fontFamily: 'monospace'
                }}
              />
              <small style={{ color: '#718096', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                💡 Code auto-submits when complete
              </small>
            </div>

            <button type="submit" className="btn-primary" disabled={loading || mfaCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setShowMFA(false);
                setMfaCode('');
                setMfaSession(null);
                setEmail('');
                setPassword('');
                setError('');
                setPreventAutoSubmit(true);
                // Re-enable auto-submit after a delay
                setTimeout(() => setPreventAutoSubmit(false), 1000);
              }}
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <img src="/logo-min.webp" alt="Mood Tracker" className="auth-logo" />
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to track your mood</p>

        {error && <div className="error-message">{error}</div>}

        <form ref={formRef} onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Email</label>
            <input
              type="email"
              id="username"
              name="username"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="auth-links">
            <button type="button" className="btn-link" onClick={onSwitchToForgotPassword}>
              Forgot password?
            </button>
          </div>

          <div className="auth-divider">
            <span>Don't have an account?</span>
          </div>

          <button type="button" className="btn-secondary" onClick={onSwitchToSignUp}>
            Create Account
          </button>
        </form>

        <div className="auth-footer">
          <p>
            <strong>Note:</strong> This app is not intended for medical use. Please consult a 
            healthcare professional for any mental health concerns.
          </p>
        </div>
      </div>
    </div>
  );
}
