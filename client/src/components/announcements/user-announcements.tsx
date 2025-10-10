import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function UserAnnouncements() {
  const { toast } = useToast();

  const { data: announcements, refetch } = useQuery({
    queryKey: ['/api/announcements'],
    queryFn: async () => {
      const res = await fetch('/api/announcements');
      if (!res.ok) throw new Error('Failed to load announcements');
      return res.json();
    }
  });

  const markViewed = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/announcements/${id}/view`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark viewed');
      return res.json();
    },
    onSuccess: (_data, id: any) => {
      refetch();
      toast({ title: 'Marked as read' });
    }
  });

  useEffect(() => {
    // Optionally auto-mark high-priority items as viewed when read by user
  }, []);

  return (
    <div className="space-y-3">
      {(announcements || []).map((a:any) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{a.title}</span>
              <span className="text-xs text-gray-500">{a.priority || 'normal'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700">{a.body}</div>
            <div className="mt-2 text-xs text-gray-400">Views: {a.view_count || 0} • {a.viewed ? 'Read' : 'Unread'}</div>
            {!a.viewed && <div className="mt-2"><Button onClick={()=>markViewed.mutate(a.id)}>Mark as read</Button></div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
