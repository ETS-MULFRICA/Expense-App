import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onCreated?: () => void }

export default function CreateAnnouncementDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low'|'normal'|'urgent'>('normal');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, priority }) });
      if (!res.ok) throw new Error('Failed to create announcement');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Announcement created' });
      setTitle(''); setBody(''); setPriority('normal');
      onOpenChange(false);
      onCreated && onCreated();
    },
    onError: (err:any) => toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' })
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e:any)=>setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e:any)=>setBody(e.target.value)} />
          </div>
          <div>
            <Label>Priority</Label>
            <select value={priority} onChange={(e:any)=>setPriority(e.target.value)} className="border rounded px-2 py-1">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={()=>createMutation.mutate()} disabled={(createMutation as any).status === 'loading' || !title || !body}>{(createMutation as any).status === 'loading' ? 'Sending...' : 'Send'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
