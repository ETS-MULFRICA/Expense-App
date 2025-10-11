import React, { useEffect, useState } from 'react';

type User = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  status?: string;
};

export default function UsersList({ onEdit }: { onEdit: (u: User) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/users/search?${params.toString()}`);
    const data = await res.json();
    setUsers(data || []);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Users</h2>
      <div className="flex gap-2 mb-4">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search" className="border p-1" />
        <select value={role} onChange={e=>setRole(e.target.value)} className="border p-1">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="border p-1">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <button onClick={fetchUsers} className="bg-blue-500 text-white px-3 py-1">Search</button>
      </div>

      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">Username</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">Role</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="border px-2 py-1">{u.username}</td>
              <td className="border px-2 py-1">{u.name}</td>
              <td className="border px-2 py-1">{u.email}</td>
              <td className="border px-2 py-1">{u.role}</td>
              <td className="border px-2 py-1">{u.status || 'active'}</td>
              <td className="border px-2 py-1 space-x-2">
                <button onClick={()=>onEdit(u)} className="text-sm bg-yellow-300 px-2">Edit</button>
                <button onClick={async ()=>{
                  if (!confirm('Suspend user?')) return;
                  await fetch(`/api/admin/users/${u.id}/suspend`, { method: 'PATCH' });
                  fetchUsers();
                }} className="text-sm bg-orange-300 px-2">Suspend</button>
                <button onClick={async ()=>{
                  if (!confirm('Reactivate user?')) return;
                  await fetch(`/api/admin/users/${u.id}/reactivate`, { method: 'PATCH' });
                  fetchUsers();
                }} className="text-sm bg-green-300 px-2">Reactivate</button>
                <button onClick={async ()=>{
                  if (!confirm('Soft-delete user?')) return;
                  await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                  fetchUsers();
                }} className="text-sm bg-red-400 text-white px-2">Delete</button>
                <button onClick={async ()=>{
                  if (!confirm('Reset password and return temporary password?')) return;
                  const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ generateTemporary: true }) });
                  const body = await res.json();
                  alert('Temporary password: ' + (body.temporaryPassword || '(not returned)'));
                }} className="text-sm bg-indigo-300 px-2">Reset</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
