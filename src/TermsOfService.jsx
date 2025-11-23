import { useEffect } from 'react';

export default function TermsOfService() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://policies.termageddon.com/api/embed/T0NzM05XcHRRbU5YZVV4a1RtYzlQUT09.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clean up this specific script
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Terms of Service</h1>
      <div 
        id="T0NzM05XcHRRbU5YZVV4a1RtYzlQUT09" 
        className="policy_embed_div" 
        width="640" 
        height="480"
      > 
        Please wait while the policy is loaded. If it does not load, please{' '}
        <a 
          href="https://policies.termageddon.com/api/policy/T0NzM05XcHRRbU5YZVV4a1RtYzlQUT09" 
          target="_blank"
          rel="nofollow noopener noreferrer"
        >
          click here
        </a>{' '}
        to view the policy.
      </div>
    </div>
  );
}
