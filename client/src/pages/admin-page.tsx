import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency-formatter";
import { Loader2, PieChart, BarChart, User as UserIcon, RefreshCw, Shield, Filter, ShieldOff, DollarSign, FileText, TrendingUp, Star, ArrowLeft } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
// Popover removed from budgets controls; kept imports clean
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "@/components/admin/user-management";
import Announcements from "@/components/admin/announcements";
import AdminSettings from "@/components/admin/settings";
import AdminDashboard from '@/components/admin/dashboard';
import RoleManagement from '@/components/admin/role-management';
import CreateBudgetDialog from '@/components/budget/create-budget-dialog';
import AddExpenseDialog from '@/components/expense/add-expense-dialog';
import AdminCreateBudgetDialog from '@/components/admin/admin-create-budget-dialog';
import AdminCreateExpenseDialog from '@/components/admin/admin-create-expense-dialog';
import EditExpenseDialog from '@/components/expense/edit-expense-dialog';
import EditBudgetDialog from '@/components/budget/edit-budget-dialog';
import { useRef } from 'react';

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("users");
  const [, setLocation] = useLocation();

  // Check if user is admin
  useEffect(() => {
    if (user?.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin dashboard.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Fetch all expenses (for admin view)
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0); 
  const [size, setSize] = useState(20);

  const { data: categories } = useQuery({
    queryKey: ['/api/expense-categories'],
    queryFn: async () => {
      const res = await fetch('/api/expense-categories');
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    },
    enabled: user?.role === 'admin' && selectedTab === 'expenses'
  });

  const { data: expensesPayload, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['/api/admin/expenses', search, categoryFilter, page, size],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (categoryFilter) params.set('categoryId', String(categoryFilter));
      params.set('page', String(page));
      params.set('size', String(size));
      const response = await fetch(`/api/admin/expenses?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }
      return response.json();
    },
    enabled: user?.role === 'admin' && selectedTab === 'expenses'
  });

  const expenses = expensesPayload?.expenses || [];
  const totalAmount = expensesPayload?.totalAmount ?? 0;
  const totalCount = expensesPayload?.totalCount ?? 0;

  // simple category color map (extend as needed)
  const categoryColors: Record<string, string> = {
    'Food': 'bg-red-100 text-red-700',
    'Transportation': 'bg-blue-100 text-blue-700',
    'Health': 'bg-emerald-100 text-emerald-700',
    'Uncategorized': 'bg-gray-100 text-gray-800'
  };

  // Fetch all budgets (for admin view)
  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetUserFilter, setBudgetUserFilter] = useState<number | 'all'>('all');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'all' | 'active'>('all');
  const [budgetPage, setBudgetPage] = useState(0);
  const [budgetSize, setBudgetSize] = useState(20);

  const { data: usersForFilter } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
    enabled: user?.role === 'admin'
  });

  const { data: budgetsPayload, isLoading: isLoadingBudgets } = useQuery<any, Error>({
    queryKey: ['/api/admin/budgets', budgetSearch, budgetUserFilter, budgetStatusFilter, budgetPage, budgetSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (budgetSearch) params.set('q', budgetSearch);
      if (budgetUserFilter && budgetUserFilter !== 'all') params.set('userId', String(budgetUserFilter));
      if (budgetStatusFilter && budgetStatusFilter !== 'all') params.set('status', budgetStatusFilter);
      params.set('page', String(budgetPage));
      params.set('size', String(budgetSize));
      const url = `/api/admin/budgets?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch budgets');
      return res.json();
    },
    enabled: user?.role === 'admin' && selectedTab === 'budgets'
  });

  // Support several possible response shapes from the server:
  // - { budgets: [...] , totalCount, totalAmount, avgAmount, activeCount }
  // - { rows: [...], totalCount }
  // - directly an array of budgets
  const budgets: any[] = (() => {
    if (!budgetsPayload) return [];
    if (Array.isArray(budgetsPayload)) return budgetsPayload as any[];
    if (Array.isArray(budgetsPayload.budgets)) return budgetsPayload.budgets;
    if (Array.isArray(budgetsPayload.rows)) return budgetsPayload.rows;
    return [];
  })();

  const budgetsTotalAmount = budgetsPayload?.totalAmount ?? budgetsPayload?.total_amount ?? budgets.reduce((s: number, b: any) => s + (b.amount || 0), 0);
  const budgetsAvgAmount = budgetsPayload?.avgAmount ?? budgetsPayload?.avg_amount ?? (budgets.length > 0 ? budgetsTotalAmount / budgets.length : 0);
  const budgetsTotalCount = budgetsPayload?.totalCount ?? budgetsPayload?.total_count ?? budgets.length;
  const budgetsActiveCount = budgetsPayload?.activeCount ?? budgetsPayload?.active_count ?? budgets.filter((b: any) => {
    const start = b.startDate ? new Date(b.startDate) : (b.start_date ? new Date(b.start_date) : null);
    const end = b.endDate ? new Date(b.endDate) : (b.end_date ? new Date(b.end_date) : null);
    const now = new Date();
    return start && end && now >= start && now <= end;
  }).length;

  // Admin overview stats (for KPI cards)
  const { data: stats } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
    enabled: user?.role === 'admin'
  });

  // Summary of all expenses (for totals)
  const { data: expensesSummary } = useQuery({
    queryKey: ['/api/admin/expenses', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/expenses');
      if (!res.ok) throw new Error('Failed to load expenses summary');
      return res.json();
    },
    enabled: user?.role === 'admin'
  });

  // Get incomes count (to compute total transactions)
  const { data: incomesAll } = useQuery({
    queryKey: ['/api/admin/incomes', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/incomes');
      if (!res.ok) throw new Error('Failed to load incomes');
      return res.json();
    },
    enabled: user?.role === 'admin'
  });

  const totalTransactionsCount = (expensesSummary?.totalCount ?? 0) + (incomesAll ? incomesAll.length : 0);
  const totalTransactionsAmount = (expensesSummary?.totalAmount ?? 0) + (incomesAll ? incomesAll.reduce((s: number, i: any) => s + (i.amount || 0), 0) : 0);

  // Local state for admin create dialogs
  const createBudgetDialogRef = useRef<HTMLButtonElement | null>(null);
  const createExpenseDialogRef = useRef<HTMLButtonElement | null>(null);

  const createBudgetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Failed to create budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/budgets'] });
      toast({ title: 'Budget created' });
    },
    onError: (err: any) => toast({ title: 'Failed to create budget', description: err.message, variant: 'destructive' })
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Failed to create expense');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/expenses'] });
      toast({ title: 'Expense created' });
    },
    onError: (err: any) => toast({ title: 'Failed to create expense', description: err.message, variant: 'destructive' })
  });

  

  const deleteBudget = async (id: number) => {
    if (!window.confirm('Delete this budget? This action cannot be undone.')) return;
    const res = await fetch(`/api/admin/budgets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/budgets'] });
      toast({ title: 'Budget deleted' });
    } else {
      const err = await res.json();
      toast({ title: 'Failed to delete budget', description: err.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const deleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense? This action cannot be undone.')) return;
    const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/expenses'] });
      toast({ title: 'Expense deleted' });
    } else {
      const err = await res.json();
      toast({ title: 'Failed to delete expense', description: err.message || 'Unknown error', variant: 'destructive' });
    }
  };

  // Edit state
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editingBudget, setEditingBudget] = useState<any | null>(null);
  // Debug: log when editingExpense changes
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug("editingExpense state changed", editingExpense);
    } catch (e) {}
  }, [editingExpense]);
  // Create dialog state for admin flows
  const [isAdminCreateBudgetOpen, setIsAdminCreateBudgetOpen] = useState(false);
  const [isAdminCreateExpenseOpen, setIsAdminCreateExpenseOpen] = useState(false);

  if (user?.role !== "admin") {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500">
              Please contact an administrator if you believe you should have access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* debug UI removed - Edit dialog renders below */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of users, transactions and system status</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Back button with black background */}
          <Button
            size="sm"
            variant="default"
            className="inline-flex items-center bg-black hover:bg-gray-800 text-white"
            onClick={() => {
              // Navigate to the normal user app/home page reliably
              try { setLocation('/'); } catch (e) { /* location update non-critical */ }
              // Fallback to hard navigation if SPA navigation didn't work
              try { setTimeout(() => { if (typeof window !== 'undefined') window.location.assign('/'); }, 120); } catch (e) {}
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to App
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>
      {/* Test control: open edit modal for first expense (temporary) */}
      <div className="mb-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              // eslint-disable-next-line no-console
              console.debug('Test Edit Modal clicked', { hasExpenses: !!(expenses && expenses.length > 0) });
            } catch (e) {}
            if (expenses && expenses.length > 0) setEditingExpense(expenses[0]);
          }}
        >
          Open Edit (test)
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-r from-white to-indigo-50">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <div className="text-xs text-gray-500">Across all accounts</div>
              </div>
            </div>
            <div className="text-2xl font-bold">{stats ? stats.totalUsers : '—'}</div>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-white to-green-50">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 text-green-600 rounded-full p-2">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <div className="text-xs text-gray-500">Not suspended</div>
              </div>
            </div>
            <div className="text-2xl font-bold">{stats ? stats.activeUsers : '—'}</div>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-white to-sky-50">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-sky-50 text-sky-600 rounded-full p-2">
                <BarChart className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <div className="text-xs text-gray-500">Expenses + incomes</div>
              </div>
            </div>
            <div className="text-2xl font-bold">{totalTransactionsCount}</div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">Combined amount</div>
            <div className="text-lg font-bold">{formatCurrency(totalTransactionsAmount)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-white to-yellow-50">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-50 text-yellow-600 rounded-full p-2">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Suspended</CardTitle>
                <div className="text-xs text-gray-500">Accounts with restrictions</div>
              </div>
            </div>
            <div className="text-2xl font-bold">{stats ? stats.suspendedUsers : '—'}</div>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-7 max-w-4xl">
                <TabsTrigger value="dashboard">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="users">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="roles">
                  <Shield className="h-4 w-4 mr-2" />
                  Roles
                </TabsTrigger>
                <TabsTrigger value="expenses">
                  <BarChart className="h-4 w-4 mr-2" />
                  Expenses
                </TabsTrigger>
                <TabsTrigger value="budgets">
                  <PieChart className="h-4 w-4 mr-2" />
                  Budgets
                </TabsTrigger>
                <TabsTrigger value="announcements">
                  <Shield className="h-4 w-4 mr-2" />
                  Announcements
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
                
                
                {/* Reports tab removed to avoid UI interference */}
              </TabsList>

        {/* DASHBOARD / OVERVIEW TAB */}
        <TabsContent value="dashboard">
          <AdminDashboard />
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        {/* ROLES & PERMISSIONS TAB */}
        <TabsContent value="roles">
          <RoleManagement />
        </TabsContent>

        {/* ANNOUNCEMENTS TAB */}
        <TabsContent value="announcements">
          <Announcements />
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          {/* KPI Cards for Expenses - separate from the table card */}
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                  <div className="text-xs text-gray-500">All expenses</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCount}</div>
                  <div className="text-xs text-gray-500">Count</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(totalCount > 0 ? formatCurrency(totalAmount / totalCount) : formatCurrency(0))}</div>
                  <div className="text-xs text-gray-500">Mean per expense</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Highest Expense</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{
                    (() => {
                      const arr = expenses || [];
                      const max = arr.reduce((m: number, e: any) => Math.max(m, e.amount || 0), 0);
                      return formatCurrency(max);
                    })()
                  }</div>
                  <div className="text-xs text-gray-500">Largest single expense</div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Expenses</CardTitle>
              <CardDescription>
                View all expenses across all users in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Controls: search + filter (cards are shown above) */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 w-full md:w-2/3">
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Search expenses by description, merchant or user"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    className="border rounded px-3 py-2"
                    value={categoryFilter ?? ''}
                    onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">All categories</option>
                    {categories && categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <ExportButton
                    onExportPDF={async () => {
                      const params = new URLSearchParams();
                      if (search) params.set('q', search);
                      if (categoryFilter) params.set('categoryId', String(categoryFilter));
                      const url = `/api/admin/expenses/export?${params.toString()}`;
                      window.open(url, '_blank');
                    }}
                    onExportCSV={async () => {
                      const params = new URLSearchParams();
                      if (search) params.set('q', search);
                      if (categoryFilter) params.set('categoryId', String(categoryFilter));
                      const url = `/api/admin/expenses/export?${params.toString()}`;
                      window.open(url, '_blank');
                    }}
                    isLoading={isLoadingExpenses}
                    disabled={!(expenses && expenses.length > 0)}
                    label="Export"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setIsAdminCreateExpenseOpen(true)}>Add Expense</Button>
                </div>
              </div>

              {isLoadingExpenses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="overflow-x-auto border rounded">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses && expenses.length > 0 ? (
                      expenses.map((expense: any, idx: number) => (
                        <TableRow key={expense.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}> 
                          <TableCell className="font-medium">{expense.userName || "Unknown"}</TableCell>
                          <TableCell className="max-w-sm truncate">{expense.description || expense.merchant || '—'}</TableCell>
                          <TableCell>
                            <span className={`${categoryColors[expense.categoryName ?? 'Uncategorized'] ?? 'bg-gray-100 text-gray-800'} inline-flex items-center px-2 py-1 rounded-full text-xs font-medium`}>
                              {expense.categoryName || "Uncategorized"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{expense.date ? new Date(expense.date).toLocaleString() : new Date(expense.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                          <TableCell className="text-right w-24">
                            <Button size="sm" variant="destructive" onClick={() => deleteExpense(expense.id)}>Delete</Button>
                          </TableCell>
                                  <TableCell className="text-right w-24">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => {
                                        try {
                                          // debug log when edit is clicked
                                          // eslint-disable-next-line no-console
                                          console.debug("Edit expense clicked", { id: expense.id });
                                        } catch (e) {}
                                        setEditingExpense(expense);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                          No expenses found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
            {expenses && expenses.length > 0 && (
              <CardFooter className="border-t px-6 py-4">
                <div className="w-full flex justify-between">
                  <span className="font-medium">Total Expenses:</span>
                  <span className="font-medium">
                    {formatCurrency(totalAmount)} ({totalCount} items)
                  </span>
                </div>
              </CardFooter>
            )}
            {/* Pagination controls */}
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border rounded" disabled={page <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</button>
                <div>Page {page + 1}</div>
                <button className="px-3 py-1 border rounded" disabled={(page+1)*size >= (expensesPayload?.totalCount ?? 0)} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Rows per page:</div>
                <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} className="border rounded px-2 py-1">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            {/* Category legend */}
            <div className="flex gap-3 px-6 py-3">
              {Object.entries(categoryColors).map(([name, cls]) => (
                <div key={name} className="flex items-center gap-2">
                  <span className={`${cls} inline-block w-4 h-4 rounded-full`} />
                  <span className="text-xs text-gray-700">{name}</span>
                </div>
              ))}
            </div>
          </Card>
          {/* Add expense dialog hook */}
          <AddExpenseDialog isOpen={false} onClose={() => {}} />
        </TabsContent>

        {/* BUDGETS TAB */}
        <TabsContent value="budgets">
          {/* KPI Cards for Budgets - separate from the table card */}
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Budgets</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{budgetsTotalCount ?? '—'}</div>
                  <div className="text-xs text-gray-500">All users</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Budgets</CardTitle>
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{budgetsActiveCount ?? '—'}</div>
                  <div className="text-xs text-gray-500">Currently active</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(budgetsTotalAmount)}</div>
                  <div className="text-xs text-gray-500">Sum of budgets</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Budget</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(budgetsAvgAmount)}</div>
                  <div className="text-xs text-gray-500">Per budget</div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Budgets</CardTitle>
              <CardDescription>Manage system budgets across users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setIsAdminCreateBudgetOpen(true)}>Add Budget</Button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 w-full md:w-2/3">
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Search budgets by name"
                    value={budgetSearch}
                    onChange={(e) => { setBudgetSearch(e.target.value); setBudgetPage(0); }}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-full md:w-80">
                    <Select value={budgetUserFilter === 'all' ? 'all' : String(budgetUserFilter)} onValueChange={(v) => { setBudgetUserFilter(v === 'all' ? 'all' : Number(v)); setBudgetPage(0); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users</SelectItem>
                        {usersForFilter && usersForFilter.map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.username} ({u.name})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <ExportButton
                    onExportPDF={async () => {
                      const params = new URLSearchParams();
                      if (budgetSearch) params.set('q', budgetSearch);
                      if (budgetUserFilter && budgetUserFilter !== 'all') params.set('userId', String(budgetUserFilter));
                      const url = `/api/admin/budgets/export?${params.toString()}`;
                      window.open(url, '_blank');
                    }}
                    onExportCSV={async () => {
                      const params = new URLSearchParams();
                      if (budgetSearch) params.set('q', budgetSearch);
                      if (budgetUserFilter && budgetUserFilter !== 'all') params.set('userId', String(budgetUserFilter));
                      const url = `/api/admin/budgets/export?${params.toString()}`;
                      window.open(url, '_blank');
                    }}
                    isLoading={isLoadingBudgets}
                    disabled={!(budgets && budgets.length > 0)}
                    label="Export"
                  />
                </div>
              </div>

              {isLoadingBudgets ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="overflow-x-auto bg-card border rounded shadow-sm">
                <Table className="min-w-full divide-y divide-gray-200">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Budget Name</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets && budgets.length > 0 ? (
                      budgets.map((budget: any) => (
                        <TableRow key={budget.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium w-48">{budget.userName || budget.userFullName || "Unknown"}</TableCell>
                          <TableCell className="w-64">{budget.name}</TableCell>
                          <TableCell className="w-32">
                            {budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : 'N/A'}
                          </TableCell>
                          <TableCell className="w-48">
                            {budget.startDate ? new Date(budget.startDate).toLocaleDateString() : '—'} - {budget.endDate ? new Date(budget.endDate).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right w-36 font-medium">{formatCurrency(budget.amount)}</TableCell>
                          <TableCell className="text-right w-24">
                            <Button size="sm" variant="destructive" onClick={() => deleteBudget(budget.id)}>Delete</Button>
                          </TableCell>
                            <TableCell className="text-right w-24">
                              <Button size="sm" variant="secondary" onClick={() => setEditingBudget(budget)}>Edit</Button>
                            </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                          No budgets found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>

            {/* Pagination and footer */}
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border rounded" disabled={budgetPage <= 0} onClick={() => setBudgetPage(p => Math.max(0, p - 1))}>Prev</button>
                <div>Page {budgetPage + 1}</div>
                <button className="px-3 py-1 border rounded" disabled={(budgetPage+1)*budgetSize >= (budgetsPayload?.totalCount ?? 0)} onClick={() => setBudgetPage(p => p + 1)}>Next</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Rows per page:</div>
                <select value={budgetSize} onChange={(e) => { setBudgetSize(Number(e.target.value)); setBudgetPage(0); }} className="border rounded px-2 py-1">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </Card>
          <AdminCreateBudgetDialog isOpen={isAdminCreateBudgetOpen} onClose={() => setIsAdminCreateBudgetOpen(false)} />
          <AdminCreateExpenseDialog isOpen={isAdminCreateExpenseOpen} onClose={() => setIsAdminCreateExpenseOpen(false)} />
          {/* Edit dialogs for admin */}
          {editingExpense && (
            <EditExpenseDialog expense={editingExpense} isOpen={!!editingExpense} onClose={() => setEditingExpense(null)} admin />
          )}
          {editingBudget && (
            <EditBudgetDialog budget={editingBudget} isOpen={!!editingBudget} onClose={() => setEditingBudget(null)} admin />
          )}
        </TabsContent>

        {/* REPORTS TAB REMOVED */}
      </Tabs>
    </div>
  );
}