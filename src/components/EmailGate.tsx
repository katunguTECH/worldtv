import React, { useState } from 'react';

interface EmailGateProps {
  onSubmit: () => void;
}

const EmailGate: React.FC<EmailGateProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      localStorage.setItem('worldtv_email', email);
      onSubmit();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 rounded-lg">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg max-w-sm w-full mx-4">
        <h3 className="text-white text-lg font-semibold mb-2">Enter your email to watch</h3>
        <p className="text-gray-400 text-sm mb-4">We'll only use this to improve WorldTV. No spam.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded font-semibold transition"
        >
          {submitting ? 'Loading...' : 'Watch Now'}
        </button>
      </form>
    </div>
  );
};

export default EmailGate;