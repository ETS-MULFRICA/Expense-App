import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Activity, 
  DollarSign, 
  TrendingUp, 
  Download, 
  Calendar,
  PieChart,
  BarChart3,
  FileText,
  RefreshCw
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { useToast } from "@/hooks/use-toast";

interface AnalyticsOverview {
  totalUsers: number;
  dailyActiveUsers: number;
  totalTransactions: number;
  totalExpenseAmount: number;
  totalIncomeAmount: number;
  topCategories: { name: string; count: number; totalAmount: number }[];
  recentSignups: number;
  avgTransactionValue: number;
}

interface DailyActiveUser {
  date: string;
  activeUsers: number;
}

interface ExpenseTrend {
  date: string;
  totalAmount: number;
  transactionCount: number;
}

interface TopCategory {
  categoryName: string;
  transactionCount: number;
  totalAmount: number;
  avgAmount: number;
  percentage: number;
}

interface RecentActivity {
  id: number;
  actionType: string;
  resourceType: string;
  description: string;
  userName: string;
  createdAt: string;
  metadata?: any;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

export default function AnalyticsDashboard() {
  const { toast } = useToast();
  const [selectedTimeRange, setSelectedTimeRange] = useState(30);

  // Fetch overview data
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/admin/analytics/overview"],
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/overview", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch analytics overview");
      }
      return response.json();
    },
  });

  // Fetch daily active users
  const { data: dailyActiveUsers, isLoading: dauLoading } = useQuery<DailyActiveUser[]>({
    queryKey: ["/api/admin/analytics/daily-active-users", selectedTimeRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics/daily-active-users?days=${selectedTimeRange}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch daily active users");
      }
      return response.json();
    },
  });

  // Fetch expense trends
  const { data: expenseTrends, isLoading: trendsLoading } = useQuery<ExpenseTrend[]>({
    queryKey: ["/api/admin/analytics/expense-trends", selectedTimeRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics/expense-trends?days=${selectedTimeRange}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch expense trends");
      }
      return response.json();
    },
  });

  // Fetch top categories
  const { data: topCategories, isLoading: categoriesLoading } = useQuery<TopCategory[]>({
    queryKey: ["/api/admin/analytics/top-categories"],
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/top-categories?limit=10", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch top categories");
      }
      return response.json();
    },
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/admin/analytics/recent-activity"],
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/recent-activity?limit=20", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch recent activity");
      }
      return response.json();
    },
  });

  const handleExport = async (type: 'csv' | 'json', reportType: string) => {
    try {
      if (type === 'csv') {
        const response = await fetch(`/api/admin/reports/export/csv?type=${reportType}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to export CSV");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const response = await fetch(`/api/admin/reports/export/json?type=${reportType}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to export JSON");
        }
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      toast({
        title: "Export Successful",
        description: `${reportType} data exported successfully as ${type.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-gray-600">Comprehensive insights into your expense tracking platform</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetchOverview()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json', 'overview')}>
            <Download className="h-4 w-4 mr-2" />
            Export Overview
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{overview?.recentSignups || 0} new this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.dailyActiveUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(overview?.avgTransactionValue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview?.totalExpenseAmount || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Income: {formatCurrency(overview?.totalIncomeAmount || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <Tabs defaultValue="trends" className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList className="grid grid-cols-4 max-w-lg">
            <TabsTrigger value="trends">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="categories">
              <PieChart className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="exports">
              <FileText className="h-4 w-4 mr-2" />
              Exports
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <select 
              value={selectedTimeRange} 
              onChange={(e) => setSelectedTimeRange(Number(e.target.value))}
              className="px-3 py-1 border rounded"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Active Users</CardTitle>
                <CardDescription>User engagement over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyActiveUsers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => formatDate(value as string)} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="activeUsers" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Active Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Trends</CardTitle>
                <CardDescription>Daily spending patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expenseTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => formatDate(value as string)}
                      formatter={(value, name) => [
                        name === 'totalAmount' ? formatCurrency(value as number) : value,
                        name === 'totalAmount' ? 'Total Amount' : 'Transactions'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="totalAmount" fill="#8884d8" name="Total Amount" />
                    <Bar dataKey="transactionCount" fill="#82ca9d" name="Transactions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Expense Categories</CardTitle>
                <CardDescription>Most popular spending categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={topCategories?.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }: any) => `${name}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalAmount"
                    >
                      {topCategories?.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [formatCurrency(value as number), 'Total Amount']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Statistics</CardTitle>
                <CardDescription>Detailed breakdown by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {topCategories?.map((category, index) => (
                    <div key={category.categoryName} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{category.categoryName}</p>
                          <p className="text-sm text-gray-500">{category.transactionCount} transactions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(category.totalAmount)}</p>
                        <p className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest user actions and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 rounded border">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <div>
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm text-gray-500">
                          {activity.userName} • {activity.actionType} • {activity.resourceType}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDate(activity.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exports Tab */}
        <TabsContent value="exports">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Users Report</CardTitle>
                <CardDescription>Export user data and statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleExport('csv', 'users')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Users CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses Report</CardTitle>
                <CardDescription>Export expense transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleExport('csv', 'expenses')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Expenses CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budgets Report</CardTitle>
                <CardDescription>Export budget information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleExport('csv', 'budgets')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Budgets CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>Comprehensive Reports</CardTitle>
                <CardDescription>Detailed analytics exports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline"
                    onClick={() => handleExport('json', 'detailed')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Detailed Analytics (JSON)
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleExport('json', 'overview')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Overview (JSON)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}