import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: settings, refetch } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    }
  });

  const [siteName, setSiteName] = useState('');
  const [currency, setCurrency] = useState('');

  useState(()=>{
    if (settings) {
      setSiteName(settings.site_name || settings.siteName || '');
      setCurrency(settings.default_currency || settings.defaultCurrency || 'USD');
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_name: siteName, default_currency: currency })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Settings saved' });
      refetch();
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Site Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Site name" value={siteName} onChange={(e:any)=>setSiteName(e.target.value)} />
            <Input placeholder="Default currency" value={currency} onChange={(e:any)=>setCurrency(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button onClick={()=>saveMutation.mutate()}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
