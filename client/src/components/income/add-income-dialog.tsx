import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InsertIncome, IncomeCategory, clientIncomeSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, X } from "lucide-react";
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
  const [newCategoryPrompt, setNewCategoryPrompt] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  // Get income categories from API
  const { data: categoriesRaw, isLoading: isCategoriesLoading } = useQuery<IncomeCategory[]>({
    queryKey: ["/api/income-categories"],
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Filter to unique category names (case-insensitive)
  const seen = new Set<string>();
  const categories = (categoriesRaw || []).filter(cat => {
    const name = cat.name.trim().toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  console.log('categories', categories, 'isLoading', isCategoriesLoading);

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

  // Reset form and prompt when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        description: "",
        amount: "",
        date: new Date(),
        categoryId: 0,
        source: "",
        notes: "",
      });
      setNewCategoryPrompt(false);
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
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add income: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
  console.log('DEBUG: Submitting income form data:', data);
  // Parse amount to number if it's a string
  const amount = typeof data.amount === "string"
    ? parseFloat(data.amount.replace(/[^0-9.]/g, ""))
    : data.amount;

  if (!categories || categories.length === 0) {
    toast({ title: "Error", description: "No categories available. Please create a category first.", variant: "destructive" });
    return;
  }

  // Debug log: print categories and selected value
  console.log('DEBUG: categories for validation:', categories);
  console.log('DEBUG: selected categoryName:', data.categoryName);

  // Find the selected category by name (case-insensitive, trimmed)
  // Always get the latest value from form state
  const categoryName = form.getValues('categoryName');
  const found = categories.find(cat =>
    cat.name.trim().toLowerCase() === (categoryName || '').trim().toLowerCase()
  );

  // Prevent submission if categoryName is empty
  if (!categoryName || categoryName.trim() === "") {
    toast({ title: "Error", description: "Category is required.", variant: "destructive" });
    return;
  }

  let payload;
  if (found) {
    // Valid category selected from list (default or user)
    payload = { ...data, amount, categoryId: found.id, categoryName: found.name };
    if (payload.categoryId === 0) delete payload.categoryId;
  } else {
    // New category: let backend handle creation
    payload = { ...data, amount, categoryId: undefined, categoryName };
    if (payload.categoryId === undefined) delete payload.categoryId;
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

  // Handler to actually create the user category
  const handleCreateUserCategory = async () => {
    const categoryName = form.getValues("categoryName");
    if (!categoryName) return;
    setCreatingCategory(true);
    try {
      const resp = await apiRequest("POST", "/api/user-income-categories", { name: categoryName });
      await resp.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/income-categories"] });
      setNewCategoryPrompt(false);
      setCreatingCategory(false);
      // After creation, try submit again
      onSubmit(form.getValues());
    } catch (err) {
      toast({ title: "Error", description: "Failed to create new category", variant: "destructive" });
      setCreatingCategory(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center">
            Add New Income
            <Button
              className="ml-auto"
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
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
                      <Input
                        placeholder="Type or select category"
                        list="income-category-list"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={e => {
                          const value = e.target.value;
                          form.setValue('categoryName', value, { shouldValidate: true });
                          setNewCategoryPrompt(false);
                        }}
                      />
                    </FormControl>
                    <datalist id="income-category-list">
                      {categories && categories.length > 0 &&
                        categories.map((category) => (
                          <option key={category.id || category.name} value={category.name} />
                        ))}
                    </datalist>
                    {newCategoryPrompt && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">This will be saved as a new category for you.</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={creatingCategory}
                          onClick={handleCreateUserCategory}
                        >
                          {creatingCategory ? "Saving..." : "Save as new category"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setNewCategoryPrompt(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
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