import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthContextProvider } from "./AuthContext";
import { StatsProvider } from "./StatsContext";
import "./index.css";

// Register PWA service worker with iOS-specific update handling
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // For iOS PWAs, we need to unregister the service worker entirely
    // then reload to force update (standard methods don't work on iOS)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
        // Force reload after unregistering
        window.location.reload(true);
      });
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegisteredSW(swUrl, r) {
    console.log('Service Worker registered:', swUrl);
    // Check for updates every 60 seconds
    r && setInterval(() => {
      console.log('Checking for SW update...');
      r.update();
    }, 60000);
  },
  onRegisterError(error) {
    console.error('SW registration error', error);
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthContextProvider>
      <StatsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StatsProvider>
    </AuthContextProvider>
  </React.StrictMode>
);
