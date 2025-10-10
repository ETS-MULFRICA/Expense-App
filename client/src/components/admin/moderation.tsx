import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Moderation() {
  const { toast } = useToast();
  const { data: items, refetch } = useQuery({
    queryKey: ['/api/admin/moderation'],
    queryFn: async () => {
      const res = await fetch('/api/admin/moderation');
      if (!res.ok) throw new Error('Failed to fetch moderation queue');
      return res.json();
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: any) => {
      const res = await fetch(`/api/admin/moderation/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('Failed to perform action');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Action recorded' });
      refetch();
    }
  });

  return (
    <div className="space-y-4">
      {(items || []).map((it:any) => (
        <Card key={it.id}>
          <CardHeader>
            <CardTitle>{it.resource_type} #{it.resource_id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700">Reported by: {it.reporter_id || 'unknown'}</div>
            <div className="text-sm text-gray-700">Reason: {it.reason}</div>
            <div className="mt-2 space-x-2">
              <Button onClick={()=>actionMutation.mutate({ id: it.id, action: 'warn' })}>Warn</Button>
              <Button onClick={()=>actionMutation.mutate({ id: it.id, action: 'hide' })}>Hide</Button>
              <Button onClick={()=>actionMutation.mutate({ id: it.id, action: 'escalate' })}>Escalate</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
