import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";

export default function Header() {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const getInitial = () => {
    const name = auth.user?.profile.name || auth.user?.profile.email || '?';
    return name.charAt(0).toUpperCase();
  };

  const signOutRedirect = async () => {
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI;
    
    // Clear local state and cache
    await auth.removeUser();
    localStorage.removeItem('historyCache');
    
    // Manually construct the correct Cognito logout URL
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  return (
    <header style={{ padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Link to="/" style={{ lineHeight: 0 }}>
        <img
          src="/logo-min.webp"
          alt="Mood Tracker"
          style={{
            width: "132px",
            height: "132px",
            objectFit: "contain",
            filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
            cursor: "pointer",
          }}
        />
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {auth.user?.profile.picture ? (
          <img
            src={auth.user.profile.picture}
            alt=""
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className="header-profile-initial" style={{ display: auth.user?.profile.picture ? 'none' : 'flex' }}>
          {getInitial()}
        </div>
        <span>
          {auth.user?.profile.name || auth.user?.profile.email}
        </span>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="hamburger-menu"
          aria-label="Menu"
        >
          ☰
        </button>
      </div>
      {menuOpen && (
        <div className="dropdown-menu">
          <Link to="/" onClick={() => setMenuOpen(false)}>
            Home
          </Link>
          <Link to="/settings" onClick={() => setMenuOpen(false)}>
            Settings
          </Link>
          <Link to="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); signOutRedirect(); }}>
            Sign out
          </Link>
        </div>
      )}
    </header>
  );
}
