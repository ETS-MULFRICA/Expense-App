import React, { useEffect, useState } from "react";

type Message = {
  id: number;
  subject: string;
  body: string;
  from_admin_id: number | null;
  sent_at: string;
  is_read: boolean;
};

export default function Inbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInbox = async () => {
    setLoading(true);
    const res = await fetch("/api/messages/inbox");
    if (res.ok) {
      const data = await res.json();
      setMessages(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchInbox(); }, []);

  const openMessage = async (m: Message) => {
    setSelected(m);
    if (!m.is_read) {
      await fetch(`/api/messages/${m.id}/read`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_read: true }) });
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_read: true } : x));
    }
  };

  const deleteMessage = async (id: number) => {
    if (!confirm("Delete message?")) return;
    const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } else {
      alert("Failed to delete message");
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Inbox</h1>
      <div className="mb-4">
        <button onClick={fetchInbox} className="px-3 py-1 bg-blue-500 text-white rounded">Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 border rounded p-2 h-96 overflow-auto">
          {loading && <div>Loading...</div>}
          {!loading && messages.length === 0 && <div>No messages</div>}
          <ul>
            {messages.map(m => (
              <li key={m.id} className={`p-2 border-b cursor-pointer ${m.is_read ? "" : "bg-yellow-50"}`} onClick={() => openMessage(m)}>
                <div className="flex justify-between">
                  <strong>{m.subject}</strong>
                  <small className="text-gray-500">{new Date(m.sent_at).toLocaleString()}</small>
                </div>
                <div className="text-sm text-gray-600">{m.is_read ? "Read" : "Unread"}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 border rounded p-4 h-96 overflow-auto">
          {!selected && <div className="text-gray-600">Select a message to view</div>}
          {selected && (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{selected.subject}</h2>
                  <div className="text-sm text-gray-500">{new Date(selected.sent_at).toLocaleString()}</div>
                </div>
                <div className="space-x-2">
                  <button onClick={()=>deleteMessage(selected.id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
                </div>
              </div>
              <hr className="my-3" />
              <div dangerouslySetInnerHTML={{ __html: selected.body }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}