import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminBudgets() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ userId: "", name: "", startDate: "", endDate: "", amount: "", period: "monthly" });

  const { data: budgets } = useQuery({
    queryKey: ["/api/admin/budgets"],
    queryFn: async () => {
      const res = await fetch('/api/admin/budgets');
      if (!res.ok) throw new Error('Failed to fetch budgets');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/admin/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to create budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/budgets'] });
      toast({ title: 'Budget created' });
      setIsCreateOpen(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: any) => {
      const res = await fetch(`/api/admin/budgets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to update budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/budgets'] });
      toast({ title: 'Budget updated' });
      setIsEditOpen(false);
      setSelected(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/budgets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete budget');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/budgets'] });
      toast({ title: 'Budget deleted' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  const openEdit = (b: any) => {
    setSelected(b);
    setForm({ userId: b.userId, name: b.name, startDate: b.startDate?.split('T')[0], endDate: b.endDate?.split('T')[0], amount: b.amount, period: b.period });
    setIsEditOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Budgets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button onClick={() => setIsCreateOpen(true)}>Create Budget</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Budget Name</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets && budgets.length > 0 ? budgets.map((b:any) => (
              <TableRow key={b.id}>
                <TableCell>{b.userName || b.userId}</TableCell>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.period}</TableCell>
                <TableCell>{new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{b.amount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(b.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">No budgets found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User ID</Label>
              <Input value={form.userId} onChange={(e) => setForm((p:any) => ({ ...p, userId: e.target.value }))} />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p:any) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((p:any) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((p:any) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input value={form.amount} onChange={(e) => setForm((p:any) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Period</Label>
              <Input value={form.period} onChange={(e) => setForm((p:any) => ({ ...p, period: e.target.value }))} />
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
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p:any) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((p:any) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((p:any) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input value={form.amount} onChange={(e) => setForm((p:any) => ({ ...p, amount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={() => selected && updateMutation.mutate({ id: selected.id, payload: { name: form.name, startDate: form.startDate, endDate: form.endDate, amount: form.amount, period: form.period } })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
