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
  const [entryExists, setEntryExists] = useState(false);
  const [sleepQuality, setSleepQuality] = useState(null);
  const [sleepDuration, setSleepDuration] = useState(null);
  const [consumed, setConsumed] = useState({
    prescriptions: false,
    caffeine: false,
    marijuana: false,
  });
  const [notes, setNotes] = useState("");

  // Load any saved entry from the API once authenticated
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const token = await getIdToken();
        const userSub = user.sub;
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL}/entries/today`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const e = await resp.json();
          // Decrypt the entry before using it
          const decrypted = await decryptEntry(e, userSub);
          setEntryExists(true);
          setSleepQuality(decrypted.sleepQuality);
          setSleepDuration(decrypted.sleepDuration);
          // Note: consumed and notes are not loaded here, but could be if needed
        } else {
          setEntryExists(false);
        }
      } catch {
        setEntryExists(false);
      } finally {
        setEntryLoaded(true);
      }
    })();
  }, [user, todayKey]);

  const handleCheckbox = (key) => {
    setConsumed((c) => ({ ...c, [key]: !c[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      return alert("Please sign in to save.");
    }

    const now = new Date();
    const entry = {
      feeling,
      sleepQuality,
      sleepDuration,
      consumed,
      notes,
      timestamp: now.toISOString(),
      localDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, // YYYY-MM-DD in user's timezone
    };

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
      <h1 style={{ textAlign: "center" }}>
        You're feeling {FEELING_MAP[feeling]}
      </h1>
      <form onSubmit={handleSubmit} className="daily-questions-form">
        {entryLoaded && !entryExists && (
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
