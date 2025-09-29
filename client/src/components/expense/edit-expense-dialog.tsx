import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { insertExpenseSchema, clientExpenseSchema, InsertExpense, Expense, ExpenseCategory, Budget } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Loader2, Save, Filter } from "lucide-react";
import { currencySymbols } from "@/lib/currency-formatter";
import { useEffect, useState } from "react";

interface EditExpenseDialogProps {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditExpenseDialog({ 
  expense, 
  isOpen, 
  onClose 
}: EditExpenseDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const currencySymbol = user?.currency ? currencySymbols[user.currency] : 'FCFA';
  const [showOnlyUsedCategories, setShowOnlyUsedCategories] = useState(false);
  
  // Fetch expense categories from the database (same as add expense dialog)
  const { 
    data: categories, 
    isLoading: isCategoriesLoading 
  } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/expense-categories"],
    queryFn: async () => {
      const response = await fetch("/api/expense-categories");
      if (!response.ok) {
        throw new Error("Failed to fetch expense categories");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch used categories from user's expenses
  const { 
    data: usedCategories, 
    isLoading: isUsedCategoriesLoading 
  } = useQuery<number[]>({
    queryKey: ["/api/expenses/used-categories"],
    queryFn: async () => {
      const response = await fetch("/api/expenses");
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      const expenses = await response.json();
      // Extract unique category IDs from expenses
      const usedCategoryIds = Array.from(new Set(expenses.map((expense: any) => 
        expense.categoryId || expense.category_id
      ).filter(Boolean))) as number[];
      return usedCategoryIds;
    },
    enabled: isOpen && showOnlyUsedCategories,
  });

  // Fetch budgets from the database
  const { 
    data: budgets, 
    isLoading: isBudgetsLoading 
  } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) {
        throw new Error("Failed to fetch budgets");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Filter categories based on toggle
  const filteredCategories = showOnlyUsedCategories 
    ? categories?.filter(category => usedCategories?.includes(category.id))
    : categories;

  const form = useForm<InsertExpense>({
    resolver: zodResolver(clientExpenseSchema),
    defaultValues: {
      description: expense.description,
      amount: expense.amount,
      date: new Date(expense.date),
      // Handle both camelCase and snake_case from API
      categoryId: expense.categoryId || (expense as any).category_id || 0,
      subcategoryId: expense.subcategoryId || (expense as any).subcategory_id || null,
      budgetId: expense.budgetId || (expense as any).budget_id || null,
      merchant: expense.merchant || "",
      notes: expense.notes || ""
    }
  });

  // Reset form when categories are loaded and ensure the current category is selected
  useEffect(() => {
    // Handle both camelCase and snake_case from API
    const expenseCategoryId = expense.categoryId || (expense as any).category_id;
    if (categories && categories.length > 0 && expenseCategoryId) {
      console.log("Setting categoryId:", expenseCategoryId, "Available categories:", categories);
      form.setValue('categoryId', expenseCategoryId);
    }
  }, [categories, expense.categoryId, (expense as any).category_id, form]);
  
  const updateExpenseMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      // Ensure date is properly formatted for API
      const formattedData = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date
      };
      
      const res = await apiRequest("PATCH", `/api/expenses/${expense.id}`, formattedData);
      return await res.json();
    },
    onSuccess: async () => {
      // First invalidate expense queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      
      // Invalidate ALL budget-related queries since we don't know which budgets were affected
      // This ensures both the old budget and new budget performance get updated
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 typeof queryKey[0] === "string" && 
                 queryKey[0].startsWith("/api/budgets");
        }
      });
      
      // Force immediate refetch of all budget data
      await queryClient.refetchQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 typeof queryKey[0] === "string" && 
                 queryKey[0].startsWith("/api/budgets");
        }
      });
      
      toast({
        title: "Expense updated",
        description: "The expense has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update expense",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: InsertExpense) => {
    updateExpenseMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Update the details of your expense.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What did you spend on?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter the amount"
                        {...field}
                        value={field.value > 0 ? field.value.toString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const numValue = value === '' ? 0 : parseFloat(value);
                          field.onChange(numValue || 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          field.onChange(date);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Category Filter Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="category-filter-edit" className="text-sm font-medium">
                Show only used categories
              </Label>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Switch
                  id="category-filter-edit"
                  checked={showOnlyUsedCategories}
                  onCheckedChange={setShowOnlyUsedCategories}
                />
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value && field.value > 0 ? field.value.toString() : ""}
                    defaultValue={(expense.categoryId || (expense as any).category_id)?.toString() || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(isCategoriesLoading || (showOnlyUsedCategories && isUsedCategoriesLoading)) ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2 text-sm">Loading categories...</span>
                        </div>
                      ) : filteredCategories && filteredCategories.length > 0 ? (
                        filteredCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : showOnlyUsedCategories ? (
                        <div className="py-2 text-center text-sm text-gray-500">
                          No categories used yet. Toggle off to see all categories.
                        </div>
                      ) : (
                        <div className="py-2 text-center text-sm text-gray-500">
                          No categories available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="budgetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                    value={field.value ? field.value.toString() : "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a budget (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No specific budget</SelectItem>
                      {isBudgetsLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2 text-sm">Loading budgets...</span>
                        </div>
                      ) : budgets && budgets.length > 0 ? (
                        budgets.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id.toString()}>
                            {budget.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="py-2 text-center text-sm text-gray-500">
                          No budgets available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="merchant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant/Payee</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Where did you spend?" 
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details (optional)"
                      className="resize-none"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit"
                className="btn-gradient"
                disabled={updateExpenseMutation.isPending}
              >
                {updateExpenseMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Update Expense
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
