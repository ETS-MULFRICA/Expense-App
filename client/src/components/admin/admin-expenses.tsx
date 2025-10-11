import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminExpenses() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ userId: "", amount: "", description: "", date: "", categoryId: "" });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["/api/admin/expenses"],
    queryFn: async () => {
      const res = await fetch('/api/admin/expenses');
      if (!res.ok) throw new Error('Failed to fetch expenses');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to create expense');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/expenses'] });
      toast({ title: 'Expense created' });
      setIsCreateOpen(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: any) => {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to update expense');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/expenses'] });
      toast({ title: 'Expense updated' });
      setIsEditOpen(false);
      setSelected(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete expense');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/expenses'] });
      toast({ title: 'Expense deleted' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  const openEdit = (expense: any) => {
    setSelected(expense);
    setForm({ userId: expense.userId, amount: expense.amount, description: expense.description, date: expense.date, categoryId: expense.categoryId });
    setIsEditOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Expenses</CardTitle>
        <CardDescription>Manage expenses across all users</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button onClick={() => setIsCreateOpen(true)}>Create Expense</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses && expenses.length > 0 ? expenses.map((e:any) => (
              <TableRow key={e.id}>
                <TableCell>{e.userName || e.userId}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{e.categoryName || 'N/A'}</TableCell>
                <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{e.amount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(e.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">No expenses found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User ID</Label>
              <Input value={form.userId} onChange={(e) => setForm((p:any) => ({ ...p, userId: e.target.value }))} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input value={form.amount} onChange={(e) => setForm((p:any) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p:any) => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((p:any) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Category ID</Label>
              <Input value={form.categoryId} onChange={(e) => setForm((p:any) => ({ ...p, categoryId: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input value={form.amount} onChange={(e) => setForm((p:any) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p:any) => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((p:any) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={() => selected && updateMutation.mutate({ id: selected.id, payload: form })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
