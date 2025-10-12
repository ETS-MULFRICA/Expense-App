import React, { useEffect, useState } from 'react';

export default function AnnouncementsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/announcements');
  if (res.ok) setItems(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(()=>{ fetchItems(); const id = setInterval(fetchItems, 60000); return ()=>clearInterval(id); }, []);

  return (
    <div className="p-4">
  <h2 className="text-lg font-semibold mb-2">Announcements</h2>
      {loading && <div>Loading…</div>}
      {!loading && items.length === 0 && <div>No announcements</div>}
      <ul>
        {items.map(a => (
          <li key={a.id} className={`border-b py-2 ${a.readAt ? 'opacity-70' : 'bg-white'}`}>
            <button onClick={async ()=>{ if (!a.readAt) { await fetch(`/api/announcements/${a.id}/read`, { method: 'POST' }); fetchItems(); } }} className="w-full text-left">
              <div className={`font-semibold ${a.readAt ? '' : 'font-bold'}`}>{a.title}</div>
              <div className="text-sm text-gray-700">{a.body}</div>
              <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
