import React, { useEffect, useState } from "react";

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
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data: User[] = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    if (q && !`${u.username} ${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (role && u.role !== role) return false;
    if (status && (u.status || "active") !== status) return false;
    return true;
  });

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Users</h2>

      <div className="flex gap-2 mb-4">
        <input aria-label="Search users" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search" className="border p-1" />
        <select value={role} onChange={e=>setRole(e.target.value)} className="border p-1">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="user">User</option>
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="border p-1">
          <option value="">Any status</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
        <button onClick={fetchUsers} className="bg-blue-500 text-white px-3 rounded">Refresh</button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Username</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center">No users found</td></tr>
            )}
            {!loading && filtered.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.username}</td>
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">{u.status || "active"}</td>
                <td className="p-2 text-right">
                  <button onClick={()=>onEdit(u)} className="bg-yellow-400 px-2 py-1 rounded mr-2">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
