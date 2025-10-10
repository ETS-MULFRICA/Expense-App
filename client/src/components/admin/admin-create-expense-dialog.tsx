import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface Props { isOpen: boolean; onClose: () => void }

export default function AdminCreateExpenseDialog({ isOpen, onClose }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [merchant, setMerchant] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        setUsers(data);
        // load categories for expense assignment
        const cRes = await fetch('/api/expense-categories');
        if (cRes.ok) {
          const cData = await cRes.json();
          setCategories(cData);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isOpen]);

  const submit = async () => {
    if (!userId || !description || !amount || !categoryId) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const body = { userId: Number(userId), description, amount: Number(amount), date: date, categoryId: Number(categoryId), merchant };
      const res = await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/expenses'] });
      toast({ title: 'Expense created' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Expense (Admin)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">User</label>
            <select className="w-full border rounded px-2 py-1" value={String(userId)} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select user</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username || u.email || u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Merchant</label>
            <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <select className="w-full border rounded px-2 py-1" value={String(categoryId)} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Amount</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
