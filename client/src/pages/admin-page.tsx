import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency-formatter";
import { Loader2, PieChart, BarChart, User as UserIcon, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "@/components/admin/user-management";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("users");

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
  const { data: expenses, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["/api/admin/expenses"],
    queryFn: async () => {
      const response = await fetch("/api/admin/expenses");
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      return response.json();
    },
    enabled: user?.role === "admin" && selectedTab === "expenses",
  });

  // Fetch all budgets (for admin view)
  const { data: budgets, isLoading: isLoadingBudgets } = useQuery({
    queryKey: ["/api/admin/budgets"],
    queryFn: async () => {
      const response = await fetch("/api/admin/budgets");
      if (!response.ok) {
        throw new Error("Failed to fetch budgets");
      }
      return response.json();
    },
    enabled: user?.role === "admin" && selectedTab === "budgets",
  });

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              // Force invalidate all admin queries
              await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/admin/users/search"] });
              
              // Force refetch
              await queryClient.refetchQueries({ queryKey: ["/api/admin/expenses"] });
              await queryClient.refetchQueries({ queryKey: ["/api/admin/budgets"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="users">
            <UserIcon className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <BarChart className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="budgets">
            <PieChart className="h-4 w-4 mr-2" />
            Budgets
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>All Expenses</CardTitle>
              <CardDescription>
                View all expenses across all users in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingExpenses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
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
                      expenses.map((expense: any) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.userName || "Unknown"}</TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>{expense.categoryName || "Uncategorized"}</TableCell>
                          <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
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
              )}
            </CardContent>
            {expenses && expenses.length > 0 && (
              <CardFooter className="border-t px-6 py-4">
                <div className="w-full flex justify-between">
                  <span className="font-medium">Total Expenses:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
                    )}
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* BUDGETS TAB */}
        <TabsContent value="budgets">
          <Card>
            <CardHeader>
              <CardTitle>All Budgets</CardTitle>
              <CardDescription>
                View all budgets across all users in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBudgets ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
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
                        <TableRow key={budget.id}>
                          <TableCell className="font-medium">{budget.userName || "Unknown"}</TableCell>
                          <TableCell>{budget.name}</TableCell>
                          <TableCell>
                            {budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(budget.amount)}</TableCell>
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
              )}
            </CardContent>
            {budgets && budgets.length > 0 && (
              <CardFooter className="border-t px-6 py-4">
                <div className="w-full flex justify-between">
                  <span className="font-medium">Total Budget Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      budgets.reduce((sum: number, budget: any) => sum + budget.amount, 0)
                    )}
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}