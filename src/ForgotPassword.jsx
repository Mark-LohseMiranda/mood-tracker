// src/ForgotPassword.jsx
import { useState } from 'react';
import { forgotPassword, confirmForgotPassword } from './lib/auth';
import './Login.css';

export default function ForgotPassword({ onResetSuccess, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password must contain at least one special character';
    return null;
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setSuccess('Password reset code sent! Please check your email.');
        setShowResetForm(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmForgotPassword(email, verificationCode, newPassword);
      if (result.success) {
        setSuccess('Password reset successful! You can now sign in with your new password.');
        setTimeout(() => onResetSuccess(), 2000);
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showResetForm) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <img src="/logo-min.webp" alt="Mood Tracker" className="auth-logo" />
          <h2>Reset Password</h2>
          <p className="auth-subtitle">Enter the code sent to {email}</p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label htmlFor="verification-code">Verification Code</label>
              <input
                type="text"
                id="verification-code"
                name="verification-code"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter code from email"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                type="password"
                id="new-password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <small style={{ color: '#718096', fontSize: '0.85rem' }}>
                Must be at least 8 characters with uppercase, lowercase, number, and special character
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                type="password"
                id="confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Resetting password...' : 'Reset Password'}
            </button>

            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setShowResetForm(false);
                setVerificationCode('');
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              Back
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
        <h2>Forgot Password?</h2>
        <p className="auth-subtitle">Enter your email to receive a password reset code</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleRequestCode} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Sending code...' : 'Send Reset Code'}
          </button>

          <div className="auth-divider">
            <span>Remember your password?</span>
          </div>

          <button type="button" className="btn-secondary" onClick={onSwitchToLogin}>
            Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
