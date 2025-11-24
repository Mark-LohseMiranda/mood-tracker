import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import './Instructions.css';

function Instructions() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (!auth.isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="instructions-container">
      <h1>📖 How to Use My Mood Tracker</h1>
      
      <section className="instruction-section">
        <h2>🎯 Getting Started</h2>
        <p>Welcome! My Mood Tracker helps you monitor your daily moods, sleep patterns, and wellness habits over time.</p>
      </section>

      <section className="instruction-section">
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

      <section className="instruction-section">
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

      <section className="instruction-section">
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

      <section className="instruction-section">
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

      <section className="instruction-section">
        <h2>💡 Tips for Best Results</h2>
        <ul>
          <li><strong>Be Consistent:</strong> Log entries regularly to spot patterns over time</li>
          <li><strong>Be Honest:</strong> This is for you - honest tracking leads to better insights</li>
          <li><strong>Add Context:</strong> Use notes to capture why you felt a certain way</li>
          <li><strong>Review Regularly:</strong> Check your history to identify trends and triggers</li>
          <li><strong>Multiple Entries:</strong> Log throughout the day to see how your mood changes</li>
        </ul>
      </section>

      <section className="instruction-section">
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

      <section className="instruction-section">
        <h2>📞 Need Help?</h2>
        <p>If you have questions or encounter issues, please contact us at:</p>
        <p><a href="mailto:mark@guardiancodewebservices.com">mark@guardiancodewebservices.com</a></p>
      </section>
    </div>
  );
}

export default Instructions;
