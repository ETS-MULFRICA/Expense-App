import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Income, IncomeCategory, clientIncomeSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EditIncomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  income: Income | null;
}

export function EditIncomeDialog({ isOpen, onClose, income }: EditIncomeDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  
  // Get income categories from API (both system and user categories)
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<(IncomeCategory & { isDefault?: boolean })[]>({
    queryKey: ["/api/income-categories"],
    enabled: isOpen,
  });

  // Mutation for creating user categories
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const systemCategories = ['Wages', 'Other', 'Deals'];
      const trimmedName = name.trim();
      
      // Check if it matches a system category (case-insensitive)
      const matchingSystemCategory = systemCategories.find(
        sys => sys.toLowerCase() === trimmedName.toLowerCase()
      );
      
      if (matchingSystemCategory) {
        // Instead of error, just return the system category name
        return { name: matchingSystemCategory };
      }
      
      // Check user categories
      if (categories.some(cat => !cat.isDefault && cat.name.toLowerCase() === trimmedName.toLowerCase())) {
        throw new Error(`Category "${trimmedName}" already exists`);
      }
      
      return apiRequest("POST", "/api/user-income-categories", { name: trimmedName });
    },
    onSuccess: (result, categoryName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/income-categories"] });
      // Auto-select the category (either system or newly created)
      const finalCategoryName = result.name || categoryName;
      form.setValue('categoryName', finalCategoryName, { shouldValidate: true });
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      
      // Different message for system vs new category
      const isSystemCategory = ['Wages', 'Other', 'Deals'].some(
        sys => sys.toLowerCase() === finalCategoryName.toLowerCase()
      );
      
      if (isSystemCategory) {
        toast({ 
          title: "Category Selected", 
          description: `Using existing system category: ${finalCategoryName}` 
        });
      } else {
        toast({ 
          title: "Success", 
          description: "Category created successfully" 
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create category",
        variant: "destructive" 
      });
    },
  });

  // Mutation for deleting user categories
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      return apiRequest("DELETE", `/api/user-income-categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income-categories"] });
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete category",
        variant: "destructive" 
      });
    },
  });

  type EditIncomeForm = {
    description: string;
    amount: number | null;
    date: Date | string;
    categoryId: number | null;
    categoryName: string;
    source?: string;
    notes?: string;
  };

  const form = useForm<EditIncomeForm>({
    resolver: zodResolver(clientIncomeSchema as any),
    defaultValues: {
      description: "",
      amount: null,
      date: new Date(),
      categoryId: null,
      categoryName: "",
      source: "",
      notes: "",
    },
  });

  // Update form when income data changes
  useEffect(() => {
    if (income && isOpen) {
      form.reset({
        description: income.description,
        amount: income.amount,
        date: new Date(income.date),
        categoryId: income.categoryId,
        categoryName: income.categoryName || "",
        source: income.source || "",
        notes: income.notes || "",
      });
    }
  }, [income, isOpen, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!income) throw new Error("No income to update");
      const resp = await apiRequest("PATCH", `/api/incomes/${income.id}`, data);
      return await resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({
        title: "Income updated successfully",
        description: "Your income record has been updated.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update income: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: EditIncomeForm) => {
    // Parse amount to number if it's a string
    let amount = data.amount;
    if (typeof amount === "string") {
      amount = parseFloat((amount as string).replace(/[^0-9.]/g, ""));
    }
    
    // Always get the latest value from form state
    const categoryName = form.getValues('categoryName');
    
    // Check if it's an existing category (either system or user-created)
    const found = categories.find(cat =>
      cat.name.trim().toLowerCase() === (categoryName || '').trim().toLowerCase()
    );
    
    let categoryId;
    if (found) {
      categoryId = found.id;
    } else {
      // New category: create it first, then use categoryId: 0 for the income
      try {
        await createCategoryMutation.mutateAsync(categoryName.trim());
        categoryId = 0;
      } catch (error) {
        // If category creation fails, still try to update income with categoryId: 0
        categoryId = 0;
      }
    }
    
    updateMutation.mutate({
      ...data,
      amount,
      categoryId,
      categoryName,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Edit Income
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description*</FormLabel>
                  <FormControl>
                    <Input placeholder="Salary, Bonus, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount* ({user?.currency || "XAF"})</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter amount"
                        value={field.value === undefined || field.value === null ? "" : String(field.value)}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^0-9.]/g, "");
                          // If empty, set null, else convert to number
                          if (value === "") {
                            form.setValue("amount", null, { shouldValidate: true });
                          } else {
                            form.setValue("amount", Number(value), { shouldValidate: true });
                          }
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
                  <FormItem className="flex flex-col">
                    <FormLabel>Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP")
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
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => 
                            field.onChange(date ? date.toISOString() : new Date().toISOString())
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category*</FormLabel>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <FormControl>
                          <Select
                            onValueChange={value => {
                              form.setValue('categoryName', value, { shouldValidate: true });
                            }}
                            value={categories.some(cat => cat.name === field.value) ? field.value : ''}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {isCategoriesLoading ? (
                                <SelectItem value="" disabled>Loading...</SelectItem>
                              ) : (
                                <>
                                  {/* System categories */}
                                  {categories.filter(cat => cat.isDefault).map(cat => (
                                    <SelectItem key={cat.id} value={cat.name}>
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                                  {/* User categories with delete functionality */}
                                  {categories.filter(cat => !cat.isDefault).map(cat => (
                                    <div key={cat.id} className="relative">
                                      <SelectItem value={cat.name} className="pr-8">
                                        {cat.name}
                                      </SelectItem>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 opacity-50 hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Delete category "${cat.name}"?`)) {
                                            deleteCategoryMutation.mutate(cat.id);
                                          }
                                        }}
                                        disabled={deleteCategoryMutation.isPending}
                                        title={`Delete ${cat.name}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {showNewCategoryInput && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="New category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && newCategoryName.trim()) {
                                createCategoryMutation.mutate(newCategoryName.trim());
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              if (newCategoryName.trim()) {
                                createCategoryMutation.mutate(newCategoryName.trim());
                              }
                            }}
                            disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                          >
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name, client, etc." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional details about this income" 
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
                className="mt-2"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="btn-gradient mt-2"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Update Income"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}