import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// App version - update this manually when deploying new versions
const APP_VERSION = "1.17";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setPoliciesOpen(false);
      }
    };

    if (policiesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [policiesOpen]);
  
  return (
    <footer style={{
      padding: "2rem 1rem",
      textAlign: "center",
      marginTop: "3rem",
      borderTop: "1px solid #eee",
      position: "relative"
    }}>
      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", opacity: 0.7 }}>
        © {currentYear} Mood Tracker. All rights reserved.
      </p>
      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", opacity: 0.5 }}>
        v{APP_VERSION}
      </p>
      <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
        <button 
          onClick={() => setPoliciesOpen(!policiesOpen)}
          className="policies-button"
        >
          Policies & Legal
        </button>
        {policiesOpen && (
          <div className="policies-menu">
            <a href="/privacy-policy" onClick={() => setPoliciesOpen(false)}>
              Privacy Policy
            </a>
            <a href="/terms-of-service" onClick={() => setPoliciesOpen(false)}>
              Terms of Service
            </a>
            <a href="/disclaimer" onClick={() => setPoliciesOpen(false)}>
              Disclaimer
            </a>
            <a href="/cookie-policy" onClick={() => setPoliciesOpen(false)}>
              Cookie Policy
            </a>
          </div>
        )}
      </div>
    </footer>
  );
}
