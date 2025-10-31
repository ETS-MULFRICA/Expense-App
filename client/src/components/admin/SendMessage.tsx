import React, { useState } from "react";

export default function SendMessage() {
  const [toUserId, setToUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailUser, setEmailUser] = useState(true);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: Number(toUserId), subject, body, emailUser })
    });
    if (res.ok) {
      alert("Message sent");
      setToUserId(""); setSubject(""); setBody("");
    } else {
      alert("Failed to send message");
    }
  };

  return (
    <form onSubmit={send} className="p-4 max-w-lg">
      <h2 className="text-lg font-semibold mb-2">Send message to user</h2>
      <label className="block mb-2">User ID<input value={toUserId} onChange={e=>setToUserId(e.target.value)} className="w-full border p-1" /></label>
      <label className="block mb-2">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full border p-1" /></label>
      <label className="block mb-2">Body<textarea value={body} onChange={e=>setBody(e.target.value)} className="w-full border p-1 h-28" /></label>
      <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={emailUser} onChange={e=>setEmailUser(e.target.checked)} /> Also send email</label>
      <button className="px-3 py-1 bg-blue-600 text-white rounded">Send</button>
    </form>
  );
}