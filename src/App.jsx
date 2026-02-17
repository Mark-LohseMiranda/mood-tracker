import { useState, useEffect } from "react";
import { useAuthContext } from "./AuthContext";
import { useLocation, useNavigate } from 'react-router-dom';
import { Routes, Route, Navigate } from "react-router-dom";
import FeelingSelector from "./FeelingSelector";
import DailyQuestions from "./DailyQuestions";
import HistoryCalendar from "./HistoryCalendar";
import MoodGraph from "./MoodGraph";
import AccountSettings from "./AccountSettings";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfService from "./TermsOfService";
import Disclaimer from "./Disclaimer";
import CookiePolicy from "./CookiePolicy";
import Instructions from "./Instructions";
import Header from "./Header";
import Footer from "./Footer";
import ShareButton from "./ShareButton";
import LandingPage from "./LandingPage";
import Login from "./Login";
import SignUp from "./SignUp";
import ForgotPassword from "./ForgotPassword";
import "./App.css"; 

function App() {
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuthContext();
  const [authView, setAuthView] = useState('landing'); // 'landing', 'login', 'signup', 'forgot-password'
  const location = useLocation();
  const navigate = useNavigate();

  // If user landed on a deep route while unauthenticated, reset URL to '/'.
  // Must run unconditionally (hooks cannot be called conditionally).
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#667eea'
      }}>
        Loading...
      </div>
    );
  }

  // If not signed in, show auth UI
  if (!isAuthenticated) {

    const handleLoginSuccess = () => {
      checkAuthStatus();
    };

    const handleSignUpSuccess = () => {
      setAuthView('login');
    };

    const handleResetSuccess = () => {
      setAuthView('login');
    };

    if (authView === 'landing') {
      return (
        <>
          <LandingPage
            onSignIn={() => setAuthView('login')}
            onSignUp={() => setAuthView('signup')}
          />
          <Footer />
          <ShareButton />
        </>
      );
    }

    if (authView === 'signup') {
      return (
        <>
          <SignUp
            onSignUpSuccess={handleSignUpSuccess}
            onSwitchToLogin={() => setAuthView('login')}
          />
          <Footer />
          <ShareButton />
        </>
      );
    }

    if (authView === 'forgot-password') {
      return (
        <>
          <ForgotPassword
            onResetSuccess={handleResetSuccess}
            onSwitchToLogin={() => setAuthView('login')}
          />
          <Footer />
          <ShareButton />
        </>
      );
    }

    return (
      <>
        <Login
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignUp={() => setAuthView('signup')}
          onSwitchToForgotPassword={() => setAuthView('forgot-password')}
        />
        <Footer />
        <ShareButton />
      </>
    );
  }

  return (
    <>
      <Header />

      <Routes>
        <Route
          path="/"
          element={
            <>
              <FeelingSelector />
              <HistoryCalendar />
            </>
          }
        />
        <Route path="/questions" element={<DailyQuestions />} />
        <Route path="/stats" element={<MoodGraph />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        {/* catch-all → redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
      <ShareButton />
    </>
  );
}

export default App;
