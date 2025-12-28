import { useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import './AccountSettings.css';
import { getStoredDeviceKey, isStoredDeviceRemembered, removeStoredDeviceKey, setStoredDeviceRemembered, isNeverRememberDevice, setNeverRememberDevice, setStoredDeviceKey, rememberDeviceBackend } from './lib/auth';

function AccountSettings() {
  const { user, getIdToken, getAccessToken, refreshUserInfo, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: '',
    picture: ''
  });
  const [originalProfile, setOriginalProfile] = useState({
    name: '',
    picture: ''
  });
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedUploadedPicture, setUnsavedUploadedPicture] = useState(null);
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // MFA state
  const [mfaStatus, setMfaStatus] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState('');

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (activeTab === 'mfa') {
      checkMFAStatus();
    } else if (activeTab === 'profile') {
      loadUserProfile();
    } else if (activeTab === 'devices') {
      loadDevices();
    }
  }, [activeTab]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const cognitoRequest = async (target, body) => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetch(`https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`
      },
      body: JSON.stringify({ AccessToken: accessToken, ...body })
    });

    // Some Cognito operations return empty responses
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    
    if (!response.ok) {
      throw new Error(data.message || data.__type || 'Request failed');
    }
    return data;
  };

  // Load User Profile
  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const data = await cognitoRequest('GetUser', {});
      const attributes = {};
      data.UserAttributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
      
      const profile = {
        name: attributes.name || '',
        picture: attributes.picture || ''
      };
      
      setProfileForm(profile);
      setOriginalProfile(profile);
      setHasUnsavedChanges(false);
    } catch (error) {
      showMessage('error', error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Check for unsaved changes
  useEffect(() => {
    const changed = profileForm.name !== originalProfile.name || profileForm.picture !== originalProfile.picture;
    setHasUnsavedChanges(changed);
  }, [profileForm, originalProfile]);

  // Custom navigation blocker for unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Push a dummy state to enable popstate blocking
    window.history.pushState(null, '', window.location.href);

    const handleClick = (e) => {
      // Check if clicked element is a link
      const link = e.target.closest('a');
      if (link && link.href && !link.href.includes('#')) {
        const shouldLeave = window.confirm(
          'You have unsaved changes. Are you sure you want to leave?'
        );
        if (!shouldLeave) {
          e.preventDefault();
          e.stopPropagation();
        } else if (unsavedUploadedPicture) {
          deleteUnsavedPicture(unsavedUploadedPicture);
        }
      }
    };

    const handlePopState = (e) => {
      const shouldLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!shouldLeave) {
        // Push state again to prevent navigation
        window.history.pushState(null, '', window.location.href);
      } else if (unsavedUploadedPicture) {
        deleteUnsavedPicture(unsavedUploadedPicture);
      }
    };

    // Intercept link clicks
    document.addEventListener('click', handleClick, true);
    // Intercept back/forward navigation
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges, unsavedUploadedPicture]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        // Note: We can't delete the picture here because the request might not complete
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Delete unsaved uploaded picture
  const deleteUnsavedPicture = async (pictureUrl) => {
    try {
      // Extract the key from the URL and delete it
      const token = await getIdToken();
      // We'll need a new endpoint to delete a specific picture
      await fetch(
        `${import.meta.env.VITE_API_URL}/profile/picture?url=${encodeURIComponent(pictureUrl)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('Deleted unsaved picture:', pictureUrl);
    } catch (error) {
      console.error('Failed to delete unsaved picture:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'Image must be less than 5MB');
      return;
    }

    setUploadingPicture(true);
    try {
      // Get presigned upload URL (and delete old picture if exists)
      const token = await getIdToken();
      let url = `${import.meta.env.VITE_API_URL}/profile/picture-upload-url?fileType=${encodeURIComponent(file.type)}`;
      if (profileForm.picture) {
        url += `&oldPictureUrl=${encodeURIComponent(profileForm.picture)}`;
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to get upload URL');

      const { uploadUrl, publicUrl } = await response.json();

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload image');

      // Update profile form with new picture URL
      setProfileForm({ ...profileForm, picture: publicUrl });
      // Track this as unsaved so we can delete it if user navigates away
      setUnsavedUploadedPicture(publicUrl);
      showMessage('success', 'Image uploaded successfully. Click "Update Profile" to save.');
    } catch (error) {
      showMessage('error', error.message || 'Failed to upload image');
    } finally {
      setUploadingPicture(false);
    }
  };

  // Update Profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userAttributes = [];
      
      if (profileForm.name) {
        userAttributes.push({ Name: 'name', Value: profileForm.name });
      }
      if (profileForm.picture) {
        userAttributes.push({ Name: 'picture', Value: profileForm.picture });
      }

      await cognitoRequest('UpdateUserAttributes', {
        UserAttributes: userAttributes
      });

      showMessage('success', 'Profile updated successfully');
      // Update original profile and clear unsaved changes
      setOriginalProfile({ ...profileForm });
      setHasUnsavedChanges(false);
      setUnsavedUploadedPicture(null);
      // Refresh user info in AuthContext to update header
      await refreshUserInfo();
    } catch (error) {
      showMessage('error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showMessage('error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await cognitoRequest('ChangePassword', {
        PreviousPassword: passwordForm.currentPassword,
        ProposedPassword: passwordForm.newPassword
      });

      showMessage('success', 'Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      showMessage('error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // Check MFA Status
  const checkMFAStatus = async () => {
    setLoading(true);
    try {
      const data = await cognitoRequest('GetUser', {});
      const mfaOptions = data.UserMFASettingList || [];
      
      setMfaStatus({
        enabled: mfaOptions.length > 0,
        methods: mfaOptions
      });
    } catch (error) {
      showMessage('error', error.message || 'Failed to check MFA status');
    } finally {
      setLoading(false);
    }
  };

  // Setup TOTP MFA
  const setupTOTP = async () => {
    setLoading(true);
    try {
      const data = await cognitoRequest('AssociateSoftwareToken', {});
      const secret = data.SecretCode;
      setSecretKey(secret);
      
      // Generate QR code URL
      const email = user.email;
      const issuer = 'MoodTracker';
      const qrUrl = `otpauth://totp/${issuer}:${email}?secret=${secret}&issuer=${issuer}`;
      setQrCode(qrUrl);
      
      showMessage('success', 'Scan the QR code with your authenticator app');
    } catch (error) {
      showMessage('error', error.message || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  // Verify TOTP
  const verifyTOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await cognitoRequest('VerifySoftwareToken', {
        UserCode: totpCode
      });
      
      // Set TOTP as preferred MFA
      await cognitoRequest('SetUserMFAPreference', {
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true
        }
      });

      showMessage('success', 'MFA enabled successfully');
      setQrCode('');
      setSecretKey('');
      setTotpCode('');
      checkMFAStatus();
    } catch (error) {
      showMessage('error', error.message || 'Failed to verify MFA code');
    } finally {
      setLoading(false);
    }
  };

  // Disable MFA
  const disableMFA = async () => {
    if (!confirm('Are you sure you want to disable MFA?')) return;
    
    setLoading(true);
    try {
      await cognitoRequest('SetUserMFAPreference', {
        SoftwareTokenMfaSettings: {
          Enabled: false,
          PreferredMfa: false
        }
      });

      showMessage('success', 'MFA disabled successfully');
      checkMFAStatus();
    } catch (error) {
      showMessage('error', error.message || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  // Delete profile picture
  const handleDeleteProfilePicture = async () => {
    if (!profileForm.picture) return;
    if (!confirm('Are you sure you want to delete your profile picture?')) return;

    setLoading(true);
    try {
      const token = await getIdToken();
      
      // Delete from S3
      const deleteResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/profile/picture?url=${encodeURIComponent(profileForm.picture)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!deleteResponse.ok) throw new Error('Failed to delete picture');

      // Update Cognito to remove picture attribute
      await cognitoRequest('UpdateUserAttributes', {
        UserAttributes: [
          { Name: 'picture', Value: '' }
        ]
      });

      // Clear picture from form and original profile
      setProfileForm({ ...profileForm, picture: '' });
      setOriginalProfile({ ...originalProfile, picture: '' });
      setUnsavedUploadedPicture(null);
      // Refresh user info in AuthContext to update header
      await refreshUserInfo();
      showMessage('success', 'Profile picture deleted successfully');
    } catch (error) {
      showMessage('error', error.message || 'Failed to delete picture');
    } finally {
      setLoading(false);
    }
  };

  // Devices management
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [localDeviceKeyState, setLocalDeviceKeyState] = useState('-');
  const [localDeviceRememberedState, setLocalDeviceRememberedState] = useState(false);
  const [localNeverRememberState, setLocalNeverRememberState] = useState(false);
  const [showRememberNowModal, setShowRememberNowModal] = useState(false);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      // Try ID token first, fall back to access token if needed
      let token = null;
      let used = null;
      try {
        token = await getIdToken();
        used = token ? 'id' : null;
      } catch (e) { token = null; }
      if (!token) {
        try { token = await getAccessToken(); used = token ? 'access' : null; } catch (e) { token = null; }
      }

      // Record token info for debugging (masked)
      try {
        if (token) {
          const masked = token.substring(0, 8) + '…' + token.substring(token.length - 8);
          // Try to decode JWT payload safely
          let tokenUse = null;
          try {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            tokenUse = payload.token_use || payload.tokenUse || null;
          } catch (e) { tokenUse = null; }
          setTokenInfo({ which: used, masked, tokenUse });
        } else {
          setTokenInfo({ which: null, masked: null, tokenUse: null });
        }
      } catch (e) { setTokenInfo(null); }

      if (!token) {
        throw new Error('Not authenticated — missing token');
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/device/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Always attempt to parse JSON to surface backend messages
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If backend says unauthorized, suggest re-authentication
        if (data.error === 'Unauthorized' || data.message === 'Unauthorized') {
          showMessage('error', 'Unable to load devices (unauthorized). Try signing out and signing in again.');
          console.error('Device list unauthorized response:', data);
          setDevices([]);
          return;
        }
        throw new Error(data.error || data.message || 'Failed to fetch devices');
      }

      // Successful response
      setDevices(data.devices || []);
    } catch (error) {
      showMessage('error', error.message || 'Failed to load devices');
    } finally {
      setLoadingDevices(false);
    }
  };

  // Load user info and device list when tab changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user) return;
        const k = await getStoredDeviceKey(user.email);
        const remembered = await isStoredDeviceRemembered(user.email);
        const never = await isNeverRememberDevice(user.email);
        if (!mounted) return;
        setLocalDeviceKeyState(k || '-');
        setLocalDeviceRememberedState(!!remembered);
        setLocalNeverRememberState(!!never);
      } catch (e) {
        if (!mounted) return;
        setLocalDeviceKeyState('-');
        setLocalDeviceRememberedState(false);
        setLocalNeverRememberState(false);
      }
    })();
    return () => { mounted = false; };
  }, [user, devices]);

  const handleForgetDevice = async (deviceKey) => {
    if (!confirm('Forget this device? The user will need to re-authenticate on it.')) return;
    setLoadingDevices(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/device/forget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceKey })
      });
      if (!res.ok) throw new Error('Failed to forget device');
      showMessage('success', 'Device forgotten');
      // Remove local deviceKey if matches
      try {
        await removeStoredDeviceKey(user.email);
        await setStoredDeviceRemembered(user.email, false);
      } catch (e) {}
      await loadDevices();
    } catch (error) {
      showMessage('error', error.message || 'Failed to forget device');
    } finally {
      setLoadingDevices(false);
    }
  };

  // Removed toggle remember action; only "Forget" remains in device list.

  // Get initial for profile avatar
  const getInitial = () => {
    const name = profileForm.name || user.name || user.email || '?';
    return name.charAt(0).toUpperCase();
  };

  // Delete Account
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    
    if (deleteConfirmation !== 'DELETE') {
      showMessage('error', 'Please type DELETE to confirm');
      return;
    }

    if (!confirm('This action cannot be undone. Are you absolutely sure you want to delete your account and all your data?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const token = await getIdToken();
      
      // First, delete all user data (S3 and DynamoDB) via Lambda
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/account`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('Lambda response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to delete account data';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const deleteResponse = await response.json();

      // Then delete the Cognito user directly from frontend
      await cognitoRequest('DeleteUser', {});

      // Clean up all auth state (IndexedDB, localStorage, sessionStorage)
      // Remove any local device sentinels/keys before signing out
        try {
        await removeStoredDeviceKey(user.email);
        await setStoredDeviceRemembered(user.email, false);
        localStorage.removeItem('new_device_metadata');
        localStorage.removeItem('temp_username');
      } catch (e) {}

      await signOut();
      
      // Show success message
      showMessage('success', 'Account deleted successfully');
      
      // Redirect to home page
      setTimeout(() => {
        window.location.href = 'https://myemtee.com';
      }, 2000);
    } catch (error) {
      console.error('Delete account error:', error);
      showMessage('error', error.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="account-settings">
      <button onClick={() => navigate('/')} className="back-button">
        ← Back to Home
      </button>
      <h2>Account Settings</h2>
      
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={activeTab === 'password' ? 'active' : ''}
          onClick={() => setActiveTab('password')}
        >
          Change Password
        </button>
        <button
          className={activeTab === 'mfa' ? 'active' : ''}
          onClick={() => setActiveTab('mfa')}
        >
          Multi-Factor Authentication
        </button>
        <button
          className={activeTab === 'devices' ? 'active' : ''}
          onClick={() => setActiveTab('devices')}
        >
          Devices
        </button>
        <button
          className={activeTab === 'delete' ? 'active' : ''}
          onClick={() => setActiveTab('delete')}
        >
          Delete Account
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'profile' && (
          <div className="profile-section">
            <h3>Profile Information</h3>
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div className="form-group">
                <label>Profile Picture</label>
                {profileForm.picture && (
                  <div className="profile-picture-container">
                    <div className="profile-picture-preview">
                      <img 
                        src={profileForm.picture} 
                        alt="Profile preview" 
                        className="profile-picture-img"
                        onError={(e) => {
                          e.target.parentElement.style.display = 'none';
                        }}
                      />
                      <button 
                        type="button"
                        onClick={handleDeleteProfilePicture}
                        className="delete-picture-btn"
                        disabled={loading}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploadingPicture}
                  style={{ marginTop: '1rem' }}
                />
                <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
                  Max 5MB, image files only
                </small>
                {uploadingPicture && <p>Uploading...</p>}
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className={hasUnsavedChanges ? 'unsaved-changes' : ''}
              >
                {loading ? 'Updating...' : hasUnsavedChanges ? 'Update Profile (Unsaved Changes)' : 'Update Profile'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="password-section">
            <h3>Change Password</h3>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'mfa' && (
          <div className="mfa-section">
            <h3>Multi-Factor Authentication (MFA)</h3>
            
            {mfaStatus && (
              <div className="mfa-status">
                <p>
                  <strong>Status:</strong> {mfaStatus.enabled ? 'Enabled' : 'Disabled'}
                </p>
                {mfaStatus.enabled && (
                  <p>
                    <strong>Methods:</strong> {mfaStatus.methods.join(', ')}
                  </p>
                )}
              </div>
            )}

            {!mfaStatus?.enabled && !qrCode && (
              <div>
                <p>Add an extra layer of security by requiring a code from your authenticator app.</p>
                <button onClick={setupTOTP} disabled={loading}>
                  {loading ? 'Setting up...' : 'Setup MFA'}
                </button>
              </div>
            )}

            {qrCode && (
              <div className="qr-setup">
                <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                <div className="qr-code-container">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                    alt="QR Code"
                  />
                </div>
                <p>Or enter this secret key manually: <code>{secretKey}</code></p>
                
                <form onSubmit={verifyTOTP}>
                  <div className="form-group">
                    <label>Enter verification code from your app:</label>
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6}
                      required
                      placeholder="000000"
                    />
                  </div>
                  <button type="submit" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify and Enable'}
                  </button>
                </form>
              </div>
            )}

            {mfaStatus?.enabled && (
              <button onClick={disableMFA} disabled={loading} className="danger">
                {loading ? 'Disabling...' : 'Disable MFA'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="devices-section">
            <h3>Remembered Devices</h3>
            <p>Manage devices associated with your account. You can forget devices or toggle their remembered status.</p>
            <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem', background: '#f7fafc', borderRadius: '6px', fontSize: '0.9rem', color: '#333' }}>
              {/* Never-remember flag controls */}
              {localNeverRememberState ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ color: '#b45309' }}>Remember prompts are disabled for this account.</div>
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      try {
                        await setNeverRememberDevice(user.email, false);
                        setLocalNeverRememberState(false);
                        showMessage('success', 'Remember prompts re-enabled. You will be asked after next MFA.');
                        // Offer to remember current local device now if we have a key
                        if (localDeviceKeyState && localDeviceKeyState !== '-') {
                          setShowRememberNowModal(true);
                        }
                      } catch (e) {
                        console.error('Failed to clear never-remember flag', e);
                        showMessage('error', 'Failed to re-enable remember prompts');
                      }
                    }}
                  >
                    Re-enable remember prompts
                  </button>
                </div>
              ) : (
                <div style={{ color: '#047857' }}>Remember prompts are enabled for this account.</div>
              )}
            </div>
            {/* Modal: remember current local device now (shown after re-enabling prompts) */}
            {showRememberNowModal && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <h4>Remember this device now?</h4>
                {localDeviceKeyState && localDeviceKeyState !== '-' ? (
                  <div>
                    <p style={{ marginTop: 0 }}>We detected a local device key for this browser. You can remember it now so it won't prompt for MFA on next sign in.</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary" onClick={async () => {
                        try {
                          setLoadingDevices(true);
                          const resp = await rememberDeviceBackend(localDeviceKeyState, true);
                          // Verify server-side
                          const list = await listDevicesBackend(50);
                          const found = (list.devices || []).find(d => d.DeviceKey === localDeviceKeyState);
                          if (found && found.DeviceRememberedStatus === 'remembered') {
                            await setStoredDeviceRemembered(user.email, true);
                            showMessage('success', 'Device remembered');
                            setLocalDeviceRememberedState(true);
                            setShowRememberNowModal(false);
                          } else {
                            console.warn('Remember OK but device not found in list', resp, list);
                            showMessage('error', 'Server did not confirm device remembered. Please try again.');
                          }
                        } catch (e) {
                          console.error('Failed to remember device from settings', e);
                          showMessage('error', 'Failed to remember device');
                        } finally { setLoadingDevices(false); }
                      }}>Remember</button>

                      <button className="btn-secondary" onClick={() => setShowRememberNowModal(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ marginTop: 0 }}>No local device key found for this browser. Sign out and sign in again to generate one, then you'll be able to remember it.</p>
                    <button className="btn-secondary" onClick={() => setShowRememberNowModal(false)}>Close</button>
                  </div>
                )}
              </div>
            )}
            {loadingDevices ? (
              <p>Loading devices...</p>
            ) : (
              <div>
                {devices.length === 0 ? (
                  <p>No devices found.</p>
                ) : (
                  <table className="devices-table">
                    <thead>
                      <tr>
                        <th>Device Key</th>
                        <th>Created</th>
                        <th>Last Authenticated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((d) => {
                        const attrs = d?.DeviceAttributes || d?.Attributes || [];
                        const friendly = (attrs.find?.(a => a.Name === 'name' || a.Name === 'device_name' || a.Name === 'friendly_name') || {}).Value;
                        const shortKey = d.DeviceKey ? (d.DeviceKey.length > 28 ? d.DeviceKey.slice(0, 16) + '...' + d.DeviceKey.slice(-8) : d.DeviceKey) : '-';
                        return (
                          <tr key={d.DeviceKey}>
                            <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <div style={{ fontWeight: 600 }}>{friendly || shortKey}</div>
                              <div style={{ color: '#666', fontSize: '0.85rem' }}>{d.DeviceKey}</div>
                            </td>
                            <td>{d.DeviceCreateDate ? new Date(d.DeviceCreateDate).toLocaleString() : '-'}</td>
                            <td>{d.DeviceLastAuthenticatedDate ? new Date(d.DeviceLastAuthenticatedDate).toLocaleString() : '-'}</td>
                            <td>
                              <button className="device-action-btn danger" onClick={() => handleForgetDevice(d.DeviceKey)} disabled={loadingDevices}>
                                Forget
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'delete' && (
          <div className="delete-section">
            <h3>Delete Account</h3>
            <div className="warning-box">
              <p><strong>⚠️ Warning:</strong> This action is permanent and cannot be undone.</p>
              <p>Deleting your account will:</p>
              <ul>
                <li>Permanently delete all your mood entries and history</li>
                <li>Remove your profile information and pictures</li>
                <li>Close your account and sign you out</li>
              </ul>
            </div>
            
            <form onSubmit={handleDeleteAccount}>
              <div className="form-group">
                <label>Type <strong>DELETE</strong> to confirm:</label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  required
                  disabled={isDeleting}
                />
              </div>
              <button type="submit" className="danger" disabled={isDeleting || deleteConfirmation !== 'DELETE'}>
                {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountSettings;
