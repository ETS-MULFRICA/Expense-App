import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { insertExpenseSchema, clientExpenseSchema, InsertExpense, ExpenseCategory, Budget } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Loader2, Plus, Filter, X } from "lucide-react";
import { currencySymbols } from "@/lib/currency-formatter";

interface ExpenseCategoryWithSystem {
  id: number;
  name: string;
  userId: number;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddExpenseDialog({ isOpen, onClose }: AddExpenseDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const currencySymbol = user?.currency ? currencySymbols[user.currency] : 'FCFA';
  const [showOnlyUsedCategories, setShowOnlyUsedCategories] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  // Fetch expense categories from the database
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

  // Fetch user's budgets for budget selection
  const { 
    data: budgets, 
    isLoading: isBudgetsLoading 
  } = useQuery<{ id: number; name: string; period: string }[]>({
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
      if (!response.ok) {
        throw new Error("Failed to delete category");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      form.setValue("categoryId", 0);
      toast({
        title: "Category deleted",
        description: "The category has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete category",
        description: error.message,
        variant: "destructive",
      });
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
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const form = useForm<InsertExpense>({
    resolver: zodResolver(clientExpenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: new Date(),
      categoryId: 0,
      subcategoryId: null,
      budgetId: null,
      merchant: "",
      notes: ""
    }
  });
  
  const addExpenseMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      // Ensure date is properly formatted for API
      const formattedData = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date
      };
      
      const res = await apiRequest("POST", "/api/expenses", formattedData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      // Invalidate ALL budget-related queries since expense may be assigned to a budget
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 typeof queryKey[0] === "string" && 
                 queryKey[0].startsWith("/api/budgets");
        }
      });
      toast({
        title: "Expense added",
        description: "Your expense has been added successfully.",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add expense",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: InsertExpense) => {
    addExpenseMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>
            Enter the details of your expense below.
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
                render={({ field }) => {
                  const [hasTyped, setHasTyped] = useState(false);
                  const showPlaceholder = !hasTyped && (!field.value || field.value === 0);
                  return (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter the amount"
                          type="text"
                          inputMode="decimal"
                          value={field.value === 0 ? '' : field.value.toString()}
                          onChange={(e) => {
                            setHasTyped(e.target.value !== '');
                            // Only allow numbers and decimal points
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const numValue = value === '' ? 0 : Math.abs(parseFloat(value));
                            field.onChange(numValue || 0);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
              <Label htmlFor="category-filter" className="text-sm font-medium">
                Show only used categories
              </Label>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Switch
                  id="category-filter"
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
                          value={field.value ? field.value.toString() : undefined}
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
                        {field.value && selectedCategory && !selectedCategory.isSystem && (
                          <Button 
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(field.value)}
                            className="px-3 text-red-600 hover:text-red-700"
                            title="Delete this custom category"
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
                disabled={addExpenseMutation.isPending}
              >
                {addExpenseMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
