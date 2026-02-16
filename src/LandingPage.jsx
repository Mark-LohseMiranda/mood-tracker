import { useEffect, useRef } from 'react';
import './LandingPage.css';

export default function LandingPage({ onSignIn, onSignUp }) {
  const elementRefs = useRef({});

  const features = [
    {
      id: 1,
      title: "Express Your Feelings",
      description: "Start each day by selecting from a range of mood emojis. Capture your emotional state in just one tap.",
      image: "/screenshots/mood-selector.webp",
      cta: "Get Started",
      align: "left",
      objectFit: "cover"
    },
    {
      id: 2,
      title: "Track Sleep & Wellness",
      description: "Log your sleep quality and duration. Monitor how rest impacts your mood and overall wellbeing.",
      image: "/screenshots/sleep-tracking.webp",
      cta: "Learn More",
      align: "right",
      objectFit: "cover"
    },
    {
      id: 3,
      title: "Visualize Your Progress",
      description: "See your mood trends in an intuitive calendar view. Spot patterns and understand what affects your emotional health.",
      image: "/screenshots/calendar-view.webp",
      cta: "Explore",
      align: "left",
      objectFit: "cover"
    },
    {
      id: 4,
      title: "Capture Your Thoughts",
      description: "Add detailed notes and contextual information to your daily entries. Keep a private journal encrypted for your eyes only.",
      image: "/screenshots/notes-section.webp",
      cta: "Start Journaling",
      align: "right",
      objectFit: "contain"
    },
    {
      id: 5,
      title: "Log What Matters",
      description: "Track caffeine, medications, and other factors that influence your mood. Build awareness of your personal triggers.",
      image: "/screenshots/consumption-logging.webp",
      cta: "Monitor Factors",
      align: "left",
      objectFit: "contain"
    },
  ];

  // Set up Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    // Observe all animated elements
    Object.values(elementRefs.current).forEach(el => {
      if (el) observer.observe(el);
    });

    return () => {
      Object.values(elementRefs.current).forEach(el => {
        if (el) observer.unobserve(el);
      });
      observer.disconnect();
    };
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-container">
        <div className="landing-content">
          <img
            src="/logo-min.webp"
            alt="Mood Tracker Logo"
            className="landing-logo"
          />
          
          <h1>Track Your Mood & Sleep</h1>
          
          <p className="landing-description">
            A simple, secure mood and sleep tracker. Log your daily feelings, 
            answer questions about your mood and sleep, and view your history 
            over time.
          </p>

          <div className="landing-buttons">
            <button onClick={onSignIn} className="btn-primary">
              Sign In
            </button>
            <button onClick={onSignUp} className="btn-secondary">
              Create Account
            </button>
          </div>

          <div className="landing-disclaimer">
            <strong>Note:</strong> This app is not intended for medical use. 
            Please consult a healthcare professional for any mental health concerns.
          </div>
        </div>
      </div>

      <div className="sales-pitch">
        <div className="pitch-intro" ref={(el) => { elementRefs.current['intro'] = el; }}>
          <h2>Why Track Your Mood?</h2>
          <p>Self-awareness is the first step to emotional wellness. Our app makes it easy to:</p>
        </div>

        {features.map((feature, index) => (
          <div
            key={feature.id}
            ref={(el) => { elementRefs.current[`feature-${feature.id}`] = el; }}
            className={`pitch-section pitch-section-${feature.align} ${index % 2 === 0 ? 'even' : 'odd'}`}
          >
            <div className="pitch-image-wrapper">
              <img
                src={feature.image}
                alt={feature.title}
                className="pitch-image"
                style={{ objectFit: feature.objectFit }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <div className="pitch-image-placeholder">
                <p style={{ fontSize: '0.9rem', color: '#718096' }}>
                  Screenshot: {feature.title}
                </p>
              </div>
            </div>

            <div className="pitch-content">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <button className="btn-pitch-cta" onClick={onSignUp}>
                {feature.cta} →
              </button>
            </div>
          </div>
        ))}

        <div 
          className="pitch-trust"
          ref={(el) => { elementRefs.current['trust'] = el; }}
        >
          <div className="trust-grid">
            <div className="trust-item">
              <div className="trust-icon">🔒</div>
              <h4>End-to-End Encrypted</h4>
              <p>Your sensitive data (mood, notes, medications) is encrypted on your device before it ever reaches our servers. We use industry-standard AES-256 encryption.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">👁️</div>
              <h4>We Can't See Your Data</h4>
              <p>MyEmTee cannot access your encrypted mood entries, notes, or personal information. Only you hold the key to decrypt your data.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">🛑</div>
              <h4>Never Sold</h4>
              <p>We will never sell, trade, or share your information with third parties. Your privacy is not for sale—ever.</p>
            </div>
          </div>
        </div>

        <div className="pitch-closing">
          <h2>Ready to Start Your Journey?</h2>
          <p>Join thousands of people taking control of their emotional wellness.</p>
          <button onClick={onSignUp} className="btn-primary btn-large">
            Create Your Free Account Today
          </button>
        </div>
      </div>
    </div>
  );
}
