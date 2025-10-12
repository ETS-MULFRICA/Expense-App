import React, { useEffect, useState } from 'react';

type Announcement = { id?: number; title: string; body: string; created_at?: string; createdAt?: string; createdBy?: number };

export default function AnnouncementsAdmin() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [sendAt, setSendAt] = useState<string>('');
  const [sendEmail, setSendEmail] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/announcements');
    if (res.ok) {
      const data = await res.json();
      setList(data || []);
    }
    setLoading(false);
  };

  useEffect(()=>{ fetchList(); }, []);

  const send = async () => {
    if (!title || !body) return alert('Please provide title and body');
    const payload: any = { title, body };
    if (targetRoles.length) payload.targetRoles = targetRoles;
    if (sendAt) payload.sendAt = sendAt;
    if (sendEmail) payload.sendEmail = true;
    const res = await fetch('/api/admin/announcements', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.status === 201) {
      setTitle(''); setBody(''); fetchList(); alert('Announcement created');
    } else {
      const err = await res.json(); alert(err?.message || 'Failed');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Announcements</h2>
      <div className="mb-4">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="border p-1 w-full mb-2" />
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Message body (markdown)" className="border p-1 w-full h-32 mb-2" />
        <div className="flex gap-2 items-center mb-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} /> Send email</label>
          <label className="flex items-center gap-2 ml-4">Send to roles:
            <select multiple value={targetRoles} onChange={e=>setTargetRoles(Array.from(e.target.selectedOptions, o=>o.value))} className="border p-1 ml-2">
              <option value="admin">admin</option>
              <option value="user">user</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2 items-center mb-2">
          <label className="flex items-center gap-2">Schedule send at:
            <input type="datetime-local" value={sendAt} onChange={e=>setSendAt(e.target.value)} className="border p-1 ml-2" />
          </label>
          <button onClick={()=>setPreviewMode(p=>!p)} className="ml-4 px-2 py-1 bg-slate-100">{previewMode ? 'Edit' : 'Preview'}</button>
        </div>

        {previewMode ? (
          <div className="border p-2 mb-2 bg-white">
            <div className="font-semibold mb-2">{title}</div>
            <div className="prose" dangerouslySetInnerHTML={{ __html: (body || '').replace(/\n/g, '<br/>') }} />
          </div>
        ) : null}

        <div className="flex gap-2"><button onClick={send} className="px-3 py-1 bg-blue-500 text-white rounded">Create & Send</button></div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Recent announcements</h3>
        {loading && <div>Loading…</div>}
        <ul>
          {list.map(a => (
            <li key={a.id} className="border-b py-2">
              <div className="font-semibold">{a.title}</div>
              <div className="text-sm text-gray-700">{a.body}</div>
              <div className="text-xs text-gray-400">{new Date(a.created_at || a.createdAt || Date.now()).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
