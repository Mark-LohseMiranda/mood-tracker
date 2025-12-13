import './LandingPage.css';

export default function LandingPage({ onSignIn, onSignUp }) {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <img
          src="/logo-min.webp"
          alt="Mood Tracker Logo"
          className="landing-logo"
        />
        
        <h1>Track Your Mood & Sleep</h1>
        
        <p className="landing-description">
          A simple, secure mood and sleep tracker. Log your daily feelings, 
          answer questions about your mood and sleep, and view your history 
          over time.
        </p>

        <div className="landing-buttons">
          <button onClick={onSignIn} className="btn-primary">
            Sign In
          </button>
          <button onClick={onSignUp} className="btn-secondary">
            Create Account
          </button>
        </div>

        <div className="landing-disclaimer">
          <strong>Note:</strong> This app is not intended for medical use. 
          Please consult a healthcare professional for any mental health concerns.
        </div>
      </div>
    </div>
  );
}
