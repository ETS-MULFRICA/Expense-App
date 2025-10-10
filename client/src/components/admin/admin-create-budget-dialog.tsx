import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface Props { isOpen: boolean; onClose: () => void }

export default function AdminCreateBudgetDialog({ isOpen, onClose }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'quarterly' | 'annual' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0,10);
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        setUsers(data);
        const cRes = await fetch('/api/expense-categories');
        if (cRes.ok) setCategories(await cRes.json());
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isOpen]);

  // Compute endDate when period or startDate changes (unless custom)
  useEffect(() => {
    if (period === 'custom') return;
    const s = new Date(startDate);
    const e = new Date(s);
    switch (period) {
      case 'weekly':
        e.setDate(s.getDate() + 7);
        break;
      case 'monthly':
        e.setMonth(s.getMonth() + 1);
        break;
      case 'quarterly':
        e.setMonth(s.getMonth() + 3);
        break;
      case 'annual':
        e.setFullYear(s.getFullYear() + 1);
        break;
    }
    setEndDate(e.toISOString().slice(0,10));
  }, [period, startDate]);

  const submit = async () => {
    if (!userId || !name || !amount || !startDate || !endDate) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const body = { userId: Number(userId), name, amount: Number(amount), period, startDate, endDate };
      const res = await fetch('/api/admin/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/budgets'] });
      toast({ title: 'Budget created' });
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
          <DialogTitle>Create Budget (Admin)</DialogTitle>
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
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Amount</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <div>
            <label className="text-sm font-medium">Period</label>
            <select className="w-full border rounded px-2 py-1" value={period} onChange={(e) => setPeriod(e.target.value as any)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
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
