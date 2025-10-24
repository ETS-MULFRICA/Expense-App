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
import { Loader2, Save, Filter, Plus, X } from "lucide-react";
import { currencySymbols } from "@/lib/currency-formatter";
import { useEffect, useState } from "react";

interface ExpenseCategoryWithSystem {
  id: number;
  name: string;
  userId: number;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

interface EditExpenseDialogProps {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
  // When true, use admin endpoints (PATCH /api/admin/expenses/:id)
  admin?: boolean;
}

export default function EditExpenseDialog({ 
  expense, 
  isOpen, 
  onClose,
  admin
}: EditExpenseDialogProps) {
  // Defensive guard: if expense is not provided, don't render the dialog
  if (!expense) {
    // eslint-disable-next-line no-console
    console.warn('EditExpenseDialog rendered without an expense prop');
    return null;
  }
  // debug mounting
  try {
    // eslint-disable-next-line no-console
    console.debug('EditExpenseDialog mounting', { id: expense.id, isOpen });
  } catch (e) {}
  const { toast } = useToast();
  const { user } = useAuth();
  const currencySymbol = user?.currency ? currencySymbols[user.currency] : 'FCFA';
  const [showOnlyUsedCategories, setShowOnlyUsedCategories] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  // Fetch expense categories from the database (same as add expense dialog)
  const { 
    data: categories, 
    isLoading: isCategoriesLoading 
  } = useQuery<ExpenseCategoryWithSystem[]>({
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

  // Create new category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: { name: string; description: string }) => {
      const response = await fetch("/api/expense-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(categoryData),
      });
      if (!response.ok) {
        throw new Error("Failed to create category");
      }
      return response.json();
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      form.setValue("categoryId", newCategory.id);
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast({
        title: "Category created",
        description: `Category "${newCategory.name}" has been created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create category",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      const response = await fetch(`/api/expense-categories/${categoryId}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // If it's a "cannot hide" error, throw with the specific error info
        if (data.cannotHide) {
          const error = new Error(data.message);
          (error as any).cannotHide = true;
          throw error;
        }
        throw new Error(data.message || "Failed to delete category");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      form.setValue("categoryId", 0);
      
      const isHidden = data.type === 'hidden';
      toast({
        title: isHidden ? "Category hidden" : "Category deleted",
        description: isHidden 
          ? "The system category has been hidden from your view. You can restore it anytime from settings."
          : "The category has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      if (error.cannotHide) {
        // Special handling for categories that cannot be hidden due to usage
        toast({
          title: "Cannot hide category",
          description: error.message,
          variant: "destructive",
          duration: 6000, // Show longer for important info
        });
      } else {
        toast({
          title: "Failed to delete category",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    
    createCategoryMutation.mutate({
      name: newCategoryName,
      description: `${newCategoryName} expenses`
    });
  };

  const handleDeleteCategory = (categoryId: number) => {
    const category = categories?.find(c => c.id === categoryId);
    const isSystemCategory = category?.isSystem;
    
    let confirmMessage;
    if (isSystemCategory) {
      confirmMessage = `Are you sure you want to hide "${category?.name}" category?\n\nNote: Categories that are currently used in expenses or budgets cannot be hidden. You can restore hidden categories anytime from settings.`;
    } else {
      confirmMessage = `Are you sure you want to delete "${category?.name}" category?`;
    }
      
    if (window.confirm(confirmMessage)) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const form = useForm<InsertExpense>({
    resolver: zodResolver(clientExpenseSchema),
    defaultValues: {
      description: expense.description,
      amount: expense.amount ?? 0,
      date: expense.date ? new Date(expense.date) : new Date(),
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
      const path = admin ? `/api/admin/expenses/${expense.id}` : `/api/expenses/${expense.id}`;
      const method = "PATCH";
      // Debug log the outgoing request
      // eslint-disable-next-line no-console
      console.debug("Updating expense", { path, method, formattedData });
      const res = await apiRequest(method, path, formattedData);
      // Return parsed JSON body
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate expense lists so UI updates; don't await expensive refetches to keep dialog responsive
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });

      // Invalidate budget-related queries (non-blocking)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 typeof queryKey[0] === "string" && 
                 queryKey[0].startsWith("/api/budgets");
        }
      });

      // Trigger background refetch for budgets (non-blocking)
      queryClient.refetchQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 typeof queryKey[0] === "string" && 
                 queryKey[0].startsWith("/api/budgets");
        }
      });

      toast({ title: "Expense updated", description: "The expense has been updated successfully." });
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

  try {
    if (admin) {
      // Render a simple fallback modal for admin flows (bypass Radix Dialog)
      if (!isOpen) return null;
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative bg-background border p-6 rounded shadow-lg sm:max-w-lg w-full z-[10000]">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Edit Expense</h3>
                <p className="text-sm text-muted-foreground">Update the details of your expense.</p>
              </div>

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
              render={({ field }) => {
                const selectedCategory = categories?.find(c => c.id === field.value);
                return (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    {!showNewCategoryInput ? (
                      <div className="flex gap-2 items-center">
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value && field.value > 0 ? field.value.toString() : ""}
                          defaultValue={(expense.categoryId || (expense as any).category_id)?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
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
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowNewCategoryInput(true)}
                          className="px-3"
                          title="Add new category"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {field.value && selectedCategory && (
                          <Button 
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(field.value)}
                            className="px-3 text-red-600 hover:text-red-700"
                            title={selectedCategory.isSystem ? "Hide this system category from your view" : "Delete this custom category"}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            {deleteCategoryMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="New category name"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategory();
                            }
                          }}
                          autoFocus
                        />
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddCategory}
                          disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                          className="px-3"
                        >
                          {createCategoryMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowNewCategoryInput(false);
                            setNewCategoryName("");
                          }}
                          className="px-3"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
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
            </div>
          </div>
        </div>
      );
    }

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
              render={({ field }) => {
                const selectedCategory = categories?.find(c => c.id === field.value);
                return (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    {!showNewCategoryInput ? (
                      <div className="flex gap-2 items-center">
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value && field.value > 0 ? field.value.toString() : ""}
                          defaultValue={(expense.categoryId || (expense as any).category_id)?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
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
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowNewCategoryInput(true)}
                          className="px-3"
                          title="Add new category"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {field.value && selectedCategory && (
                          <Button 
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(field.value)}
                            className="px-3 text-red-600 hover:text-red-700"
                            title={selectedCategory.isSystem ? "Hide this system category from your view" : "Delete this custom category"}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            {deleteCategoryMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="New category name"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategory();
                            }
                          }}
                          autoFocus
                        />
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddCategory}
                          disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                          className="px-3"
                        >
                          {createCategoryMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowNewCategoryInput(false);
                            setNewCategoryName("");
                          }}
                          className="px-3"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
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
  } catch (err) {
    // Log render errors and return null to avoid crashing the whole app
    // eslint-disable-next-line no-console
    console.error('EditExpenseDialog render error', err);
    return null;
  }
}
