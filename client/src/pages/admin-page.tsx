import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PieChart, BarChart, User as UserIcon, RefreshCw, Shield, DollarSign } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UserManagement from "@/components/admin/user-management";
import RoleManagement from "@/components/admin/role-management";
import ExpensesManagement from "@/components/admin/expenses-management";
import BudgetsManagement from "@/components/admin/budgets-management";

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
        <TabsList className="grid grid-cols-4 max-w-lg">
          <TabsTrigger value="users">
            <UserIcon className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="h-4 w-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <DollarSign className="h-4 w-4 mr-2" />
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

        {/* ROLES TAB */}
        <TabsContent value="roles">
          <RoleManagement />
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          <ExpensesManagement />
        </TabsContent>

        {/* BUDGETS TAB */}
        <TabsContent value="budgets">
          <BudgetsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}