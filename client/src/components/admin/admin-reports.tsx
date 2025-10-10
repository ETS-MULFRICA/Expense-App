import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminReports() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/reports'],
    queryFn: async () => {
      const res = await fetch('/api/admin/reports');
      if (!res.ok) throw new Error('Failed to load reports');
      return res.json();
    }
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => { refetch(); setName(''); toast({ title: 'Report saved' }); }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => { refetch(); toast({ title: 'Deleted' }); }
  });

  const runReport = (id: number) => {
    window.open(`/api/admin/reports/${id}/run`, '_blank');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Saved Reports</h3>
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="Report name" value={name} onChange={(e)=>setName(e.target.value)} />
          <Button size="sm" onClick={() => createMut.mutate({ name, filters: { type: 'expenses' } })} disabled={!name}>Save</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>
      ) : (
        <div className="space-y-2">
          {reports && reports.length > 0 ? reports.map((r:any) => (
            <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-gray-500">Saved: {new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => runReport(r.id)}>Run</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(r.id)}>Delete</Button>
              </div>
            </div>
          )) : (
            <div className="text-sm text-gray-500">No saved reports</div>
          )}
        </div>
      )}
    </div>
  );
}
