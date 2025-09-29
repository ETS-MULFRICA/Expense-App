import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Budget, BudgetAllocation, ExpenseCategory } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency-formatter";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { exportBudgetsToCSV, exportBudgetsToPDF } from "@/lib/export-utils";
import { AddBudgetDialog } from "@/components/budget/add-budget-dialog";
import EditBudgetDialog from "@/components/budget/edit-budget-dialog";
import { DeleteBudgetDialog } from "@/components/budget/delete-budget-dialog";

export default function BudgetPage() {
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isDeleteBudgetOpen, setIsDeleteBudgetOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const { user, isLoading: isUserLoading } = useAuth();

  const { data: budgets, isLoading: isLoadingBudgets, refetch: refetchBudgets } = useQuery<Budget[]>({
    queryKey: ["/api/budgets", user?.currency],
    enabled: !!user && !isUserLoading,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  // Force refetch when user currency changes
  useEffect(() => {
    console.log('[DEBUG Frontend] Currency useEffect triggered:', {
      userCurrency: user?.currency,
      isUserLoading,
      hasBudgets: !!budgets,
      budgetCount: budgets?.length,
      isAuthenticated: !!user
    });
    if (user?.currency && !isUserLoading) {
      console.log('[DEBUG Frontend] Force refetching budgets due to currency change:', user.currency);
      // Force an immediate refetch
      refetchBudgets();
    }
  }, [user?.currency, isUserLoading, refetchBudgets]);

  // Also add a useEffect to force refetch when component mounts
  useEffect(() => {
    if (user && !isUserLoading) {
      console.log('[DEBUG Frontend] Component mounted, refetching budgets for currency:', user.currency);
      refetchBudgets();
    }
  }, []);

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
    enabled: !!user
  });

  // Handlers for CRUD actions
  const handleAddBudget = (budget: { name: string; amount: number }) => {
    // TODO: Implement API call to add budget
    setIsAddBudgetOpen(false);
  };

  const handleDeleteBudget = () => {
    // TODO: Implement API call to delete budget
    setIsDeleteBudgetOpen(false);
    setSelectedBudget(null);
  };

  return (
    <MainLayout>
      <h1>Budgets</h1>
      {isUserLoading && <div>Loading user data...</div>}
      {!user && !isUserLoading && <div className="text-red-500">Authentication required. Please refresh the page or log in again.</div>}
      <Button onClick={() => setIsAddBudgetOpen(true)}>Add Budget</Button>
      <table className="min-w-full mt-6 border">
        <thead>
          <tr>
            <th className="px-4 py-2 border">Name</th>
            <th className="px-4 py-2 border">Amount</th>
            <th className="px-4 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {budgets?.map((budget) => {
            console.log('[DEBUG Frontend] Rendering budget:', {
              budgetId: budget.id,
              budgetName: budget.name,
              amount: budget.amount,
              userCurrency: user?.currency,
              formattedAmount: formatCurrency(budget.amount, user?.currency || 'XAF')
            });
            return (
              <tr key={budget.id}>
                <td className="px-4 py-2 border">{budget.name}</td>
                <td className="px-4 py-2 border">{formatCurrency(budget.amount, user?.currency || 'XAF')}</td>
                <td className="px-4 py-2 border">
                  <Button size="sm" variant="outline" onClick={() => { setSelectedBudget(budget); setIsEditBudgetOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="destructive" className="ml-2" onClick={() => { setSelectedBudget(budget); setIsDeleteBudgetOpen(true); }}>Delete</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Dialogs for CRUD operations */}
      <AddBudgetDialog
        isOpen={isAddBudgetOpen}
        onClose={() => setIsAddBudgetOpen(false)}
        onAdd={handleAddBudget}
      />
      <EditBudgetDialog
        isOpen={isEditBudgetOpen && selectedBudget !== null}
        onClose={() => { setIsEditBudgetOpen(false); setSelectedBudget(null); }}
        budget={selectedBudget!}
      />
      <DeleteBudgetDialog
        isOpen={isDeleteBudgetOpen}
        onClose={() => { setIsDeleteBudgetOpen(false); setSelectedBudget(null); }}
        onDelete={handleDeleteBudget}
      />
    </MainLayout>
  );
}
