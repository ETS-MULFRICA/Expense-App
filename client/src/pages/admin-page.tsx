import React from 'react';
import AdminUsersPage from './admin-users';
import AdminExpenses from '../components/admin/admin-expenses';
import AdminIncomes from '../components/admin/admin-incomes';
import AdminBudgets from '../components/admin/admin-budgets';
import RoleManagement from '../components/admin/role-management';

export default function AdminPage() {
  const [tab, setTab] = React.useState<'users'|'expenses'|'incomes'|'budgets'|'roles'>('users');

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
          <button className={`px-3 py-1 rounded ${tab==='users' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('users')}>Users</button>
          <button className={`px-3 py-1 rounded ${tab==='expenses' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('expenses')}>Expenses</button>
          <button className={`px-3 py-1 rounded ${tab==='incomes' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('incomes')}>Incomes</button>
          <button className={`px-3 py-1 rounded ${tab==='budgets' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('budgets')}>Budgets</button>
          <button className={`px-3 py-1 rounded ${tab==='roles' ? 'bg-slate-200' : 'bg-white'}`} onClick={() => setTab('roles')}>Roles</button>
        </nav>
      </div>

      <div>
        {tab === 'users' && <AdminUsersPage />}
        {tab === 'expenses' && <AdminExpenses />}
        {tab === 'incomes' && <AdminIncomes />}
        {tab === 'budgets' && <AdminBudgets />}
        {tab === 'roles' && <RoleManagement />}
      </div>
    </div>
  );
}
