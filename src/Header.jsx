import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "./AuthContext";

export default function Header() {
  const { user, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  const getInitial = () => {
    const name = user?.name || user?.email || '?';
    return name.charAt(0).toUpperCase();
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    // Ensure we're back at the app root after signing out
    try { navigate('/'); } catch (e) {}
  };

  return (
    <header style={{ padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
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
      <div ref={menuRef} style={{ display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>
        {user?.picture ? (
          <img
            src={user.picture}
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
        <div className="header-profile-initial" style={{ display: user?.picture ? 'none' : 'flex' }}>
          {getInitial()}
        </div>
        <span>
          {user?.name || user?.email}
        </span>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className={`hamburger-menu ${menuOpen ? 'open' : ''}`}
          aria-label="Menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        {menuOpen && (
          <div className="dropdown-menu">
            <Link to="/" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <Link to="/instructions" onClick={() => setMenuOpen(false)}>
              Instructions
            </Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)}>
              Settings
            </Link>
            <Link to="#" onClick={(e) => { e.preventDefault(); handleSignOut(); }}>
              Sign out
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
