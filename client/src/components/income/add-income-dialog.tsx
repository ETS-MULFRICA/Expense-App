import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InsertIncome, IncomeCategory, clientIncomeSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
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


interface AddIncomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddIncomeDialog({ isOpen, onClose }: AddIncomeDialogProps) {
  console.log('AddIncomeDialog mounted. isOpen:', isOpen);
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
      return apiRequest("POST", "/api/user-income-categories", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income-categories"] });
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast({ title: "Success", description: "Category created successfully" });
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

  const form = useForm<any>({
    resolver: zodResolver(clientIncomeSchema),
    defaultValues: {
      description: "",
      amount: "",
      date: new Date(),
      categoryId: 0,
      categoryName: "",
      source: "",
      notes: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        description: "",
        amount: "",
        date: new Date(),
        categoryId: 0,
        categoryName: "",
        source: "",
        notes: "",
      });
    }
  }, [isOpen, form]);
  const createMutation = useMutation({
    mutationFn: async (data: InsertIncome) => {
      const resp = await apiRequest("POST", "/api/incomes", data);
      return await resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({
        title: "Income added successfully",
        description: "Your income record has been added.",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to add income: ${error?.message || error}`,
        variant: "destructive"
      });
    },
  });

  const onSubmit = async (data: any) => {
    console.log('DEBUG: Submitting income form data:', data);
    // Parse amount to number if it's a string
    const amount = typeof data.amount === "string"
      ? parseFloat(data.amount.replace(/[^0-9.]/g, ""))
      : data.amount;

    // Always get the latest value from form state
    const categoryName = form.getValues('categoryName');
    
    // Prevent submission if categoryName is empty
    if (!categoryName || categoryName.trim() === "") {
      toast({ title: "Error", description: "Category is required.", variant: "destructive" });
      return;
    }

    // Check if it's an existing category (either system or user-created)
    const found = categories.find(cat =>
      cat.name.trim().toLowerCase() === (categoryName || '').trim().toLowerCase()
    );

    let payload;
    if (found) {
      // Existing category
      payload = { ...data, amount, categoryId: found.id, categoryName: found.name };
    } else {
      // New category: create it first, then use categoryId: 0 for the income
      try {
        await createCategoryMutation.mutateAsync(categoryName.trim());
        payload = { ...data, amount, categoryId: 0, categoryName: categoryName.trim() };
      } catch (error) {
        // If category creation fails, still try to create income with categoryId: 0
        payload = { ...data, amount, categoryId: 0, categoryName: categoryName.trim() };
      }
    }

    // Debug: Confirm payload includes categoryId or categoryName
    if (payload.categoryId) {
      console.log('[DEBUG] Submitting with categoryId:', payload.categoryId, 'categoryName:', payload.categoryName);
    } else {
      console.log('[DEBUG] Submitting with new categoryName:', payload.categoryName);
    }
    console.log('DEBUG: Payload sent to backend:', payload);
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Add New Income
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
                          // If empty, set undefined, else convert to number
                          if (value === "") {
                            form.setValue("amount", undefined, { shouldValidate: true });
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
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex gap-2">
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
                                categories.map(cat => (
                                  <div key={cat.id} className="flex items-center justify-between group px-2 py-1">
                                    <SelectItem value={cat.name} className="flex-1">
                                      {cat.name}
                                    </SelectItem>
                                    {!cat.isDefault && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 ml-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteCategoryMutation.mutate(cat.id);
                                        }}
                                        disabled={deleteCategoryMutation.isPending}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))
                              )}
                            </SelectContent>
                          </Select>
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
                        
                        <Input
                          placeholder="Or type category name"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={e => {
                            form.setValue('categoryName', e.target.value, { shouldValidate: true });
                          }}
                        />
                      </div>
                    </FormControl>
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
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Saving..." : "Save Income"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}