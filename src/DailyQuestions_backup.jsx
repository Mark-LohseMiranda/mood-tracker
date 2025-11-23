// src/DailyQuestions.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function DailyQuestions() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const feeling = state?.feeling || '😐';

  // Compute today’s key for stub storage
  const todayKey = `entry:${new Date().toISOString().slice(0, 10)}`;

  // Form state
  const [sleepQuality, setSleepQuality] = useState('');
  const [sleepDuration, setSleepDuration] = useState('');
  const [consumed, setConsumed] = useState({
    prescriptions: false,
    caffeine: false,
    marijuana: false,
  });
  const [notes, setNotes] = useState('');

  // On mount, load any existing entry for today
  useEffect(() => {
    const raw = localStorage.getItem(todayKey);
    if (raw) {
      const entry = JSON.parse(raw);
      setSleepQuality(entry.sleepQuality ?? '');
      setSleepDuration(entry.sleepDuration ?? '');
      setConsumed(entry.consumed ?? consumed);
      setNotes(entry.notes ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckbox = (key) => {
    setConsumed((c) => ({ ...c, [key]: !c[key] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const entry = {
      feeling,
      sleepQuality,
      sleepDuration,
      consumed,
      notes,
      timestamp: new Date().toISOString(),
    };
    // TODO: replace localStorage with API call
    localStorage.setItem(todayKey, JSON.stringify(entry));
    alert('Saved for today!');
    navigate('/');
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>Today you feel {feeling}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label>
          How did you sleep last night?
          <input
            type="text"
            value={sleepQuality}
            onChange={(e) => setSleepQuality(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          How long (hours)?
          <input
            type="number"
            min="0"
            step="0.1"
            value={sleepDuration}
            onChange={(e) => setSleepDuration(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <fieldset style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <legend>Since last entry have you consumed:</legend>
          {Object.keys(consumed).map((key) => (
            <label key={key} style={{ display: 'block', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                checked={consumed[key]}
                onChange={() => handleCheckbox(key)}
              />{' '}
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </fieldset>

        <label>
          Notes
          <textarea
            rows="4"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else to note..."
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: '0.75rem',
            background: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Save Entry
        </button>
      </form>
    </div>
  );
}
