import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function Announcements() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: announcements, refetch } = useQuery({
    queryKey: ['/api/admin/announcements'],
    queryFn: async () => {
      const res = await fetch('/api/admin/announcements');
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      if (!res.ok) throw new Error('Failed to create announcement');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Announcement created' });
      setTitle('');
      setBody('');
      refetch();
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create Announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Title" value={title} onChange={(e:any)=>setTitle(e.target.value)} className="mb-2" />
          <Textarea placeholder="Message body" value={body} onChange={(e:any)=>setBody(e.target.value)} className="mb-2" />
          <Button onClick={()=>createMutation.mutate()}>Send</Button>
        </CardContent>
      </Card>

      <div>
        {(announcements || []).map((a:any)=> (
          <Card key={a.id} className="mb-2">
            <CardHeader>
              <CardTitle>{a.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">{a.body}</div>
              <div className="text-xs text-gray-400 mt-2">By: {a.author || 'system'} • {new Date(a.created_at).toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
