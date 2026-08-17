import React, { useEffect, useRef, useState } from 'react';

interface EmailGateProps {
  onSubmit: () => void;
}

type GateStatus = 'form' | 'pending' | 'error';

const POLL_INTERVAL_MS = 4000;
const STORAGE_EMAIL_KEY = 'worldtv_pending_email';

const EmailGate: React.FC<EmailGateProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay empty
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<GateStatus>('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If the user already has a pending (unconfirmed) email from a previous
  // visit, pick up where they left off instead of asking again.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_EMAIL_KEY);
    if (saved) {
      setPendingEmail(saved);
      setStatus('pending');
    }
  }, []);

  const checkStatus = async (emailToCheck: string) => {
    try {
      const res = await fetch(`/api/users/status?email=${encodeURIComponent(emailToCheck)}`);
      const data = await res.json();
      if (data.verified) {
        localStorage.removeItem(STORAGE_EMAIL_KEY);
        localStorage.setItem('worldtv_email', emailToCheck);
        if (pollRef.current) clearInterval(pollRef.current);
        onSubmit();
      }
    } catch {
      // Silent — next poll tick will retry.
    }
  };

  // Poll while in the "pending" state.
  useEffect(() => {
    if (status !== 'pending' || !pendingEmail) return;

    checkStatus(pendingEmail); // check immediately on entering pending state
    pollRef.current = setInterval(() => checkStatus(pendingEmail), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line
  }, [status, pendingEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (data.status === 'verified') {
        // Already confirmed on a previous visit.
        localStorage.setItem('worldtv_email', normalizedEmail);
        onSubmit();
        return;
      }

      // status === 'pending'
      localStorage.setItem(STORAGE_EMAIL_KEY, normalizedEmail);
      setPendingEmail(normalizedEmail);
      setStatus('pending');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseDifferentEmail = () => {
    localStorage.removeItem(STORAGE_EMAIL_KEY);
    setPendingEmail('');
    setEmail('');
    setStatus('form');
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not resend. Please try again.');
      }
    } catch {
      setError('Could not resend. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 rounded-lg">
      {status === 'form' && (
        <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg max-w-sm w-full mx-4">
          <h3 className="text-white text-lg font-semibold mb-2">Enter your email to watch</h3>
          <p className="text-gray-400 text-sm mb-4">
            We'll send a confirmation link — click it once and you're set. No spam.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />

          {/* Honeypot: hidden from real users, bots that auto-fill every
              field will populate it. Never remove display:none. */}
          <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded font-semibold transition"
          >
            {submitting ? 'Sending...' : 'Send confirmation link'}
          </button>
        </form>
      )}

      {status === 'pending' && (
        <div className="bg-gray-800 p-6 rounded-lg max-w-sm w-full mx-4 text-center">
          <h3 className="text-white text-lg font-semibold mb-2">Check your inbox</h3>
          <p className="text-gray-400 text-sm mb-4">
            We sent a confirmation link to <span className="text-gray-200">{pendingEmail}</span>. Click it, then come back here — this page updates automatically.
          </p>
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <div className="flex items-center justify-center gap-2 text-gray-500 text-xs mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Waiting for confirmation...
          </div>
          <button
            onClick={handleResend}
            disabled={submitting}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white py-2 rounded font-medium text-sm mb-2 transition"
          >
            {submitting ? 'Resending...' : 'Resend email'}
          </button>
          <button
            onClick={handleUseDifferentEmail}
            className="w-full text-gray-400 hover:text-gray-300 text-xs underline"
          >
            Use a different email
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailGate;
