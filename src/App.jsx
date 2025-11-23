import { useAuth } from "react-oidc-context";
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import FeelingSelector from "./FeelingSelector";
import DailyQuestions from "./DailyQuestions";
import HistoryCalendar from "./HistoryCalendar";
import AccountSettings from "./AccountSettings";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfService from "./TermsOfService";
import Disclaimer from "./Disclaimer";
import CookiePolicy from "./CookiePolicy";
import Header from "./Header";
import Footer from "./Footer";
import "./App.css"; 

function App() {
  const auth = useAuth();

  // Automatically trigger silent sign-in if there's an active session
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.error && !auth.activeNavigator) {
      auth.signinSilent().catch(() => {
        // Silently fail - user just needs to click sign in
      });
    }
  }, [auth]);

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  // Only show error if it's not a "login required" error from silent sign-in
  if (auth.error && auth.error.message !== "Login required") {
    return <div>Encountering error... {auth.error.message}</div>;
  }

  // If not signed in, show your sign-in UI
  if (!auth.isAuthenticated) {
    return (
      <div id="login-container">
        <img
          src="/logo-min.webp"
          alt="Mood Tracker Logo"
          style={{
            width: "400px",
            height: "auto",
            objectFit: "contain",
            marginBottom: "1rem",
          }}
        />
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
        <p>
          This app is a simple mood and sleep tracker. It allows you to log your
          feelings and answer daily questions about your mood and sleep.
          <br />
          <strong>
            Note: This app is not intended for medical use. Please consult a
            healthcare professional for any mental health concerns.
          </strong>
        </p>
      </div>
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
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        {/* catch-all → redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
