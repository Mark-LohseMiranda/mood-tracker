import { useAuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import './Instructions.css';

function Instructions() {
  const { isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('getting-started');
  const [tocOpen, setTocOpen] = useState(false);

  const sections = useMemo(() => ([
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'creating-entries', label: 'Creating Entries' },
    { id: 'viewing-history', label: 'Viewing Your History' },
    { id: 'account-settings', label: 'Account Settings' },
    { id: 'remembered-devices', label: 'Remembered Devices' },
    { id: 'privacy-security', label: 'Privacy & Security' },
    { id: 'tips', label: 'Tips' },
    { id: 'faq', label: 'Common Questions' },
    { id: 'help', label: 'Need Help' },
  ]), []);

  // Scrollspy: highlight the section with largest intersection ratio
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry most visible in the viewport
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        // Account for fixed header and make active when roughly upper half is visible
        root: null,
        rootMargin: '-100px 0px -40% 0px',
        threshold: [0.2, 0.4, 0.6, 0.8],
      }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const handleNavigate = (id) => {
    setTocOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Fallback scroll-based highlight for sections (helps edge cases)
  useEffect(() => {
    const headerOffset = 120; // approximate header + spacing
    const handler = () => {
      const scrollPos = window.scrollY + headerOffset;
      let current = sections[0]?.id;
      sections.forEach((s) => {
        const el = document.getElementById(s.id);
        if (!el) return;
        const top = el.offsetTop;
        if (top <= scrollPos) current = s.id;
      });
      if (current) setActiveId(current);
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    handler();
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [sections]);

  if (!isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="instructions-page">
      {/* Mobile TOC toggle */}
      <button className="toc-toggle" onClick={() => setTocOpen(true)}>Contents</button>

      <div className="instructions-layout">
        {/* Sticky sidebar TOC (hidden on small screens) */}
        <aside className="toc">
          <div className="toc-title">Contents</div>
          <nav>
            {sections.map((s) => (
              <button
                key={s.id}
                className={`toc-item ${activeId === s.id ? 'active' : ''}`}
                onClick={() => handleNavigate(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* TOC flyout for mobile */}
        {tocOpen && (
          <div className="toc-flyout" role="dialog" aria-modal="true">
            <div className="toc-flyout-header">
              <span>Contents</span>
              <button className="toc-close" onClick={() => setTocOpen(false)}>×</button>
            </div>
            <nav className="toc-flyout-nav">
              {sections.map((s) => (
                <button
                  key={s.id}
                  className={`toc-item ${activeId === s.id ? 'active' : ''}`}
                  onClick={() => handleNavigate(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        <div className="instructions-container">
          <h1>📖 How to Use My Mood Tracker</h1>
      
      <section id="getting-started" className="instruction-section">
        <h2>🎯 Getting Started</h2>
        <p>Welcome! My Mood Tracker helps you monitor your daily moods, sleep patterns, and wellness habits over time.</p>
      </section>

      <section id="creating-entries" className="instruction-section">
        <h2>📝 Creating Entries</h2>
        <div className="instruction-step">
          <h3>1. Log Your Mood</h3>
          <p>Select an emoji that represents how you're feeling (1-5 scale):</p>
          <img src="/screenshots/mood-selector.webp" alt="Mood selector showing emoji options from very bad to very good" className="screenshot" />
          <ul>
            <li>😢 Very Bad</li>
            <li>😕 Bad</li>
            <li>😐 Neutral</li>
            <li>😊 Good</li>
            <li>😄 Very Good</li>
          </ul>
        </div>

        <div className="instruction-step">
          <h3>2. Track Sleep (First Entry Only)</h3>
          <p>On your first entry each day, you'll be asked about your sleep:</p>
          <img src="/screenshots/sleep-tracking.webp" alt="Sleep tracking fields showing hours and quality inputs" className="screenshot" />
          <ul>
            <li><strong>Hours slept:</strong> How long you slept (e.g., 7.5 hours)</li>
            <li><strong>Sleep quality:</strong> Rate from 1 (poor) to 5 (excellent)</li>
          </ul>
        </div>

        <div className="instruction-step">
          <h3>3. Log Consumption (Optional)</h3>
          <p>Track what you've consumed since your last entry:</p>
          <img src="/screenshots/consumption-logging.webp" alt="Consumption tracking showing caffeine, alcohol, cannabis, and nicotine inputs" className="screenshot" />
          <ul>
            <li>Caffeine (cups of coffee, tea, energy drinks)</li>
            <li>Alcohol (drinks)</li>
            <li>Cannabis (servings)</li>
            <li>Nicotine (cigarettes, vapes)</li>
          </ul>
        </div>

        <div className="instruction-step">
          <h3>4. Add Notes (Optional)</h3>
          <p>Write personal reflections, context, or anything you want to remember about your day.</p>
          <img src="/screenshots/notes-section.webp" alt="Notes textarea for personal reflections" className="screenshot" />
          <p className="privacy-note">🔒 Your notes are encrypted before being stored - even we can't read them!</p>
        </div>

        <div className="instruction-step">
          <h3>5. Submit</h3>
          <p>Click "Submit Entry" to save. You can create multiple entries throughout the day.</p>
        </div>
      </section>

      <section id="viewing-history" className="instruction-section">
        <h2>📅 Viewing Your History</h2>
        <div className="instruction-step">
          <h3>Calendar View</h3>
          <p>Click the <strong>History</strong> link in the menu to see your mood calendar:</p>
          <img src="/screenshots/calendar-view.webp" alt="Calendar showing color-coded mood days" className="screenshot" />
          <ul>
            <li>Each day is color-coded based on your average mood</li>
            <li>Click any day to see all entries with timestamps</li>
            <li>Navigate between months using the arrow buttons</li>
            <li>Today's date is highlighted with a border</li>
          </ul>
          <img src="/screenshots/calendar-day-detail.webp" alt="Modal showing detailed entries for a selected day" className="screenshot" />
        </div>

        <div className="instruction-step">
          <h3>Understanding Colors</h3>
          <ul className="color-legend">
            <li><span className="color-box very-bad"></span> Red = Very Bad mood</li>
            <li><span className="color-box bad"></span> Orange = Bad mood</li>
            <li><span className="color-box neutral"></span> Yellow = Neutral mood</li>
            <li><span className="color-box good"></span> Light Green = Good mood</li>
            <li><span className="color-box very-good"></span> Dark Green = Very Good mood</li>
          </ul>
        </div>
      </section>

      <section id="account-settings" className="instruction-section">
        <h2>👤 Account Settings</h2>
        <p>Click your profile picture or <strong>Settings</strong> in the menu to:</p>
        <img src="/screenshots/account-settings.webp" alt="Account settings page showing profile options" className="screenshot" />
        <ul>
          <li><strong>Update Display Name:</strong> Change how your name appears</li>
          <li><strong>Update Email:</strong> Change your email address</li>
          <li><strong>Upload Profile Picture:</strong> Add or change your photo</li>
          <li><strong>Change Password:</strong> Update your password securely</li>
          <li><strong>Enable MFA:</strong> Add extra security with two-factor authentication</li>
          <li><strong>Delete Account:</strong> Permanently remove all your data</li>
        </ul>
      </section>

      <section id="remembered-devices" className="instruction-section">
        <h2>🖥️ Remembered Devices</h2>
        <div className="instruction-step">
          <h3>What is a remembered device?</h3>
          <p>When you <strong>remember</strong> a device, future sign-ins on that browser/device will usually skip MFA challenges. This uses AWS Cognito’s device remembering and is tied to your account.</p>
        </div>
        <div className="instruction-step">
          <h3>Enable or disable remember prompts</h3>
          <ul>
            <li>Open <strong>Settings → Devices</strong>.</li>
            <li>If prompts are disabled, click <strong>Re-enable remember prompts</strong> to allow remembering devices again.</li>
            <li>With prompts enabled, the app may offer to remember your current device after MFA (or when re-enabling prompts).</li>
          </ul>
        </div>
        <div className="instruction-step">
          <h3>Remember this device</h3>
          <ul>
            <li>Sign in and complete MFA. This generates a device key for your browser.</li>
            <li>Go to <strong>Settings → Devices</strong>. If a local device key is detected, you’ll see a modal offering <strong>Remember</strong> for this device.</li>
            <li>If no local key is detected, <strong>sign out and sign back in</strong> to generate one, then revisit Devices.</li>
          </ul>
          <p className="privacy-note">Note: The device list no longer includes a per-device “Remember” button. Remembering your current device is done via the modal in the Devices tab.</p>
        </div>
        <div className="instruction-step">
          <h3>Forget a device</h3>
          <ul>
            <li>Open <strong>Settings → Devices</strong>.</li>
            <li>Find the device and click <strong>Forget</strong>.</li>
            <li>That device will require full authentication (including MFA) the next time it signs in.</li>
          </ul>
        </div>
        <div className="instruction-step">
          <h3>Troubleshooting</h3>
          <ul>
            <li><strong>No devices shown:</strong> Sign out, sign back in, and revisit Devices.</li>
            <li><strong>Unauthorized error listing devices:</strong> Sign out and sign in again to refresh tokens.</li>
            <li><strong>Remember prompts disabled:</strong> Use the toggle in Devices to re-enable, then remember the current device from the modal.</li>
          </ul>
        </div>
      </section>

      <section id="privacy-security" className="instruction-section">
        <h2>🔐 Privacy & Security</h2>
        <div className="instruction-step">
          <h3>Your Data is Protected</h3>
          <ul>
            <li><strong>End-to-End Encryption:</strong> Your notes, moods, and consumption data are encrypted in your browser before being sent to our servers</li>
            <li><strong>Zero-Knowledge:</strong> Your encryption key is derived from your user ID and never leaves your device - even developers can't read your private data</li>
            <li><strong>Cross-Device Access:</strong> Log in from any device to access your encrypted data</li>
            <li><strong>Secure Authentication:</strong> AWS Cognito handles your login with industry-standard security</li>
          </ul>
        </div>
      </section>

      <section id="tips" className="instruction-section">
        <h2>💡 Tips for Best Results</h2>
        <ul>
          <li><strong>Be Consistent:</strong> Log entries regularly to spot patterns over time</li>
          <li><strong>Be Honest:</strong> This is for you - honest tracking leads to better insights</li>
          <li><strong>Add Context:</strong> Use notes to capture why you felt a certain way</li>
          <li><strong>Review Regularly:</strong> Check your history to identify trends and triggers</li>
          <li><strong>Multiple Entries:</strong> Log throughout the day to see how your mood changes</li>
        </ul>
      </section>

      <section id="faq" className="instruction-section">
        <h2>❓ Common Questions</h2>
        <div className="faq">
          <div className="faq-item">
            <h3>Can I edit or delete entries?</h3>
            <p>Currently, entries cannot be edited or deleted once submitted. This ensures data integrity and honest tracking.</p>
          </div>

          <div className="faq-item">
            <h3>How long do you keep my data?</h3>
            <p>Your data is kept until you delete your account. You have full control and can permanently delete everything at any time.</p>
          </div>

          <div className="faq-item">
            <h3>Can I export my data?</h3>
            <p>Data export is not currently available but may be added in a future update.</p>
          </div>

          <div className="faq-item">
            <h3>What if I forget my password?</h3>
            <p>Click "Forgot Password" on the login page to reset it via email.</p>
          </div>

          <div className="faq-item">
            <h3>Is this a medical app?</h3>
            <p>No. This is a personal wellness tracking tool, not a medical device. It should not replace professional medical advice or treatment.</p>
          </div>
        </div>
      </section>

      <section id="help" className="instruction-section">
        <h2>📞 Need Help?</h2>
        <p>If you have questions or encounter issues, please contact us at:</p>
        <p><a href="mailto:info@myemtee.com">info@myemtee.com</a></p>
      </section>
        </div>
      </div>
    </div>
  );
}

export default Instructions;
