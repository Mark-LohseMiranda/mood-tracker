import { useEffect } from 'react';

export default function Disclaimer() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://policies.termageddon.com/api/embed/Vmk5cU1HaFVZekUxYjFkRVpGRTlQUT09.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clean up this specific script
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Disclaimer</h1>
      <div 
        id="Vmk5cU1HaFVZekUxYjFkRVpGRTlQUT09" 
        className="policy_embed_div" 
        width="640" 
        height="480"
      > 
        Please wait while the policy is loaded. If it does not load, please{' '}
        <a 
          href="https://policies.termageddon.com/api/policy/Vmk5cU1HaFVZekUxYjFkRVpGRTlQUT09" 
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
