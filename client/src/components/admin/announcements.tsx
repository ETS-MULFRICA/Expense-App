import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import CreateAnnouncementDialog from './create-announcement-dialog';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Announcements() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low'|'normal'|'urgent'>('normal');

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/announcements/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/announcements/stats');
      if (!res.ok) throw new Error('Failed to load announcement stats');
      return res.json();
    }
  });

  const { data: announcements, refetch } = useQuery({
    queryKey: ['/api/admin/announcements'],
    queryFn: async () => {
      const res = await fetch('/api/admin/announcements');
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    }
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, priority })
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Announcement deleted' });
      refetch();
    }
  });

  const [tab, setTab] = useState<'active'|'inactive'|'all'>('active');
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const openStats = async (id:number) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}/viewers`);
      if (!res.ok) throw new Error('Failed to load viewers');
      const viewers = await res.json();
      setStatsData(viewers);
      setStatsOpen(true);
    } catch (err:any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEdit = async (id:number) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`);
      if (!res.ok) throw new Error('Failed to load announcement');
      const a = await res.json();
      setEditing(a);
      setEditOpen(true);
    } catch (err:any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const editMutation = useMutation({
    mutationFn: async (payload:any) => {
      const res = await fetch(`/api/admin/announcements/${payload.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => { refetch(); setEditOpen(false); toast({ title: 'Updated' }); }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Announcement Management</h2>
          <p className="text-sm text-gray-500">Create and manage system announcements for all users</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-2 text-gray-400" size={16} />
            <Input className="pl-8" placeholder="Search announcements" value={searchQ} onChange={(e:any)=>setSearchQ(e.target.value)} />
          </div>
          <Button onClick={()=>setIsCreateOpen(true)}>+ Create Announcement</Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold">{stats?.active ?? 0}</div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Urgent</div>
            <div className="text-2xl font-bold">{stats?.urgent ?? 0}</div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Avg views</div>
            <div className="text-2xl font-bold">{(stats?.avgViewsPerAnnouncement ?? 0).toFixed(1)}</div>
          </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create Announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Title" value={title} onChange={(e:any)=>setTitle(e.target.value)} className="mb-2" />
          <Textarea placeholder="Message body" value={body} onChange={(e:any)=>setBody(e.target.value)} className="mb-2" />
          <div className="mb-2">
            <Label className="mr-2">Priority</Label>
            <select value={priority} onChange={(e:any)=>setPriority(e.target.value)} className="border rounded px-2 py-1">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={()=>createMutation.mutate()}>Send</Button>
            <Button variant="outline" onClick={()=>{ setTitle(''); setBody(''); setPriority('normal'); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex gap-2 mb-3">
          <button className={`px-3 py-1 rounded ${tab==='active'?'bg-slate-800 text-white':'bg-white'}`} onClick={()=>setTab('active')}>Active</button>
          <button className={`px-3 py-1 rounded ${tab==='inactive'?'bg-slate-800 text-white':'bg-white'}`} onClick={()=>setTab('inactive')}>Inactive</button>
          <button className={`px-3 py-1 rounded ${tab==='all'?'bg-slate-800 text-white':'bg-white'}`} onClick={()=>setTab('all')}>All</button>
        </div>
        {(announcements || []).filter((a:any)=> {
          if (tab !== 'all' && ((tab === 'active') !== !!a.visible)) return false;
          if (searchQ) {
            const q = searchQ.toLowerCase();
            return (a.title || '').toLowerCase().includes(q) || (a.body || '').toLowerCase().includes(q);
          }
          return true;
        }).map((a:any)=> (
          <Card key={a.id} className="mb-3">
            <CardHeader className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3">
                  <span>{a.title}</span>
                  <span className={`text-xs px-2 py-1 rounded ${a.priority==='urgent'?'bg-red-100 text-red-700': a.priority==='low'?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-700'}`}>{a.priority}</span>
                </CardTitle>
                <div className="text-xs text-gray-400 mt-1">By: {a.author || 'system'} • {new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2 whitespace-nowrap">
                <Button variant="ghost" onClick={()=>openStats(a.id)}>Stats</Button>
                <Button variant="ghost" onClick={()=>openEdit(a.id)}>Edit</Button>
                <Button variant="destructive" onClick={()=>{ if (confirm('Delete this announcement?')) deleteMutation.mutate(a.id); }}>Delete</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">{a.body}</div>
            </CardContent>
          </Card>
        ))}
      
      <CreateAnnouncementDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onCreated={()=>refetch()} />
      </div>

      {/* Stats dialog */}
      <Dialog open={statsOpen} onOpenChange={(o)=>!o && setStatsOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Announcement Views</DialogTitle>
          </DialogHeader>
          <div>
            {statsData?.length ? statsData.map((v:any)=> (
              <div key={v.user_id} className="p-2 border-b">
                <div className="text-sm font-medium">{v.username || v.user_id}</div>
                <div className="text-xs text-gray-500">{new Date(v.viewed_at).toLocaleString()}</div>
              </div>
            )) : <div className="p-4 text-sm text-gray-500">No views yet</div>}
          </div>
          <DialogFooter>
            <Button onClick={()=>setStatsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o)=>!o && setEditOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          {editing && (
            <div>
              <div className="mb-2"><Label>Title</Label><Input value={editing.title} onChange={(e:any)=>setEditing({...editing, title: e.target.value})} /></div>
              <div className="mb-2"><Label>Body</Label><Textarea value={editing.body} onChange={(e:any)=>setEditing({...editing, body: e.target.value})} /></div>
              <div className="mb-2">
                <Label>Priority</Label>
                <select value={editing.priority} onChange={(e:any)=>setEditing({...editing, priority: e.target.value})} className="border rounded px-2 py-1">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={()=>editMutation.mutate(editing)}>Save</Button>
                <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
