import React from 'react';
import AdminUsersPage from './admin-users';
import AdminExpenses from '../components/admin/admin-expenses';
import AdminIncomes from '../components/admin/admin-incomes';
import AdminBudgets from '../components/admin/admin-budgets';
import RoleManagement from '../components/admin/role-management';
import AdminDashboard from '../components/admin/admin-dashboard';
import AnnouncementsAdmin from '../components/admin/announcements';

export default function AdminPage() {
  const [tab, setTab] = React.useState<'dashboard'|'users'|'expenses'|'incomes'|'budgets'|'roles'|'announcements'>('users');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="text-sm px-3 py-1 border rounded">Back</button>
        </div>
      </div>

      <div className="mb-4">
        <nav className="flex gap-2">
          <button className={`px-3 py-1 rounded ${tab==='dashboard' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={`px-3 py-1 rounded ${tab==='users' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('users')}>Users</button>
          <button className={`px-3 py-1 rounded ${tab==='expenses' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('expenses')}>Expenses</button>
          <button className={`px-3 py-1 rounded ${tab==='incomes' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('incomes')}>Incomes</button>
          <button className={`px-3 py-1 rounded ${tab==='budgets' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('budgets')}>Budgets</button>
          <button className={`px-3 py-1 rounded ${tab==='roles' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('roles')}>Roles</button>
          <button className={`px-3 py-1 rounded ${tab==='announcements' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('announcements')}>Announcements</button>
        </nav>
      </div>

      <div>
  {tab === 'dashboard' && <AdminDashboard />}
  {tab === 'users' && <AdminUsersPage />}
        {tab === 'expenses' && <AdminExpenses />}
        {tab === 'incomes' && <AdminIncomes />}
        {tab === 'budgets' && <AdminBudgets />}
        {tab === 'roles' && <RoleManagement />}
        {tab === 'announcements' && <AnnouncementsAdmin />}
      </div>
    </div>
  );
}
