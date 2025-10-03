import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clientBudgetSchema } from "@shared/schema";
import { Budget } from "@/lib/models";
import { CalendarIcon, Loader2, Filter, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ExpenseCategoryWithSystem {
  id: number;
  name: string;
  userId: number;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

const formSchema = clientBudgetSchema;

type FormValues = z.infer<typeof formSchema>;
type UpdateBudgetData = FormValues & { categoryIds: number[] };

interface EditBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  budget: Budget;
}

export default function EditBudgetDialog({
  isOpen,
  onClose,
  budget,
}: EditBudgetDialogProps) {
  const [isPeriodCustom, setIsPeriodCustom] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categoryError, setCategoryError] = useState<string>("");
  const [showOnlyUsedCategories, setShowOnlyUsedCategories] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();

  // Fetch expense categories
  const { data: categories, isLoading: isCategoriesLoading } = useQuery<ExpenseCategoryWithSystem[]>({
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

  // Fetch current budget allocations to pre-select categories
  const { data: currentAllocations } = useQuery<{ categoryId: number }[]>({
    queryKey: [`/api/budgets/${budget.id}/allocations`],
    queryFn: async () => {
      const response = await fetch(`/api/budgets/${budget.id}/allocations`);
      if (!response.ok) {
        throw new Error("Failed to fetch budget allocations");
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
      setSelectedCategories([...selectedCategories, newCategory.id]);
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
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setSelectedCategories(selectedCategories.filter(id => id !== deleteCategoryMutation.variables));
      
      const isHidden = data.type === 'hidden';
      toast({
        title: isHidden ? "Category hidden" : "Category deleted",
        description: isHidden 
          ? "The system category has been hidden from your view. You can restore it anytime from settings."
          : "The category has been deleted successfully.",
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
    const category = categories?.find(c => c.id === categoryId);
    const isSystemCategory = category?.isSystem;
    
    const confirmMessage = isSystemCategory 
      ? 'Are you sure you want to hide this system category? You can restore it later from settings.'
      : 'Are you sure you want to delete this category?';
      
    if (window.confirm(confirmMessage)) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  // Safely parse dates with fallback
  const parseDate = (dateValue: any) => {
    if (!dateValue) return new Date();
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: budget.name,
      period: budget.period,
      startDate: parseDate(budget.startDate),
      endDate: parseDate(budget.endDate),
      amount: budget.amount,
      notes: budget.notes || "",
    },
  });

  // Update form when budget changes
  useEffect(() => {
    form.reset({
      name: budget.name,
      period: budget.period,
      startDate: parseDate(budget.startDate),
      endDate: parseDate(budget.endDate),
      amount: budget.amount,
      notes: budget.notes || "",
    });

    // Check if the period is custom
    setIsPeriodCustom(budget.period === "custom");
  }, [budget, form]);

  // Update selected categories when current allocations are loaded
  useEffect(() => {
    if (currentAllocations) {
      const categoryIds = currentAllocations.map(allocation => allocation.categoryId);
      setSelectedCategories(categoryIds);
    }
  }, [currentAllocations]);

  const updateBudgetMutation = useMutation({
    mutationFn: async (data: UpdateBudgetData) => {
      console.log('DEBUG: Updating budget with data:', data);
      const response = await fetch(`/api/budgets/${budget.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update budget");
      }

      return response.json() as Promise<Budget>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Budget updated",
        description: "Your budget has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handlePeriodChange(value: string) {
    // Reset end date based on the selected period
    const startDate = form.getValues("startDate");
    let endDate = new Date(startDate);

    if (value === "custom") {
      setIsPeriodCustom(true);
      // Don't automatically set end date for custom
      return;
    }
    
    setIsPeriodCustom(false);
    
    switch (value) {
      case "weekly":
        endDate.setDate(startDate.getDate() + 7);
        break;
      case "monthly":
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      case "quarterly":
        endDate.setMonth(startDate.getMonth() + 3);
        break;
      case "biannual":
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case "annual":
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
      default:
        // Default to monthly
        endDate.setMonth(startDate.getMonth() + 1);
    }

    form.setValue("endDate", endDate);
  }

  function handleStartDateChange(date: Date) {
    form.setValue("startDate", date);
    
    // Update end date based on the period
    const period = form.getValues("period");
    if (period !== "custom") {
      let endDate = new Date(date);
      
      switch (period) {
        case "weekly":
          endDate.setDate(date.getDate() + 7);
          break;
        case "monthly":
          endDate.setMonth(date.getMonth() + 1);
          break;
        case "quarterly":
          endDate.setMonth(date.getMonth() + 3);
          break;
        case "biannual":
          endDate.setMonth(date.getMonth() + 6);
          break;
        case "annual":
          endDate.setFullYear(date.getFullYear() + 1);
          break;
      }
      
      form.setValue("endDate", endDate);
    }
  }

  const onSubmit = (data: FormValues) => {
    if (selectedCategories.length === 0) {
      setCategoryError("Please select at least one category.");
      return;
    } else {
      setCategoryError("");
    }
    const updateData: UpdateBudgetData = {
      ...data,
      categoryIds: selectedCategories
    };
    console.log('DEBUG: Update data with categories:', updateData);
    updateBudgetMutation.mutate(updateData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Budget</DialogTitle>
          <DialogDescription>
            Update your budget details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        handlePeriodChange(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="biannual">Biannual</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
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
                    <FormLabel>Total Budget</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        placeholder="Enter Total Budget"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          field.onChange(Number(value) || 0);
                        }}
                        value={field.value > 0 ? field.value.toString() : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      This is the total amount you plan to spend during this period
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value && !isNaN(new Date(field.value).getTime())
                              ? format(new Date(field.value), "PPP")
                              : <span>Pick a date</span>
                            }
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) {
                              handleStartDateChange(date);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={!isPeriodCustom}
                          >
                            {field.value ? (
                              format(parseDate(field.value), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => date && field.onChange(date)}
                          disabled={(date) => date < form.getValues("startDate")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                    {!isPeriodCustom && (
                      <FormDescription>
                        End date is automatically set based on the period
                      </FormDescription>
                    )}
                  </FormItem>
                )}
              />
            </div>

            {/* Category Filter Toggle */}
            <div className="flex items-center justify-between mb-4">
              <Label htmlFor="category-filter-edit-budget" className="text-sm font-medium">
                Show only used categories
              </Label>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Switch
                  id="category-filter-edit-budget"
                  checked={showOnlyUsedCategories}
                  onCheckedChange={setShowOnlyUsedCategories}
                />
              </div>
            </div>

            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Categories</FormLabel>
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                  className="px-3"
                  title="Add new category"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {showNewCategoryInput && (
                <div className="flex gap-2 items-center mt-2">
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
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(isCategoriesLoading || (showOnlyUsedCategories && isUsedCategoriesLoading)) ? (
                  <div className="col-span-2 flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="ml-2 text-sm">Loading categories...</span>
                  </div>
                ) : filteredCategories && filteredCategories.length > 0 ? (
                  filteredCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([...selectedCategories, category.id]);
                          } else {
                            setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor={`edit-category-${category.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
                      >
                        {category.name}
                      </label>
                      {(
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="px-2 text-red-600 hover:text-red-700"
                          title={category.isSystem ? "Hide this system category from your view" : "Delete this custom category"}
                          disabled={deleteCategoryMutation.isPending}
                        >
                          {deleteCategoryMutation.isPending && deleteCategoryMutation.variables === category.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))
                ) : showOnlyUsedCategories ? (
                  <p className="text-sm text-gray-500 col-span-2">
                    No categories used yet. Toggle off to see all categories.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 col-span-2">No categories available</p>
                )}
              </div>
              {categoryError && (
                <p className="text-sm text-red-500 mt-1">{categoryError}</p>
              )}
              <FormDescription
                className={categoryError ? "text-red-500" : undefined}
              >
                Select the categories this budget will track
              </FormDescription>
            </FormItem>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateBudgetMutation.isPending || selectedCategories.length === 0}
              >
                {updateBudgetMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}