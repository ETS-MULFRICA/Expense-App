import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Budget, BudgetAllocation, BudgetPerformance } from "@/lib/models";
import { insertBudgetAllocationSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency-formatter";
import { format } from "date-fns";
import { 
  Loader2, 
  Plus, 
  Trash2,
  PieChart,
  BarChart,
  Edit2,
  Check,
  X
} from "lucide-react";

interface ExpenseCategoryWithSystem {
  id: number;
  name: string;
  userId: number;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BudgetDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId: number;
}

const allocationFormSchema = insertBudgetAllocationSchema.omit({ budgetId: true });

type AllocationFormValues = z.infer<typeof allocationFormSchema>;

export default function BudgetDetailsDialog({ 
  isOpen, 
  onClose, 
  budgetId 
}: BudgetDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState("allocations");
  const [editingAllocation, setEditingAllocation] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ categoryId: number; amount: number }>({ categoryId: 0, amount: 0 });
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Invalidate queries when dialog opens to ensure fresh data
  useEffect(() => {
    if (isOpen && budgetId > 0) {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/performance`] });
    }
  }, [isOpen, budgetId]);

  // Fetch the budget (with allocations and performance)
  const {
    data: budgetData,
    isLoading: isBudgetLoading,
    error: budgetError
  } = useQuery({
    queryKey: [`/api/budgets/${budgetId}`],
    queryFn: async () => {
      const response = await fetch(`/api/budgets/${budgetId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch budget details");
      }
      return response.json();
    },
    enabled: isOpen && budgetId > 0,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const budget = budgetData?.budget;
  const allocations = budgetData?.allocations;
  const performance = budgetData?.performance;

  // Debug logging to check what we're receiving
  console.log('Budget Details Dialog - Debug Data:', {
    budgetId,
    budgetData,
    budget,
    allocations,
    performance,
    performanceCategories: performance?.categories
  });

  // Remove separate allocations query (now comes from budgetData)

  // Fetch expense categories
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

  // Remove separate performance query (now comes from budgetData)

  // Form for adding a new allocation
  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      categoryId: 0,
      subcategoryId: null,
      amount: 0,
    },
  });

  // Create allocation mutation
  const createAllocationMutation = useMutation({
    mutationFn: async (data: AllocationFormValues) => {
      const response = await fetch(`/api/budgets/${budgetId}/allocations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          budgetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create allocation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/allocations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/performance`] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Allocation added",
        description: "Budget allocation has been added successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete allocation mutation
  const deleteAllocationMutation = useMutation({
    mutationFn: async (allocationId: number) => {
      const response = await fetch(`/api/budget-allocations/${allocationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete allocation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/allocations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/performance`] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Allocation deleted",
        description: "Budget allocation has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update allocation mutation
  const updateAllocationMutation = useMutation({
    mutationFn: async ({ allocationId, data }: { allocationId: number; data: AllocationFormValues }) => {
      const response = await fetch(`/api/budget-allocations/${allocationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          budgetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update allocation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/allocations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/performance`] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Allocation updated",
        description: "Budget allocation has been updated successfully.",
      });
      setEditingAllocation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset();
      setActiveTab("allocations");
      setEditingAllocation(null);
    }
  }, [isOpen, form]);

  // Handle form submission
  const onSubmit = (data: AllocationFormValues) => {
    createAllocationMutation.mutate(data);
  };

  // Handle allocation deletion
  const handleDeleteAllocation = (allocationId: number) => {
    if (confirm("Are you sure you want to delete this allocation?")) {
      deleteAllocationMutation.mutate(allocationId);
    }
  };

  // Handle editing allocation from performance table (inline editing)
  const handleEditPerformanceAllocation = (categoryId: number, currentAmount: number) => {
    setEditingAllocation(categoryId);
    setEditValues({ categoryId, amount: currentAmount });
  };

  // Handle saving allocation from performance table (inline editing)
  const handleSavePerformanceAllocation = (categoryId: number) => {
    const newAmount = editValues.amount;
    
    // Find if there's already an allocation for this category
    const existingAllocation = allocations?.find((alloc: any) => alloc.categoryId === categoryId);
    
    if (existingAllocation) {
      // Update existing allocation
      updateAllocationMutation.mutate({
        allocationId: existingAllocation.id,
        data: {
          categoryId,
          subcategoryId: null,
          amount: newAmount
        }
      });
    } else {
      // Create new allocation
      createAllocationMutation.mutate({
        categoryId,
        subcategoryId: null,
        amount: newAmount
      });
    }
    
    setEditingAllocation(null);
  };

  // Handle allocation editing
  const handleEditAllocation = (allocation: import("@/lib/models").BudgetAllocation) => {
    setEditingAllocation(allocation.id);
    setEditValues({
      categoryId: allocation.categoryId,
      amount: allocation.amount
    });
  };

  // Handle save allocation edit
  const handleSaveAllocation = (allocationId: number) => {
    // More flexible validation - allow keeping existing values
    if (!editValues.categoryId || editValues.categoryId <= 0) {
      toast({
        title: "Error",
        description: "Please select a valid category",
        variant: "destructive",
      });
      return;
    }

    if (editValues.amount < 0) {
      toast({
        title: "Error", 
        description: "Amount cannot be negative",
        variant: "destructive",
      });
      return;
    }

    updateAllocationMutation.mutate({
      allocationId,
      data: {
        categoryId: editValues.categoryId,
        subcategoryId: null,
        amount: editValues.amount
      }
    });
  };

  // Handle cancel allocation edit
  const handleCancelEdit = () => {
    setEditingAllocation(null);
    setEditValues({ categoryId: 0, amount: 0 });
  };

  // Find category name by id
  const getCategoryName = (categoryId: number) => {
    if (!categories) return "Unknown";
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : "Unknown";
  };

  // Loading state
  if (isBudgetLoading || isCategoriesLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (budgetError) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="text-center py-12">
            <p className="text-red-500">Error loading budget details</p>
            <p className="text-sm text-gray-500 mt-1">
              {(budgetError as Error)?.message}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{budget?.name || "Budget Details"}</DialogTitle>
          <DialogDescription>
            {budget && (
              <>
                <span className="block text-sm text-gray-500 mt-1">
                  Period: {budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : 'N/A'}
                </span>
                <span className="block text-sm text-gray-500">
                  {(() => {
                    const start = new Date(budget.startDate);
                    const end = new Date(budget.endDate);
                    const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());
                    return isValidDate(start) && isValidDate(end)
                      ? `${format(start, "PP")} - ${format(end, "PP")}`
                      : "Invalid date";
                  })()}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="allocations" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="allocations">Budget Allocations</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* ALLOCATIONS TAB */}
          <TabsContent value="allocations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Allocation</CardTitle>
                <CardDescription>
                  Allocate portions of your budget to different expense categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    onValueChange={(value) => field.onChange(Number(value))}
                                    value={field.value.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select a category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {isCategoriesLoading ? (
                                        <div className="flex items-center justify-center py-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span className="ml-2 text-sm">Loading categories...</span>
                                        </div>
                                      ) : categories && categories.length > 0 ? (
                                        categories.map(category => (
                                          <SelectItem key={category.id} value={category.id.toString()}>
                                            {category.name}
                                          </SelectItem>
                                        ))
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
                        name="subcategoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subcategory (Optional)</FormLabel>
                            <Select
                              onValueChange={(value) => 
                                field.onChange(value === "null" ? null : Number(value))
                              }
                              value={field.value === null ? "null" : field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a subcategory" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="null">None</SelectItem>
                                {/* Subcategories would be listed here */}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="Enter the Amount"
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9.]/g, '');
                                  field.onChange(Number(value) || 0);
                                }}
                                value={field.value === 0 ? '' : field.value.toString()}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit"
                      disabled={createAllocationMutation.isPending}
                      className="mt-2"
                    >
                      {createAllocationMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Allocation
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Allocations</CardTitle>
                <CardDescription>
                  Manage how your budget is distributed across categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(allocations ?? []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(allocations ?? []).map((allocation: import("@/lib/models").BudgetAllocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            {editingAllocation === allocation.id ? (
                              <div className="flex gap-1 items-center">
                                {!showNewCategoryInput ? (
                                  <>
                                    <Select
                                      value={editValues.categoryId.toString()}
                                      onValueChange={(value) => {
                                        const categoryId = parseInt(value);
                                        setEditValues(prev => ({ ...prev, categoryId }));
                                      }}
                                    >
                                      <SelectTrigger className="flex-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {isCategoriesLoading ? (
                                          <div className="flex items-center justify-center py-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="ml-2 text-sm">Loading...</span>
                                          </div>
                                        ) : categories && categories.length > 0 ? (
                                          categories.map(category => (
                                            <SelectItem key={category.id} value={category.id.toString()}>
                                              {category.name}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <div className="py-2 text-center text-sm text-gray-500">
                                            No categories
                                          </div>
                                        )}
                                      </SelectContent>
                                    </Select>
                                    <Button 
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowNewCategoryInput(true)}
                                      className="px-2"
                                      title="Add new category"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Input
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      placeholder="New category"
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
                                      className="px-2"
                                    >
                                      {createCategoryMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="h-3 w-3" />
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
                                      className="px-2"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            ) : (
                              allocation.categoryName || getCategoryName(allocation.categoryId)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingAllocation === allocation.id ? (
                              <Input
                                type="text"
                                placeholder="Enter the Amount"
                                value={editValues.amount.toString()}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9.]/g, '');
                                  const numValue = value === '' ? 0 : parseFloat(value);
                                  setEditValues(prev => ({ ...prev, amount: numValue }));
                                }}
                                className="text-right"
                              />
                            ) : (
                              formatCurrency(allocation.amount, user?.currency || 'XAF')
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {editingAllocation === allocation.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveAllocation(allocation.id)}
                                    disabled={updateAllocationMutation.isPending}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    {updateAllocationMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="text-gray-600 hover:text-gray-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditAllocation(allocation)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAllocation(allocation.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No allocations yet.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add an allocation above to get started.
                    </p>
                  </div>
                )}
              </CardContent>
              {(allocations ?? []).length > 0 && (
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full flex justify-between">
                    <span className="font-medium">Total Allocated:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        (allocations ?? []).reduce((sum: number, item: import("@/lib/models").BudgetAllocation) => sum + item.amount, 0),
                        user?.currency || 'XAF'
                      )}
                    </span>
                  </div>
                </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
                <CardDescription>
                  Track how your spending compares to your budget allocations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="text-sm text-gray-500">Total Budget</div>
                    <div className="text-xl font-semibold mt-1">
                      {budget ? formatCurrency(budget.amount, user?.currency || 'XAF') : "--"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="text-sm text-gray-500">Total Spent</div>
                    <div className="text-xl font-semibold mt-1">
                      {performance ? formatCurrency(performance.spent, user?.currency || 'XAF') : "--"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="text-sm text-gray-500">Remaining</div>
                    <div className="text-xl font-semibold mt-1">
                      {performance ? formatCurrency(performance.remaining, user?.currency || 'XAF') : "--"}
                    </div>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mb-8">
                  <div 
                    className={`h-4 rounded-full ${
                      performance && performance.spent > performance.allocated 
                        ? "bg-red-500" 
                        : "bg-gray-600"
                    }`}
                    style={{ 
                      width: `${performance 
                        ? Math.min(100, ((performance.spent / (budget?.amount || 1)) * 100)) 
                        : 0}%` 
                    }}
                  />
                </div>

                <h3 className="text-lg font-medium mb-4">Category Breakdown</h3>

                {performance && performance.categories.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.categories.map((category: {
                        categoryId: number;
                        categoryName: string;
                        allocated: number;
                        spent: number;
                        remaining: number;
                      }) => (
                        <TableRow key={category.categoryId}>
                          <TableCell>{category.categoryName}</TableCell>
                          <TableCell className="text-right">
                            {editingAllocation === category.categoryId ? (
                              <Input
                                type="number"
                                value={editValues.amount}
                                onChange={(e) => setEditValues({ ...editValues, amount: parseFloat(e.target.value) || 0 })}
                                onBlur={() => handleSavePerformanceAllocation(category.categoryId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSavePerformanceAllocation(category.categoryId);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingAllocation(null);
                                  }
                                }}
                                className="w-24 text-right"
                                autoFocus
                              />
                            ) : (
                              <span 
                                onClick={() => handleEditPerformanceAllocation(category.categoryId, category.allocated)}
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {formatCurrency(category.allocated, user?.currency || 'XAF')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(category.spent, user?.currency || 'XAF')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(category.remaining, user?.currency || 'XAF')}
                          </TableCell>
                          <TableCell className="w-[100px]">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  category.allocated === 0 
                                    ? "bg-orange-500" // Orange for unallocated categories with spending
                                    : category.spent > category.allocated 
                                      ? "bg-red-500" 
                                      : "bg-gray-600"
                                }`}
                                style={{ 
                                  width: `${
                                    category.allocated === 0 
                                      ? (category.spent > 0 ? 100 : 0) // Full bar if spending with no allocation
                                      : Math.min(100, ((category.spent / category.allocated) * 100))
                                  }%` 
                                }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 border rounded-md">
                    <div className="flex justify-center mb-2">
                      <PieChart className="h-12 w-12 text-gray-300" />
                    </div>
                    <p className="text-gray-500">No performance data available.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add allocations and record expenses to see performance details.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}