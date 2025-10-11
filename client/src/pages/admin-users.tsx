import React, { useState } from 'react';
import UsersList from '../components/admin/UsersList';
import UserForm from '../components/admin/UserForm';

export default function AdminUsersPage(){
  const [editingUser, setEditingUser] = useState<any | undefined>(undefined);
  const onSaved = ()=> { setEditingUser(undefined); window.location.reload(); };
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin - User Management</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2"><UsersList onEdit={u=>setEditingUser(u)} /></div>
        <div className="col-span-1">
          <h3 className="font-semibold mb-2">Create / Edit User</h3>
          <UserForm user={editingUser} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}
