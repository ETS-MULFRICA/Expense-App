import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText,
  User,
  Activity,
  ShoppingCart,
  PiggyBank,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HistoryFilters {
  search: string;
  userId: string;
  category: string;
  activityType: string;
  startDate: string;
  endDate: string;
  dateFilter: string; // 'all', 'today', 'week', 'month', 'year', 'custom'
  minAmount: string;
  maxAmount: string;
  page: number;
  limit: number;
}

interface HistoryItem {
  id: number;
  type: 'expense' | 'income' | 'budget' | 'activity';
  user_id: number;
  username: string;
  email: string;
  amount?: number;
  description: string;
  merchant?: string;
  category: string;
  created_at: string;
  resource_type?: string;
  action_type?: string;
}

interface HistoryResponse {
  data: HistoryItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

interface FilterOptions {
  users: { id: number; username: string; email: string }[];
  categories: string[];
  activityTypes: string[];
}

interface HistoryStats {
  totalRecords: number;
  totalExpenses: number;
  totalIncomes: number;
  totalBudgets: number;
  totalActivities: number;
  totalAmount: number;
  dateRange: { start: string; end: string };
}

export default function AdminHistory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<HistoryFilters>({
    search: '',
    userId: '',
    category: '',
    activityType: '',
    startDate: '',
    endDate: '',
    dateFilter: 'all',
    minAmount: '',
    maxAmount: '',
    page: 1,
    limit: 50
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Build query parameters
  const buildQueryParams = (filterData: HistoryFilters) => {
    const params = new URLSearchParams();
    Object.entries(filterData).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) {
        params.append(key, value.toString());
      }
    });
    return params.toString();
  };

  // Fetch history data
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<HistoryResponse>({
    queryKey: ["/api/admin/history", filters],
    queryFn: async () => {
      const queryParams = buildQueryParams(filters);
      const response = await fetch(`/api/admin/history?${queryParams}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch admin history");
      }
      return response.json();
    },
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["/api/admin/history/filters"],
    queryFn: async () => {
      const response = await fetch("/api/admin/history/filters", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch filter options");
      }
      return response.json();
    },
  });

  // Fetch history stats
  const { data: historyStats } = useQuery<HistoryStats>({
    queryKey: ["/api/admin/history/stats", filters],
    queryFn: async () => {
      const queryParams = buildQueryParams({ ...filters, page: 1, limit: 1 });
      const response = await fetch(`/api/admin/history/stats?${queryParams}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch history stats");
      }
      return response.json();
    },
  });

  // Handle filter changes
  const updateFilter = (key: keyof HistoryFilters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : (typeof value === 'number' ? value : parseInt(value.toString()) || 1) // Reset to page 1 when filters change
    }));
  };

  // Handle search
  const handleSearch = (searchTerm: string) => {
    updateFilter('search', searchTerm);
  };

  // Handle date filter changes
  const handleDateFilter = (dateFilter: string) => {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    switch (dateFilter) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = weekStart.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = monthStart.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        startDate = yearStart.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'custom':
        // Keep existing dates
        break;
      default: // 'all'
        startDate = '';
        endDate = '';
    }

    setFilters(prev => ({
      ...prev,
      dateFilter,
      startDate,
      endDate,
      page: 1
    }));
  };

  // Handle export
  const handleExport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const queryParams = buildQueryParams({ ...filters, page: 1, limit: 10000 });
      const response = await fetch(`/api/admin/history/export?${queryParams}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export history");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "History data exported successfully as CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export history data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      userId: '',
      category: '',
      activityType: '',
      startDate: '',
      endDate: '',
      dateFilter: 'all',
      minAmount: '',
      maxAmount: '',
      page: 1,
      limit: 50
    });
  };

  // Get type icon and color
  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'expense':
        return { icon: ShoppingCart, color: 'text-red-600 bg-red-50', label: 'Expense' };
      case 'income':
        return { icon: DollarSign, color: 'text-green-600 bg-green-50', label: 'Income' };
      case 'budget':
        return { icon: PiggyBank, color: 'text-blue-600 bg-blue-50', label: 'Budget' };
      case 'activity':
        return { icon: Activity, color: 'text-purple-600 bg-purple-50', label: 'Activity' };
      default:
        return { icon: AlertCircle, color: 'text-gray-600 bg-gray-50', label: 'Unknown' };
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format date for display (short format)
  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Admin History</h2>
          <p className="text-gray-600">Comprehensive audit trail and activity monitoring</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {historyStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{historyStats.totalRecords.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{historyStats.totalExpenses.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incomes</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{historyStats.totalIncomes.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budgets</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{historyStats.totalBudgets.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{historyStats.totalActivities.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Search & Filter</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search across all fields (users, descriptions, merchants, etc.)"
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={filters.dateFilter} onValueChange={handleDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.activityType || 'all'} onValueChange={(value) => updateFilter('activityType', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Incomes</SelectItem>
                <SelectItem value="budget">Budgets</SelectItem>
                <SelectItem value="activity">Activities</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.userId || 'all'} onValueChange={(value) => updateFilter('userId', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {filterOptions?.users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.category || 'all'} onValueChange={(value) => updateFilter('category', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filterOptions?.categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={clearFilters}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>

          {/* Date Range Display */}
          {filters.dateFilter !== 'all' && filters.startDate && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
              <Calendar className="h-4 w-4" />
              <span>
                Date Range: {formatDateShort(filters.startDate)} 
                {filters.endDate !== filters.startDate && filters.endDate && ` to ${formatDateShort(filters.endDate)}`}
              </span>
            </div>
          )}

          {/* Custom Date Range - Show when custom is selected */}
          {filters.dateFilter === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium">Min Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.minAmount}
                  onChange={(e) => updateFilter('minAmount', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.maxAmount}
                  onChange={(e) => updateFilter('maxAmount', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>History Records</CardTitle>
              <CardDescription>
                {historyData ? `Showing ${historyData.data.length} of ${historyData.totalCount.toLocaleString()} records` : 'Loading...'}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Select value={filters.limit.toString()} onValueChange={(value) => updateFilter('limit', parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">per page</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading history...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.data.map((item) => {
                      const typeInfo = getTypeInfo(item.type);
                      const Icon = typeInfo.icon;
                      
                      return (
                        <TableRow key={`${item.type}-${item.id}`}>
                          <TableCell>
                            <Badge className={typeInfo.color}>
                              <Icon className="h-3 w-3 mr-1" />
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.username}</div>
                              <div className="text-sm text-gray-500">{item.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.description}</div>
                              {item.merchant && (
                                <div className="text-sm text-gray-500">at {item.merchant}</div>
                              )}
                              {item.action_type && (
                                <div className="text-sm text-gray-500">{item.action_type}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.amount ? (
                              <span className={item.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(item.amount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(item.created_at)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {historyData && historyData.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Page {historyData.currentPage} of {historyData.totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFilter('page', Math.max(1, filters.page - 1))}
                      disabled={filters.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFilter('page', Math.min(historyData.totalPages, filters.page + 1))}
                      disabled={filters.page >= historyData.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}