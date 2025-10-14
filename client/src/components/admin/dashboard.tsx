import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download, FileDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { addDays, subDays } from 'date-fns';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  dailyActiveUsers: number;
  totalTransactions: number;
  recentActivity: Array<{
    id: number;
    userId: number;
    username: string;
    action: string;
    resource: string;
    timestamp: string;
  }>;
  topCategories: Array<{
    name: string;
    count: number;
    total: number;
  }>;
  dailyStats: Array<{
    date: string;
    transactions: number;
    activeUsers: number;
    newUsers: number;
  }>;
}

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin-dashboard', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/dashboard?timeRange=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    }
  });

  // Export data handlers
  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/admin/export/csv');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `expense-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch('/api/admin/export/pdf');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `expense-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Helper: build zero-filled daily array for the selected timeRange so charts render even with no data
  const makeEmptySeries = (range: '7d' | '30d' | '90d') => {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const arr: Array<{ date: string; transactions: number; newUsers: number; activeUsers: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      arr.push({ date: format(d, 'yyyy-MM-dd'), transactions: 0, newUsers: 0, activeUsers: 0 });
    }
    return arr;
  };

  const chartData = (stats?.dailyStats && stats.dailyStats.length > 0) ? stats.dailyStats : makeEmptySeries(timeRange);

  return (
    <div className="space-y-6">
      {/* Header with Export Buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Control Center</h2>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '90d') => setTimeRange(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExportCSV} variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.dailyActiveUsers}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats?.dailyActiveUsers || 0) / (stats?.totalUsers || 1) * 100)}% of total users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTransactions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              of {stats?.totalUsers} total users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.adminUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>Daily active users and new registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="activeUsers"
                    name="Active Users"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="newUsers"
                    name="New Users"
                    stroke="#16a34a"
                    strokeWidth={2}
                  />
                </LineChart>
        </ResponsiveContainer>
      </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Activity</CardTitle>
            <CardDescription>Daily transaction volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="transactions"
                    name="Transactions"
                    stroke="#dc2626"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Top Categories */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest user actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{activity.username}</TableCell>
                      <TableCell>{activity.action}</TableCell>
                      <TableCell>{activity.resource}</TableCell>
                      <TableCell>
                        {format(new Date(activity.timestamp), 'MMM dd, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">No recent activity found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
            <CardDescription>Most used expense categories</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.topCategories && stats.topCategories.length > 0 ? (
                  stats.topCategories.map((category) => (
                    <TableRow key={category.name}>
                      <TableCell>{category.name}</TableCell>
                      <TableCell>{category.count} transactions</TableCell>
                      <TableCell>${category.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">No top categories found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}