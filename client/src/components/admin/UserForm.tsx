import React, { useState, useEffect } from 'react';

type User = { id?: number; username: string; name: string; email: string; role?: string; status?: string };

export default function UserForm({ user, onSaved }: { user?: User; onSaved: () => void }) {
  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'user');
  const [password, setPassword] = useState('');

  useEffect(()=>{
    setUsername(user?.username || ''); setName(user?.name || ''); setEmail(user?.email || ''); setRole(user?.role || 'user');
  },[user]);

  const save = async () => {
    if (!username || !name || !email) { alert('Please fill required fields'); return; }
    if (user?.id) {
      await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, email, role }) });
      alert('Updated');
    } else {
      await fetch('/api/admin/users', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, name, email, password, role }) });
      alert('Created');
    }
    onSaved();
  };

  return (
    <div className="p-4 border rounded">
      <div className="mb-2">
        <label htmlFor="username" className="block">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="border p-1 w-full"
          disabled={!!user?.id}
        />
      </div>

      <div className="mb-2">
        <label htmlFor="name" className="block">Name</label>
        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className="border p-1 w-full" />
      </div>

      <div className="mb-2">
        <label htmlFor="email" className="block">Email</label>
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="border p-1 w-full" />
      </div>

      {!user?.id && (
        <div className="mb-2">
          <label htmlFor="password" className="block">Password</label>
          <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="border p-1 w-full" />
        </div>
      )}

      <div className="mb-2">
        <label htmlFor="role" className="block">Role</label>
        <select id="role" value={role} onChange={e => setRole(e.target.value)} className="border p-1 w-full">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="flex gap-2"><button onClick={save} className="bg-blue-500 text-white px-3 py-1">Save</button></div>
    </div>
  );
}
