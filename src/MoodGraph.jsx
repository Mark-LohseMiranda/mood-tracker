import { useState, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { decryptFeeling } from './lib/encryption';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import './MoodGraph.css';

const FEELING_MAP = { 1: '😡', 2: '😢', 3: '😐', 4: '🙂', 5: '😃' };
const FEELING_LABELS = { 1: 'Angry', 2: 'Sad', 3: 'Neutral', 4: 'Happy', 5: 'Very Happy' };

export default function MoodGraph() {
  const { getIdToken, user } = useAuthContext();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Date range - default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [displayMode, setDisplayMode] = useState('average'); // 'average' or 'individual'

  const fetchEntries = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const start = new Date(startDate);
      const end = new Date(endDate);
      const allEntries = [];

      // Fetch entries for each month in the range
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

      while (current <= endMonth) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0'); // Format as "01", "02", etc.

        const resp = await fetch(
          `${import.meta.env.VITE_API_URL}/entries/history?year=${year}&month=${month}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (resp.ok) {
          const monthData = await resp.json();
          console.log(`Fetched ${monthData.length} entries for ${year}-${month}`);
          allEntries.push(...monthData);
        } else {
          console.warn(`Failed to fetch entries for ${year}-${month}:`, resp.status);
        }

        current.setMonth(current.getMonth() + 1);
      }

      console.log(`Total entries fetched: ${allEntries.length}`);

      // Filter by date range
      const filtered = allEntries.filter(entry => {
        return entry.date && entry.date >= startDate && entry.date <= endDate;
      });

      console.log(`Entries after date filtering: ${filtered.length}`);

      // Process data based on display mode
      let chartData;
      
      if (displayMode === 'individual') {
        // Show each individual entry with real timestamps
        const allIndividualEntries = [];
        
        for (const dayEntry of filtered) {
          if (!dayEntry.entries || !Array.isArray(dayEntry.entries)) {
            console.warn('Entry missing entries array:', dayEntry);
            continue;
          }

          // Decrypt each feeling and use real timestamp
          for (const entry of dayEntry.entries) {
            let feelingValue = 3;
            try {
              const decrypted = await decryptFeeling(entry.feeling, user.sub);
              
              if (typeof decrypted === 'number' && decrypted >= 1 && decrypted <= 5) {
                feelingValue = decrypted;
              } else if (typeof decrypted === 'string') {
                const parsed = parseInt(decrypted, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                  feelingValue = parsed;
                } else {
                  const emojiToValue = { '😡': 1, '😢': 2, '😐': 3, '🙂': 4, '😃': 5 };
                  feelingValue = emojiToValue[decrypted] || 3;
                }
              }
            } catch (err) {
              console.warn('Failed to decrypt feeling:', err);
            }
            
            allIndividualEntries.push({
              date: dayEntry.date,
              timestamp: entry.timestamp, // Use real timestamp from entry
              value: feelingValue
            });
          }
        }
        
        // Sort by timestamp
        allIndividualEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        chartData = allIndividualEntries;
        
      } else {
        // Show daily averages (original behavior)
        const dailyAverages = await Promise.all(
          filtered.map(async (dayEntry) => {
            if (!dayEntry.entries || !Array.isArray(dayEntry.entries)) {
              console.warn('Entry missing entries array:', dayEntry);
              return null;
            }

            const decryptedFeelings = await Promise.all(
              dayEntry.entries.map(async (entry) => {
                let feelingValue = 3;
                try {
                  const decrypted = await decryptFeeling(entry.feeling, user.sub);
                  
                  if (typeof decrypted === 'number' && decrypted >= 1 && decrypted <= 5) {
                    feelingValue = decrypted;
                  } else if (typeof decrypted === 'string') {
                    const parsed = parseInt(decrypted, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                      feelingValue = parsed;
                    } else {
                      const emojiToValue = { '😡': 1, '😢': 2, '😐': 3, '🙂': 4, '😃': 5 };
                      feelingValue = emojiToValue[decrypted] || 3;
                    }
                  }
                } catch (err) {
                  console.warn('Failed to decrypt feeling:', err);
                }
                return feelingValue;
              })
            );

            const sum = decryptedFeelings.reduce((acc, val) => acc + val, 0);
            const average = sum / decryptedFeelings.length;

            return {
              date: dayEntry.date,
              timestamp: new Date(dayEntry.date + 'T12:00:00').toISOString(), // Local time interpretation
              value: average,
              count: decryptedFeelings.length
            };
          })
        );

        chartData = dailyAverages.filter(entry => entry !== null);
      }

      console.log(`Valid entries for graphing: ${chartData.length}`);
      if (chartData.length > 0) {
        console.log('Sample entry:', chartData[0]);
      }

      setEntries(chartData);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setError('Failed to load mood data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user, startDate, endDate, displayMode]); // Re-fetch when any of these change

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-date">{data.displayDate}</p>
          {data.displayTime && (
            <p className="tooltip-time">{data.displayTime}</p>
          )}
          <p className="tooltip-value">
            {FEELING_MAP[Math.round(data.value)]} {data.value.toFixed(2)}
          </p>
          {data.count && (
            <p className="tooltip-count">
              {data.count} {data.count === 1 ? 'entry' : 'entries'}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Format Y-axis to show emojis
  const formatYAxis = (value) => {
    return FEELING_MAP[Math.round(value)] || '';
  };

  // Format X-axis to show dates (and time for individual entries)
  const formatXAxis = (timestamp) => {
    const date = new Date(timestamp);
    if (displayMode === 'individual') {
      // Show date and time for individual entries
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${dateStr} ${timeStr}`;
    } else {
      // Show just date for daily averages
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderGraph = () => {
    if (entries.length === 0) {
      return <p className="no-data">No mood entries found for this date range.</p>;
    }

    // Prepare data for Recharts
    const chartData = entries.map(entry => {
      const entryDate = new Date(entry.timestamp);
      return {
        timestamp: entryDate.getTime(),
        displayDate: entryDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        }),
        displayTime: displayMode === 'individual' ? entryDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) : null,
        value: entry.value,
        count: entry.count,
        date: entry.date
      };
    });

    return (
      <div className="graph-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatXAxis}
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)' }}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tickFormatter={formatYAxis}
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 20 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary-color)"
              strokeWidth={3}
              dot={{ fill: 'var(--primary-color)', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="mood-graph-page">
      <h1>📊 Mood Trends</h1>
      
      <div className="date-range-selector">
        <div className="date-input-group">
          <label htmlFor="startDate">Start Date:</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
          />
        </div>

        <div className="date-input-group">
          <label htmlFor="endDate">End Date:</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={today.toISOString().split('T')[0]}
          />
        </div>

        <div className="date-input-group">
          <label>Display Mode:</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="displayMode"
                value="average"
                checked={displayMode === 'average'}
                onChange={(e) => setDisplayMode(e.target.value)}
              />
              <span>Daily Average</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="displayMode"
                value="individual"
                checked={displayMode === 'individual'}
                onChange={(e) => setDisplayMode(e.target.value)}
              />
              <span>Individual Entries</span>
            </label>
          </div>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <div className="loading-indicator">Loading mood data...</div>
      ) : (
        renderGraph()
      )}

      {/* Legend */}
      <div className="mood-legend">
        <h3>Mood Scale:</h3>
        <div className="legend-items">
          {[1, 2, 3, 4, 5].map(value => (
            <div key={value} className="legend-item">
              <span className="emoji">{FEELING_MAP[value]}</span>
              <span className="label">{FEELING_LABELS[value]}</span>
              <span className="value">({value})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
