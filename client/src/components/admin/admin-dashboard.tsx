import React, { useEffect, useState } from 'react';

type Metrics = {
  totalUsers: number;
  dailyActiveUsers: number;
  totalTransactions: number;
  topCategories: { name: string; total: number }[];
  recentActivity: any[];
};

function downloadCSV(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/metrics').then(r => r.json()).then(data => {
      setMetrics(data);
    }).catch(err => console.error(err)).finally(() => setLoading(false));
  }, []);

  if (loading || !metrics) return <div className="p-4">Loading dashboard...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Admin Dashboard</h2>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-500">Total users</div>
          <div className="text-2xl font-bold">{metrics.totalUsers}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-500">Daily active users</div>
          <div className="text-2xl font-bold">{metrics.dailyActiveUsers}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-500">Total transactions</div>
          <div className="text-2xl font-bold">{metrics.totalTransactions}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-sm text-gray-500">Recent activity</div>
          <div className="text-sm">{metrics.recentActivity.length} recent items</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => downloadCSV('top-categories.csv', metrics.topCategories)} className="px-3 py-1 bg-slate-200 rounded">Export Top Categories (CSV)</button>
        <button onClick={() => downloadCSV('recent-activity.csv', metrics.recentActivity)} className="px-3 py-1 bg-slate-200 rounded">Export Recent Activity (CSV)</button>
        <button onClick={() => window.print()} className="px-3 py-1 bg-slate-200 rounded">Export Page (PDF)</button>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2">Top Categories</h3>
        <ul>
          {metrics.topCategories.map(c => (
            <li key={c.name} className="flex justify-between border-b py-1">
              <span>{c.name}</span>
              <span className="font-mono">{c.total.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Recent Activity</h3>
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left text-sm text-gray-600">
              <th className="pr-4">Type</th>
              <th className="pr-4">User</th>
              <th className="pr-4">Amount</th>
              <th className="pr-4">Category</th>
              <th className="pr-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recentActivity.map((r, idx) => (
              <tr key={idx} className="border-t">
                <td className="py-1">{r.type}</td>
                <td className="py-1">{r.userId}</td>
                <td className="py-1">{(r.amount ?? 0).toFixed ? (r.amount).toFixed(2) : r.amount}</td>
                <td className="py-1">{r.categoryName}</td>
                <td className="py-1">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
