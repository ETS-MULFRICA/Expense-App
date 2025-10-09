import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Budget } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/currency-formatter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Plus, 
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Filter,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BudgetWithUser extends Budget {
  userName?: string;
  userEmail?: string;
  status?: 'active' | 'expired';
  spent?: number;
  categoryName?: string;
  categories?: Array<{
    id: number;
    name: string;
    allocatedAmount: number;
    spentAmount: number;
    isAllocated: boolean;
  }>;
}

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface CreateBudgetData {
  name: string;
  description?: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  category_id?: number;
  user_id: number;
  start_date: string;
  end_date: string;
}

const statusColors: { [key: string]: string } = {
  'on-track': 'bg-green-100 text-green-800',
  'warning': 'bg-yellow-100 text-yellow-800',
  'over-budget': 'bg-red-100 text-red-800',
  'inactive': 'bg-gray-100 text-gray-800',
  'active': 'bg-green-100 text-green-800',
  'expired': 'bg-gray-100 text-gray-800'
};

export default function BudgetsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    amount: "",
    period: "",
    category_id: "",
    user_id: "",
    start_date: "",
    end_date: ""
  });
  
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    amount: "",
    period: "",
    category_id: "",
    start_date: "",
    end_date: ""
  });

  // Fetch all budgets with filters
  const { data: budgetsResponse, isLoading: isLoadingBudgets, refetch: refetchBudgets } = useQuery({
    queryKey: ["/api/admin/budgets", searchQuery, userFilter, statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (userFilter && userFilter !== "all") params.append("userId", userFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
      
      const response = await fetch(`/api/admin/budgets?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch budgets");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  const budgets: BudgetWithUser[] = (budgetsResponse?.budgets || []).map((budget: any) => ({
    ...budget,
    userName: budget.userName,
    userEmail: budget.userEmail,
    categories: budget.categories || [],
    spent: budget.categories ? budget.categories.reduce((sum: number, cat: any) => sum + cat.spentAmount, 0) : 0,
    status: budget.status || 'active'
  }));

  // Fetch all users for filters and creation
  const { data: allUsers } = useQuery({
    queryKey: ["/api/admin/users/search"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users/search");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Fetch all categories
  const { data: allCategories } = useQuery({
    queryKey: ["/api/admin/categories"],
    queryFn: async () => {
      const response = await fetch("/api/admin/categories");
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (budgetData: CreateBudgetData) => {
      const response = await fetch("/api/admin/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgetData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create budget");
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
      toast({ title: "Success", description: "Budget created successfully" });
      setIsCreateDialogOpen(false);
      setCreateForm({
        name: "",
        description: "",
        amount: "",
        period: "",
        category_id: "",
        user_id: "",
        start_date: "",
        end_date: ""
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async ({ budgetId, budgetData }: { budgetId: number; budgetData: Partial<CreateBudgetData> }) => {
      const response = await fetch(`/api/admin/budgets/${budgetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgetData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update budget");
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
      toast({ title: "Success", description: "Budget updated successfully" });
      setIsEditDialogOpen(false);
      setSelectedBudget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete budget mutation
  const deleteBudgetMutation = useMutation({
    mutationFn: async (budgetId: number) => {
      const response = await fetch(`/api/admin/budgets/${budgetId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete budget");
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
      toast({ title: "Success", description: "Budget deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateBudget = () => {
    const budgetData: CreateBudgetData = {
      name: createForm.name,
      description: createForm.description || undefined,
      amount: parseFloat(createForm.amount),
      period: createForm.period as 'weekly' | 'monthly' | 'yearly',
      category_id: createForm.category_id ? parseInt(createForm.category_id) : undefined,
      user_id: parseInt(createForm.user_id),
      start_date: createForm.start_date,
      end_date: createForm.end_date,
    };
    createBudgetMutation.mutate(budgetData);
  };

  const handleUpdateBudget = () => {
    if (selectedBudget) {
      const budgetData: Partial<CreateBudgetData> = {
        name: editForm.name,
        description: editForm.description || undefined,
        amount: parseFloat(editForm.amount),
        period: editForm.period as 'weekly' | 'monthly' | 'yearly',
        category_id: editForm.category_id ? parseInt(editForm.category_id) : undefined,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
      };
      updateBudgetMutation.mutate({ 
        budgetId: selectedBudget.id, 
        budgetData 
      });
    }
  };

  const handleDeleteBudget = (budgetId: number) => {
    deleteBudgetMutation.mutate(budgetId);
  };

  const handleEditClick = (budget: BudgetWithUser) => {
    setSelectedBudget(budget);
    setEditForm({
      name: budget.name,
      description: budget.notes || "",
      amount: budget.amount.toString(),
      period: budget.period,
      category_id: "", // No category_id in basic budget schema
      start_date: new Date(budget.startDate).toISOString().split('T')[0],
      end_date: new Date(budget.endDate).toISOString().split('T')[0]
    });
    setIsEditDialogOpen(true);
  };

  // Calculate totals
  const totalBudgets = budgets?.length || 0;
  const totalAmount = budgets?.reduce((sum: number, budget: BudgetWithUser) => sum + budget.amount, 0) || 0;
  const averageAmount = totalBudgets > 0 ? totalAmount / totalBudgets : 0;
  const activeBudgets = budgets?.filter((budget: BudgetWithUser) => {
    const now = new Date();
    const isActive = (!budget.endDate || new Date(budget.endDate) >= now) && 
                    new Date(budget.startDate) <= now;
    return isActive;
  }).length || 0;

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="text-gray-500">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBudgets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Budgets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBudgets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(averageAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Budget Management
              </CardTitle>
              <CardDescription>
                Manage all budgets across the system
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => refetchBudgets()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search budgets by name, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-48">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers?.map((user: User) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="on-track">On Track</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="over-budget">Over Budget</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories?.map((category: Category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Budgets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Budgets</CardTitle>
          <CardDescription>
            View and manage all budgets in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBudgets ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categories
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {budgets && budgets.length > 0 ? (
                    budgets.map((budget: any) => {
                      const progressPercent = budget.amount > 0 ? Math.min((budget.spent || 0) / budget.amount * 100, 100) : 0;
                      
                      return (
                        <tr key={budget.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    {budget.userName?.charAt(0) || '?'}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {budget.userName || 'Unknown User'}
                                </div>
                                <div className="text-sm text-gray-500">ID: {budget.userId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{budget.name}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {budget.categories && budget.categories.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">View categories</span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96" align="start">
                                    <div className="space-y-3">
                                    <div>
                                      <h4 className="font-medium text-sm">Budget Categories</h4>
                                      <p className="text-xs text-gray-500 mt-1">
                                        View allocated categories and actual spending patterns
                                      </p>
                                    </div>
                                    
                                    {/* Allocated Categories */}
                                    {budget.categories.some((cat: any) => cat.isAllocated) && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle className="w-4 h-4 text-green-500" />
                                          <span className="text-sm font-medium text-green-700">Allocated Categories</span>
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                          {budget.categories
                                            .filter((cat: any) => cat.isAllocated)
                                            .map((category: any) => (
                                              <div key={`allocated-${category.id}`} className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                                                <div className="flex-1">
                                                  <span className="text-sm font-medium">{category.name}</span>
                                                  <div className="text-xs text-gray-600">
                                                    Spent: {formatCurrency(category.spentAmount)} / Allocated: {formatCurrency(category.allocatedAmount)}
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <Badge variant="outline" className="text-xs bg-green-100">
                                                    {formatCurrency(category.allocatedAmount)}
                                                  </Badge>
                                                  {category.spentAmount > category.allocatedAmount && (
                                                    <div className="text-xs text-red-600 mt-1">Over budget!</div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Unallocated Categories with Expenses */}
                                    {budget.categories.some((cat: any) => !cat.isAllocated) && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                                          <span className="text-sm font-medium text-amber-700">Unallocated Spending</span>
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                          {budget.categories
                                            .filter((cat: any) => !cat.isAllocated)
                                            .map((category: any) => (
                                              <div key={`unallocated-${category.id}`} className="flex justify-between items-center p-2 bg-amber-50 rounded border border-amber-200">
                                                <div className="flex-1">
                                                  <span className="text-sm font-medium">{category.name}</span>
                                                  <div className="text-xs text-gray-600">
                                                    No allocation • Spent: {formatCurrency(category.spentAmount)}
                                                  </div>
                                                </div>
                                                <Badge variant="outline" className="text-xs bg-amber-100">
                                                  {formatCurrency(category.spentAmount)}
                                                </Badge>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Summary */}
                                    <div className="pt-2 border-t space-y-2">
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium">Total Allocated:</span>
                                        <span className="text-green-600">
                                          {formatCurrency(
                                            budget.categories
                                              .filter((cat: any) => cat.isAllocated)
                                              .reduce((sum: number, cat: any) => sum + cat.allocatedAmount, 0)
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium">Total Spent:</span>
                                        <span className="text-blue-600">
                                          {formatCurrency(
                                            budget.categories.reduce((sum: number, cat: any) => sum + cat.spentAmount, 0)
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm font-medium">
                                        <span>Unallocated Spending:</span>
                                        <span className="text-amber-600">
                                          {formatCurrency(
                                            budget.categories
                                              .filter((cat: any) => !cat.isAllocated)
                                              .reduce((sum: number, cat: any) => sum + cat.spentAmount, 0)
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">No categories</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(budget.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary">{budget.period}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={statusColors[budget.status] || statusColors.inactive}>
                              {budget.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex flex-col">
                              <span>{formatCurrency(budget.spent || 0)} / {formatCurrency(budget.amount)}</span>
                              <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                                <div
                                  className={`h-2 rounded-full ${
                                    progressPercent > 100 ? 'bg-red-500' : 
                                    progressPercent > 80 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(budget)}
                              className="mr-2"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Budget</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{budget.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteBudget(budget.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                        No budgets found. Create a new budget to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Budget Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Budget</DialogTitle>
            <DialogDescription>
              Create a new budget for any user in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Budget Name</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Monthly Groceries"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_id">Assign to User</Label>
                <Select value={createForm.user_id} onValueChange={(value) => setCreateForm(prev => ({ ...prev, user_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers?.map((user: User) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select value={createForm.period} onValueChange={(value) => setCreateForm(prev => ({ ...prev, period: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category_id">Category (Optional)</Label>
                <Select value={createForm.category_id} onValueChange={(value) => setCreateForm(prev => ({ ...prev, category_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {allCategories?.map((category: Category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={createForm.end_date}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Budget description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBudget}
              disabled={createBudgetMutation.isPending}
            >
              {createBudgetMutation.isPending ? "Creating..." : "Create Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Budget Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
            <DialogDescription>
              Update budget information and settings.
            </DialogDescription>
          </DialogHeader>
          {selectedBudget && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Budget Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assigned User</Label>
                  <Input
                    value={(selectedBudget as any)?.userName || 'Unknown User'}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-period">Period</Label>
                  <Select value={editForm.period} onValueChange={(value) => setEditForm(prev => ({ ...prev, period: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category_id">Category</Label>
                  <Select value={editForm.category_id} onValueChange={(value) => setEditForm(prev => ({ ...prev, category_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No category</SelectItem>
                      {allCategories?.map((category: Category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start_date">Start Date</Label>
                  <Input
                    id="edit-start_date"
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end_date">End Date</Label>
                  <Input
                    id="edit-end_date"
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateBudget}
              disabled={updateBudgetMutation.isPending}
            >
              {updateBudgetMutation.isPending ? "Updating..." : "Update Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}