import React, { useEffect, useState } from 'react';

interface Visit {
  ip: string;
  country: string;
  city: string;
  path: string;
  timestamp: string;
}

interface UserRecord {
  email: string;
  firstSeen: string;
  lastSeen: string;
}

interface Stats {
  visits: { allTime: number; day: number; week: number; recent: Visit[] };
  users: {
    allTime: number;
    day: number;
    week: number;
    bySourceWeek?: { source: string; count: number }[];
    list: UserRecord[];
  };
}

const ADMIN_KEY_STORAGE = 'worldtv_admin_key';

const AdminDashboard: React.FC = () => {
  const [key, setKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [inputKey, setInputKey] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'visits' | 'emails'>('visits');

  const loadStats = async (authKey: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': authKey },
      });
      if (res.status === 401) {
        setError('Invalid admin key.');
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setKey('');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setStats(data);
    } catch {
      setError('Failed to load admin stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (key) loadStats(key);
    // eslint-disable-next-line
  }, [key]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sessionStorage.setItem(ADMIN_KEY_STORAGE, inputKey);
    setKey(inputKey);
  };

  if (!key) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-gray-800 p-6 rounded-lg max-w-sm w-full mx-4">
          <h1 className="text-white text-xl font-bold mb-4">Admin Login</h1>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Admin key"
            className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <h1 className="text-white text-2xl font-bold mb-6">WorldTV Admin Dashboard</h1>

      {loading && <p className="text-gray-400">Loading...</p>}
      {error && <p className="text-red-400 mb-4">{error}</p>}

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Visits Today" value={stats.visits.day} />
            <StatCard label="Visits This Week" value={stats.visits.week} />
            <StatCard label="Visits All-Time" value={stats.visits.allTime} />
            <StatCard label="Emails Today" value={stats.users.day} />
            <StatCard label="Emails This Week" value={stats.users.week} />
            <StatCard label="Emails All-Time" value={stats.users.allTime} />
          </div>

          {/* Signups this week by trigger — lets you compare the new
              timed_45s gate against the old baseline (recorded as
              "unknown" for anything signed up before source tracking
              existed). */}
          {stats.users.bySourceWeek && stats.users.bySourceWeek.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="text-gray-400 text-sm mb-3">This Week's Signups by Trigger</div>
              <div className="flex flex-wrap gap-3">
                {stats.users.bySourceWeek.map((s) => (
                  <div key={s.source} className="bg-gray-900 rounded px-4 py-2">
                    <div className="text-white text-lg font-bold">{s.count}</div>
                    <div className="text-gray-500 text-xs">{s.source}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab('visits')}
              className={`px-4 py-2 rounded ${tab === 'visits' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            >
              Recent Visits
            </button>
            <button
              onClick={() => setTab('emails')}
              className={`px-4 py-2 rounded ${tab === 'emails' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            >
              Emails
            </button>
            <button
              onClick={() => loadStats(key)}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white ml-auto"
            >
              Refresh
            </button>
          </div>

          {tab === 'visits' && (
            <div className="bg-gray-800 rounded-lg overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">IP</th>
                    <th className="p-3">Country</th>
                    <th className="p-3">City</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.visits.recent.map((v, i) => (
                    <tr key={i} className="border-b border-gray-700/50 text-gray-300">
                      <td className="p-3">{new Date(v.timestamp).toLocaleString()}</td>
                      <td className="p-3">{v.ip}</td>
                      <td className="p-3">{v.country}</td>
                      <td className="p-3">{v.city}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'emails' && (
            <div className="bg-gray-800 rounded-lg overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">First Seen</th>
                    <th className="p-3">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.list.map((u, i) => (
                    <tr key={i} className="border-b border-gray-700/50 text-gray-300">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{new Date(u.firstSeen).toLocaleString()}</td>
                      <td className="p-3">{new Date(u.lastSeen).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <div className="text-gray-400 text-sm">{label}</div>
    <div className="text-white text-2xl font-bold">{value}</div>
  </div>
);

export default AdminDashboard;