import React, { useEffect, useState } from 'react';

// localStorage key used to remember that this browser has already confirmed
// an email. Once set, the gate never shows again on this device.
const CONFIRMED_KEY = 'worldtv_email_confirmed';
const PENDING_KEY = 'worldtv_email_pending'; // holds the email while we wait for confirmation

type GateStatus = 'checking' | 'hidden' | 'collect' | 'pending' | 'error';

const EmailGateModal: React.FC = () => {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // On mount: decide whether this visitor needs to see the gate at all.
  useEffect(() => {
    const confirmed = localStorage.getItem(CONFIRMED_KEY);
    if (confirmed === 'true') {
      setStatus('hidden');
      return;
    }

    // Handle the confirmation link: /?confirm=<token>
    const params = new URLSearchParams(window.location.search);
    const token = params.get('confirm');
    if (token) {
      fetch('/api/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('bad token');
          return res.json();
        })
        .then(() => {
          localStorage.setItem(CONFIRMED_KEY, 'true');
          localStorage.removeItem(PENDING_KEY);
          // clean the URL so the token isn't left in the address bar
          params.delete('confirm');
          const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
          window.history.replaceState({}, '', clean);
          setStatus('hidden');
        })
        .catch(() => {
          setErrorMsg('That confirmation link is invalid or expired.');
          setStatus('collect');
        });
      return;
    }

    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      setEmail(pending);
      setStatus('pending');
      return;
    }

    setStatus('collect');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('failed');
      localStorage.setItem(PENDING_KEY, email);
      setStatus('pending');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking' || status === 'hidden') return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-sm w-full p-6">
        <h2 className="text-white text-lg font-bold mb-2">One quick step</h2>
        <p className="text-gray-300 text-sm mb-4">
          To keep WorldTV free of bots and fake accounts, we ask new visitors
          to confirm their email once. It takes a few seconds, and you won't
          be asked again on this device.
        </p>

        {status === 'collect' && (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              required
            />
            {errorMsg && <p className="text-red-400 text-sm mb-2">{errorMsg}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded font-semibold"
            >
              {submitting ? 'Sending...' : 'Send confirmation link'}
            </button>
          </form>
        )}

        {status === 'pending' && (
          <div>
            <p className="text-gray-300 text-sm mb-3">
              We sent a confirmation link to <span className="text-white">{email}</span>.
              Click it to unlock the site — you won't need to do this again.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem(PENDING_KEY);
                setStatus('collect');
                setEmail('');
              }}
              className="text-blue-400 text-sm underline"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailGateModal;
