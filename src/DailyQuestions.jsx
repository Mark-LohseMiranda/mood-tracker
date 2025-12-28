// src/DailyQuestions.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "./AuthContext";
import { encryptEntry, decryptEntry } from "./lib/encryption";
import "./DailyQuestions.css";

export default function DailyQuestions() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const feeling = state?.feeling || "😐";
  const { user, getIdToken } = useAuthContext();

  const todayKey = `entry:${new Date().toISOString().slice(0, 10)}`;

  const FEELING_MAP = {
    5: "😃",
    4: "🙂",
    3: "😐",
    2: "😢",
    1: "😡",
  };

  // Define quick-tap options
  const sleepQualityOptions = [
    { value: 1, emoji: "★☆☆☆☆", label: "Very Poor" },
    { value: 2, emoji: "★★☆☆☆", label: "Poor" },
    { value: 3, emoji: "★★★☆☆", label: "Okay" },
    { value: 4, emoji: "★★★★☆", label: "Good" },
    { value: 5, emoji: "★★★★★", label: "Excellent" },
  ];

  const sleepDurationOptions = [
    { value: 4, label: "4h" },
    { value: 5, label: "5h" },
    { value: 6, label: "6h" },
    { value: 7, label: "7h" },
    { value: 8, label: "8h" },
    { value: 9, label: "9h" },
    { value: 10, label: "10+h" },
  ];

  // State
  const [entryLoaded, setEntryLoaded] = useState(false);
  const [hasSleepData, setHasSleepData] = useState(false);
  const [showSleepPrompt, setShowSleepPrompt] = useState(false);
  const [userSkippedSleep, setUserSkippedSleep] = useState(false);
  const [sleepQuality, setSleepQuality] = useState(null);
  const [sleepDuration, setSleepDuration] = useState(null);
  const [consumed, setConsumed] = useState({
    prescriptions: false,
    caffeine: false,
    marijuana: false,
  });
  const [notes, setNotes] = useState("");

  // Load sleep status from the API once authenticated
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const token = await getIdToken();
        const userSub = user.sub;
        
        // Calculate local date (user's timezone)
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        // Fetch all entries for today to check if ANY have sleep data
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL}/entries/day?date=${localDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const entries = await resp.json();
          // Check if any entry has sleep data
          const hasSleep = entries.some(e => e.sleepQuality != null && e.sleepDuration != null);
          
          if (hasSleep) {
            setHasSleepData(true);
            // Ensure local sleep fields remain empty so we don't resubmit them
            setSleepQuality(null);
            setSleepDuration(null);
          } else {
            setHasSleepData(false);
            // Show prompt to ask if user wants to add sleep
            setShowSleepPrompt(true);
          }
        } else {
          // No entries exist, so definitely no sleep data yet
          setHasSleepData(false);
          setShowSleepPrompt(true);
        }
      } catch {
        // Error fetching, assume no sleep data
        setHasSleepData(false);
        setShowSleepPrompt(true);
      } finally {
        setEntryLoaded(true);
      }
    })();
  }, [user, todayKey]);

  const handleCheckbox = (key) => {
    setConsumed((c) => ({ ...c, [key]: !c[key] }));
  };

  const handleAddSleep = () => {
    setShowSleepPrompt(false);
    setUserSkippedSleep(false);
    // Sleep form will be shown below
  };

  const handleSkipSleep = () => {
    setShowSleepPrompt(false);
    setUserSkippedSleep(true);
    // User chose not to add sleep now
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Good evening"; // Night owl hours
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      return alert("Please sign in to save.");
    }

    const now = new Date();
    // Build base entry
    const entry = {
      feeling,
      consumed,
      notes,
      timestamp: now.toISOString(),
      localDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, // YYYY-MM-DD in user's timezone
    };

    // Only include sleep fields if user is adding them for the first time today
    const userAddingSleep = !hasSleepData && !userSkippedSleep && sleepQuality != null && sleepDuration != null;
    if (userAddingSleep) {
      entry.sleepQuality = sleepQuality;
      entry.sleepDuration = sleepDuration;
    }

    // Encrypt sensitive fields before sending to backend
    const userSub = user.sub;
    const encryptedEntry = await encryptEntry(entry, userSub);

    const token = await getIdToken();
    const resp = await fetch(`${import.meta.env.VITE_API_URL}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(encryptedEntry),
    });

    if (!resp.ok) {
      const err = await resp.json();
      return alert("Error: " + (err.error || err.message));
    }

    // === CACHE INVALIDATION ===
    // Figure out which month this entry belongs to:
    const submittedDate = new Date(entry.timestamp);
    const year = submittedDate.getFullYear();
    const month = String(submittedDate.getMonth() + 1).padStart(2, "0"); // "05"
    const ymKey = `${year}-${month}`; // e.g. "2025-05"

    // 1) Remove from localStorage:
    try {
      const raw = localStorage.getItem("historyCache");
      if (raw) {
        const cacheObj = JSON.parse(raw);
        if (cacheObj[ymKey] !== undefined) {
          delete cacheObj[ymKey];
          localStorage.setItem("historyCache", JSON.stringify(cacheObj));
        }
      }
    } catch {
      // ignore failures (e.g. disabled storage)
    }

    // 2) (Optional) If HistoryCalendar is currently rendering that month,
    //    you may also emit an event or call a callback to tell it to reload.
    //    For simplicity, if the user reloads or navigates back, the cache is now cleared.
    // ============================

    alert("Saved for today!");
    navigate("/");
  };

  const alreadySlept = sleepQuality != null;

  return (
    <div className="daily-questions-container">
      {/* Sleep Tracking Prompt Modal */}
      {showSleepPrompt && !hasSleepData && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{getGreeting()}! Did you get some sleep last night?</h2>
            <p>You haven't recorded sleep data for today yet.</p>
            <div className="modal-buttons">
              <button onClick={handleAddSleep} className="btn-yes">
                Yes, add sleep data
              </button>
              <button onClick={handleSkipSleep} className="btn-no">
                No, skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 style={{ textAlign: "center" }}>
        You're feeling {FEELING_MAP[feeling]}
      </h1>
      <form onSubmit={handleSubmit} className="daily-questions-form">
        {/* Show sleep form only if user clicked "Yes" and hasn't already submitted sleep data */}
        {!showSleepPrompt && !userSkippedSleep && !hasSleepData && (
          <>
            {/* Sleep Quality Row */}
            <fieldset className="sleep-fieldset">
              <legend className="sleep-legend">Sleep Quality</legend>
              <div className="sleep-quality-grid">
                {sleepQualityOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setSleepQuality(opt.value)}
                    aria-label={opt.label}
                    className={`sleep-quality-button ${sleepQuality === opt.value ? 'selected' : ''}`}
                  >
                    {opt.emoji}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Sleep Duration Row */}
            <fieldset className="sleep-fieldset">
              <legend className="sleep-legend">Hours Slept</legend>
              <div className="sleep-duration-grid">
                {sleepDurationOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setSleepDuration(opt.value)}
                    className={`sleep-duration-button ${sleepDuration === opt.value ? 'selected' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {/* Consumed Checkboxes */}
        <fieldset style={{ border: "1px solid #ccc", padding: "1rem" }}>
          <legend>Since last entry have you consumed:</legend>
          {Object.keys(consumed).map((key) => (
            <label key={key} style={{ display: "block", marginTop: ".5rem" }}>
              <input
                type="checkbox"
                checked={consumed[key]}
                onChange={() => handleCheckbox(key)}
              />{" "}
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </fieldset>

        {/* Notes */}
        <label>
          Notes
          <textarea
            rows="4"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else to note…"
            style={{ width: "100%", padding: ".5rem" }}
          />
        </label>

        <button
          type="submit"
        >
          Save Entry
        </button>
      </form>
    </div>
  );
}
