import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function Backup() {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to trigger backup');
      return res.json();
    },
    onSuccess: (data:any) => {
      toast({ title: 'Backup started', description: `ID: ${data.backupId}` });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">Trigger database backup (simulated)</div>
        <Button onClick={()=>mutation.mutate()}>Start Backup</Button>
      </CardContent>
    </Card>
  );
}
