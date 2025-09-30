import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ExpenseCategory {
  id: number;
  name: string;
  userId: number;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

interface AddBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (budget: { name: string; amount: number; categoryId?: number }) => void;
}

export const AddBudgetDialog: React.FC<AddBudgetDialogProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();

  // Fetch expense categories
  const { 
    data: categories, 
    isLoading: isCategoriesLoading,
    refetch: refetchCategories
  } = useQuery<ExpenseCategory[]>({
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
      setSelectedCategoryId(newCategory.id);
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
      setSelectedCategoryId(null);
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

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(Number(categoryId));
  };

  const handleAdd = () => {
    const budgetData: any = { name, amount };
    if (selectedCategoryId) {
      budgetData.categoryId = selectedCategoryId;
    }
    onAdd(budgetData);
    setName("");
    setAmount(0);
    setSelectedCategoryId(null);
    onClose();
  };

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Add Budget</DialogTitle>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="budget-name">Budget Name</Label>
            <Input 
              id="budget-name"
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Budget Name" 
            />
          </div>
          
          <div>
            <Label htmlFor="budget-amount">Amount</Label>
            <Input 
              id="budget-amount"
              type="number" 
              value={amount} 
              onChange={e => setAmount(Number(e.target.value))} 
              placeholder="Amount" 
            />
          </div>

          <div>
            <Label htmlFor="budget-category">Category (Optional)</Label>
            <div className="category-input-container flex gap-2 items-center">
              {!showNewCategoryInput ? (
                <>
                  <Select
                    value={selectedCategoryId ? selectedCategoryId.toString() : ""}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
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
                  {selectedCategoryId && selectedCategory && !selectedCategory.isSystem && (
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCategory(selectedCategoryId)}
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
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleAdd}>
            Add Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
