import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Expense, ExpenseCategory } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";
import ExpenseChart from "@/components/dashboard/expense-chart";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { format, subMonths } from 'date-fns';
import { formatCurrency } from "@/lib/currency-formatter";

export default function ReportsPage() {
  const { user } = useAuth();

  // Log activity for viewing reports page
  useEffect(() => {
    const logPageView = async () => {
      try {
        await fetch('/api/activity-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actionType: 'VIEW',
            resourceType: 'REPORT',
            description: 'Viewed reports page',
            metadata: {
              pageType: 'reports-overview',
              timestamp: new Date().toISOString()
            }
          }),
        });
      } catch (error) {
        console.error('Failed to log reports page view:', error);
      }
    };

    if (user) {
      logPageView();
    }
  }, [user]);

  const { data: expenses, isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Fetch categories to map IDs to names
  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
    enabled: !!user,
  });

  // Debug logging to see what we're getting
  console.log('Debug - Expenses from API:', expenses);
  console.log('Debug - Categories from API:', categories);

  // Get expenses from the last 6 months
  const today = new Date();
  const sixMonthsAgo = subMonths(today, 6);
  
  const recentExpenses = expenses?.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= sixMonthsAgo;
  }) || [];

  // Helper function to get category name
  const getCategoryName = (categoryId: number): string => {
    const category = categories?.find(c => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  // Calculate totals by category name (not ID)
  const categoryTotals = recentExpenses.reduce((acc, expense) => {
    const categoryName = getCategoryName(expense.categoryId);
    acc[categoryName] = (acc[categoryName] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  // Format data for pie chart
  const pieChartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate monthly totals with proper category names
  const monthlyData: Record<string, number> = {};
  
  recentExpenses.forEach(expense => {
    const date = new Date(expense.date);
    const monthYear = format(date, 'MMM yyyy');
    
    monthlyData[monthYear] = (monthlyData[monthYear] || 0) + expense.amount;
  });

  // Sort monthly data by date
  const sortedMonthlyData = Object.entries(monthlyData)
    .sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    })
    .map(([month, total]) => ({
      month,
      total,
    }));

  // Generate random vibrant colors for the pie chart
  const generateRandomColor = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#FF7F50', '#87CEEB', '#DEB887', '#F0E68C',
      '#FF69B4', '#00CED1', '#FFB347', '#98FB98', '#F4A460',
      '#DA70D6', '#40E0D0', '#EE82EE', '#90EE90', '#FFA07A'
    ];
    return colors;
  };

  const COLORS = generateRandomColor();

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <MobileNav />
        <main className="flex-1 relative overflow-y-auto focus:outline-none pt-16 lg:pt-0">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <h1 className="text-2xl font-semibold text-gray-900 mb-6">Reports</h1>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Expenses by Category</CardTitle>
                    <CardDescription>
                      Distribution of your expenses across different categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value, user?.currency || 'XAF'), 'Amount']}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Spending</CardTitle>
                    <CardDescription>
                      Total expenses for each month
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sortedMonthlyData.map(({ month, total }) => (
                        <div key={month} className="flex items-center justify-between">
                          <div className="font-medium">{month}</div>
                          <div className="flex items-center">
                            <div 
                              className="h-2 bg-primary rounded"
                              style={{ 
                                width: `${Math.min(Math.max(total / 10, 50), 400)}px`
                              }}
                            />
                            <span className="ml-4 text-gray-700">{formatCurrency(total, user?.currency || 'XAF')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <ExpenseChart expenses={recentExpenses} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
