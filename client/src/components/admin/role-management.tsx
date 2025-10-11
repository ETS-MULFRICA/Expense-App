import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function RoleManagement() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  async function fetchRoles() {
    const res = await fetch('/api/admin/roles');
    if (res.ok) setRoles(await res.json());
  }

  async function fetchPermissions() {
    const res = await fetch('/api/admin/permissions');
    if (res.ok) setPermissions(await res.json());
  }

  async function createRole() {
    if (!newRoleName) return;
    const res = await fetch('/api/admin/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newRoleName }) });
    if (res.ok) {
      toast({ title: 'Role created' });
      setNewRoleName('');
      fetchRoles();
    } else {
      toast({ title: 'Failed to create role', variant: 'destructive' });
    }
  }

  async function fetchRolePermissions(roleId: number) {
    const res = await fetch(`/api/admin/roles/${roleId}/permissions`);
    if (res.ok) setRolePermissions(await res.json());
    else setRolePermissions([]);
  }

  async function togglePermission(roleId: number, permissionId: number) {
    const has = rolePermissions.includes(String(permissionId));
    const url = `/api/admin/roles/${roleId}/permissions/${permissionId}`;
    const res = await fetch(url, { method: has ? 'DELETE' : 'POST' });
    if (res.ok || res.status === 204) {
      toast({ title: has ? 'Permission removed' : 'Permission assigned' });
      fetchRolePermissions(roleId);
    } else {
      toast({ title: 'Failed to update permission', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Role name" className="input" />
        <Button onClick={createRole}>Create Role</Button>
      </div>

      <div>
        <h4 className="font-medium">Existing Roles</h4>
        <div className="mt-2">
          <Select onValueChange={(val) => { setSelectedRole(val); const id = Number(val); if (!isNaN(id)) fetchRolePermissions(id); }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map(r => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name} {r.description ? `- ${r.description}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRole && (
          <div className="mt-4">
            <h5 className="font-medium">Permissions for selected role</h5>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {permissions.map(p => {
                const checked = rolePermissions.includes(String(p.id));
                return (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={checked} onChange={() => togglePermission(Number(selectedRole), p.id)} />
                    <span>{p.name} {p.description ? `- ${p.description}` : ''}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
