import React, { useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import './HistoryCalendar.css';
import { decryptEntries, decryptFeeling } from './lib/encryption';
import { cacheEntryMetadata } from './lib/indexedDB';

// Month names lookup
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Helper: build an array of date‐strings (or nulls) filling out a 7×N calendar grid
function generateCalendarDates(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth  = new Date(year, month, 0);
  const daysInMonth   = lastOfMonth.getDate();
  const startWeekday  = firstOfMonth.getDay(); // 0=Sun … 6=Sat
  const totalSlots    = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const dates = [];

  for (let slot = 0; slot < totalSlots; slot++) {
    const dayNumber = slot - startWeekday + 1;
    if (slot < startWeekday || dayNumber > daysInMonth) {
      dates.push(null);
    } else {
      const mm = String(month).padStart(2, '0');
      const dd = String(dayNumber).padStart(2, '0');
      dates.push(`${year}-${mm}-${dd}`);
    }
  }
  return dates;
}

export default function HistoryCalendar() {
  const { user, getAccessToken, getIdToken } = useAuthContext();

  // Determine "today" once, for default values
  const today = new Date();
  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1–12

  const [entryLoaded, setEntryLoaded]   = useState(false);
  const [entryExists, setEntryExists]   = useState(false);
  const [averages, setAverages]         = useState({}); // { "YYYY-MM-DD": avgFeeling }
  
  // Modal state
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayEntries, setDayEntries]     = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // In‐memory cache: { "YYYY-MM": { "YYYY-MM-DD": avgFeeling, … }, … }
  // Initialize it from localStorage if present.
  const [cache, setCache] = useState(() => {
    try {
      const raw = localStorage.getItem('historyCache');
      if (!raw) return {};
      
      const parsed = JSON.parse(raw);
      
      // Check if cache has timestamp and if it's older than 5 minutes
      const cacheTimestamp = localStorage.getItem('historyCacheTimestamp');
      if (cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp, 10);
        const FIVE_MINUTES = 5 * 60 * 1000;
        if (cacheAge > FIVE_MINUTES) {
          // Cache is stale, clear it
          localStorage.removeItem('historyCache');
          localStorage.removeItem('historyCacheTimestamp');
          return {};
        }
      }
      
      return parsed;
    } catch {
      return {};
    }
  });

  // Whenever cache changes, persist it back to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('historyCache', JSON.stringify(cache));
      localStorage.setItem('historyCacheTimestamp', Date.now().toString());
    } catch {
      // ignore storage errors
    }
  }, [cache]);

  // Fetch or load from cache whenever currentYear/currentMonth changes
useEffect(() => {
  if (!user) return;

  // Build our “YYYY-MM” key
  const ymKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // A) Fetch the latest cache from localStorage each time
  let persistedCache = {};
  try {
    const raw = localStorage.getItem('historyCache');
    persistedCache = raw ? JSON.parse(raw) : {};
  } catch {
    persistedCache = {};
  }

  // B) If in-memory cache differs, update it.
  if (JSON.stringify(persistedCache) !== JSON.stringify(cache)) {
    setCache(persistedCache);
  }

  // C) If we already have data for this month, use it and skip network
  if (persistedCache[ymKey]) {
    setAverages(persistedCache[ymKey]);
    setEntryExists(Object.keys(persistedCache[ymKey]).length > 0);
    setEntryLoaded(true);
    return;
  }

  // Otherwise, fetch from backend and then store in cache…
  (async () => {
    setEntryLoaded(false);
    let exists = false;
    try {
      const token    = await getIdToken();
      const resp     = await fetch(
        `${import.meta.env.VITE_API_URL}/entries/history?year=${currentYear}&month=${String(currentMonth).padStart(2, '0')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Diagnostic logging
      try {
        const masked = token ? (token.substring(0,8) + '…' + token.substring(token.length-8)) : null;
        let tokenUse = null;
        try {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          tokenUse = payload.token_use || payload.tokenUse || null;
        } catch (e) {}
      } catch(e) {}

      if (resp.ok) {
        const data = await resp.json();
        const monthMap = {};
        
        // Decrypt feelings and calculate averages
        const userSub = user.sub;
        
        for (const { date, feelings } of data) {
          if (!feelings || feelings.length === 0) continue;
          
          // Decrypt each feeling
          const decryptedFeelings = [];
          for (const feeling of feelings) {
            // If it's a number (unencrypted), use it directly
            if (!isNaN(feeling)) {
              decryptedFeelings.push(Number(feeling));
            } else {
              // It's encrypted, decrypt it
              const decrypted = await decryptFeeling(feeling, userSub);
              const value = parseInt(decrypted, 10);
              if (!isNaN(value)) {
                decryptedFeelings.push(value);
              }
            }
          }
          
          // Calculate average
          if (decryptedFeelings.length > 0) {
            const avg = decryptedFeelings.reduce((a, b) => a + b, 0) / decryptedFeelings.length;
            monthMap[date] = Math.round(avg);
          }
        }
        
        exists = Object.keys(monthMap).length > 0;

        setAverages(monthMap);
        setEntryExists(exists);

        // Update both in-memory and localStorage caches:
        const newCache = { ...persistedCache, [ymKey]: monthMap };
        setCache(newCache);
        localStorage.setItem('historyCache', JSON.stringify(newCache));
      } else {
        // Log response body for debugging unauthorized cases
        try {
          const body = await resp.text();
          console.error('HistoryCalendar: entries/history failed status=', resp.status, 'body=', body);
        } catch (e) {}
        // no entries → cache an empty object
        setAverages({});
        setEntryExists(false);
        const newCache = { ...persistedCache, [ymKey]: {} };
        setCache(newCache);
        localStorage.setItem('historyCache', JSON.stringify(newCache));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      setAverages({});
      setEntryExists(false);
      const newCache = { ...persistedCache, [ymKey]: {} };
      setCache(newCache);
      localStorage.setItem('historyCache', JSON.stringify(newCache));
    } finally {
      setEntryLoaded(true);
    }
  })();
}, [user, currentYear, currentMonth, cache]);

  // Change month helpers
  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Handle clicking on a day with entries
  const handleDayClick = async (dateStr) => {
    if (!dateStr || !averages[dateStr]) return;
    
    setSelectedDate(dateStr);
    setLoadingEntries(true);
    
    try {
      const token = await getIdToken();
      const userSub = user.sub;
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL}/entries/day?date=${dateStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (resp.ok) {
        const data = await resp.json();
        // Decrypt all entries before displaying
        const decryptedEntries = await decryptEntries(data, userSub);
        setDayEntries(decryptedEntries);
        
        // Cache only entry metadata (safe data)
        await cacheEntryMetadata(decryptedEntries, userSub);
      } else {
        setDayEntries([]);
      }
    } catch (e) {
      console.error('Failed to load day entries:', e);
      setDayEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const closeModal = () => {
    setSelectedDate(null);
    setDayEntries([]);
  };

  // Format timestamp to user's local time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Build the grid cells of date‐strings (or null)
  const gridDates = generateCalendarDates(currentYear, currentMonth);

  const WEEKDAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header with navigation buttons and month/year */}
      <div style={{
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        gap:            '1rem',
        marginBottom:   '0.5rem'
      }}>
        <button onClick={goToPreviousMonth} style={{ padding: '0.25rem 0.5rem' }}>
          ←
        </button>
        <h2 style={{ margin: 0 }}>
          {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </h2>
        <button onClick={goToNextMonth} style={{ padding: '0.25rem 0.5rem' }}>
          →
        </button>
      </div>

      {/* Weekday row */}
      <div style={{
        display:        'flex',
        borderBottom:   '1px solid #ccc',
        paddingBottom:  '0.5rem',
        marginBottom:   '0.5rem'
      }}>
        {WEEKDAY_LABELS.map(day => (
          <div key={day} style={{
            flex:       1,
            textAlign:  'center',
            fontWeight: 600,
            color:      '#555'
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {gridDates.map((dateStr, idx) => {
          const avg = dateStr ? averages[dateStr] : null;
          return (
            <div 
              key={idx} 
              className={`calendar-day ${dateStr && avg ? 'has-data' : ''} ${dateStr ? 'valid-day' : 'empty-day'}`} 
              style={{
                flex:            '1 0 14.2857%', // 1/7th width
                height:          '80px',
                boxSizing:       'border-box',
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'center',
                justifyContent:  'flex-start',
                paddingTop:      '0.25rem',
                cursor:          dateStr && avg ? 'pointer' : 'default'
              }}
              onClick={() => handleDayClick(dateStr)}
            >
              {dateStr && (
                <>
                  <div className="calendar-day-number">
                    {dateStr.slice(-2)}
                  </div>
                  <div style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>
                    {avg === 1 && '😡'}
                    {avg === 2 && '😢'}
                    {avg === 3 && '😐'}
                    {avg === 4 && '🙂'}
                    {avg === 5 && '😃'}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal for day entries */}
      {selectedDate && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Entries for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {loadingEntries ? (
                <p>Loading...</p>
              ) : dayEntries.length === 0 ? (
                <p>No entries found for this day.</p>
              ) : (
                <div className="day-entries">
                  {dayEntries.map((entry, idx) => {
                    // Handle both number (old) and emoji string (new) formats
                    const FEELING_MAP = { 1: '😡', 2: '😢', 3: '😐', 4: '🙂', 5: '😃' };
                    let feelingEmoji = '😐';
                    
                    if (typeof entry.feeling === 'number') {
                      // Old format: number 1-5
                      feelingEmoji = FEELING_MAP[entry.feeling] || '😐';
                    } else if (typeof entry.feeling === 'string') {
                      // Check if it's a numeric string (encrypted old format)
                      const numVal = parseInt(entry.feeling, 10);
                      if (!isNaN(numVal) && numVal >= 1 && numVal <= 5) {
                        feelingEmoji = FEELING_MAP[numVal];
                      } else {
                        // It's an emoji string (encrypted new format)
                        feelingEmoji = entry.feeling;
                      }
                    }
                    
                    return (
                    <div key={idx} className="entry-card">
                      <div className="entry-header">
                        <div className="entry-feeling">
                          {feelingEmoji}
                        </div>
                        <div className="entry-time">{formatTime(entry.timestamp)}</div>
                      </div>
                      {entry.notes && (
                        <div className="entry-notes">
                          <strong>Notes:</strong> {entry.notes}
                        </div>
                      )}
                      {(entry.consumed.prescriptions || entry.consumed.caffeine || entry.consumed.marijuana) && (
                        <div className="entry-consumed">
                          <strong>Consumed:</strong>
                          {entry.consumed.prescriptions && ' Prescriptions'}
                          {entry.consumed.caffeine && ' Caffeine'}
                          {entry.consumed.marijuana && ' Marijuana'}
                        </div>
                      )}
                      {entry.sleepQuality !== undefined && (
                        <div className="entry-sleep">
                          <strong>Sleep:</strong> Quality: {entry.sleepQuality}/5, Duration: {entry.sleepDuration} hours
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}