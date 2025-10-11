import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Shield, Download, Upload, Database, RefreshCw, Trash2, Eye, 
  Calendar, Clock, FileText, AlertTriangle, CheckCircle, XCircle,
  Activity, Lock, Globe, Server, HardDrive, Timer
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface BackupEntry {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  type: 'full' | 'schema_only' | 'data_only';
  status: 'in_progress' | 'completed' | 'failed';
  created_by_username: string;
  created_by_name: string;
  error_message?: string;
}

interface SecurityLogEntry {
  id: number;
  user_id?: number;
  event_type: string;
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
  username?: string;
  user_name?: string;
}

interface SecurityStats {
  successful_logins_24h: number;
  failed_logins_24h: number;
  successful_logins_7d: number;
  failed_logins_7d: number;
  unique_users_24h: number;
  unique_ips_24h: number;
  locked_accounts: number;
  admin_actions_24h: number;
}

const backupTypeLabels = {
  'full': 'Full Backup',
  'schema_only': 'Schema Only',
  'data_only': 'Data Only'
};

const statusIcons = {
  'in_progress': { icon: Timer, color: 'text-blue-500' },
  'completed': { icon: CheckCircle, color: 'text-green-500' },
  'failed': { icon: XCircle, color: 'text-red-500' }
};

const eventTypeLabels = {
  'login_success': 'Login Success',
  'login_failure': 'Login Failed',
  'logout': 'Logout',
  'password_change': 'Password Changed',
  'account_locked': 'Account Locked',
  'admin_action': 'Admin Action',
  'password_reset_requested': 'Password Reset Requested',
  'password_reset_completed': 'Password Reset Completed',
  'account_suspended': 'Account Suspended',
  'account_reactivated': 'Account Reactivated'
};

const eventTypeColors = {
  'login_success': 'bg-green-100 text-green-800',
  'login_failure': 'bg-red-100 text-red-800',
  'logout': 'bg-blue-100 text-blue-800',
  'password_change': 'bg-yellow-100 text-yellow-800',
  'account_locked': 'bg-red-100 text-red-800',
  'admin_action': 'bg-purple-100 text-purple-800',
  'password_reset_requested': 'bg-orange-100 text-orange-800',
  'password_reset_completed': 'bg-green-100 text-green-800',
  'account_suspended': 'bg-red-100 text-red-800',
  'account_reactivated': 'bg-green-100 text-green-800'
};

export function BackupSecurityManagement() {
  const [activeTab, setActiveTab] = useState('backups');
  const [backupType, setBackupType] = useState<'full' | 'schema_only' | 'data_only'>('full');
  const [backupDescription, setBackupDescription] = useState('');
  const [securityLogFilters, setSecurityLogFilters] = useState({
    event_type: 'all',
    user_id: '',
    ip_address: '',
    from_date: '',
    to_date: ''
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch backups
  const { data: backupsData, isLoading: backupsLoading } = useQuery<{
    backups: BackupEntry[];
    pagination: any;
  }>({
    queryKey: ['admin', 'backups'],
    queryFn: async () => {
      const response = await fetch('/api/admin/backups', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      return response.json();
    },
    refetchInterval: 10000 // Refetch every 10 seconds to update backup status
  });

  // Fetch security logs
  const { data: securityLogsData, isLoading: securityLogsLoading } = useQuery<{
    logs: SecurityLogEntry[];
    pagination: any;
  }>({
    queryKey: ['admin', 'security', 'logs', securityLogFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(securityLogFilters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/admin/security/logs?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch security logs');
      }
      return response.json();
    }
  });

  // Fetch security stats
  const { data: securityStats } = useQuery<SecurityStats>({
    queryKey: ['admin', 'security', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/security/stats', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch security stats');
      }
      const data = await response.json();
      return data.stats;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async ({ type, description }: { type: string; description: string }) => {
      const response = await fetch('/api/admin/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, description })
      });
      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
      setBackupDescription('');
      toast({ title: "Success", description: "Backup initiated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to create backup: ${error.message}`, variant: "destructive" });
    }
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: number) => {
      const response = await fetch(`/api/admin/backups/${backupId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to delete backup');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
      toast({ title: "Success", description: "Backup deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to delete backup: ${error.message}`, variant: "destructive" });
    }
  });

  const handleDownloadBackup = (backupId: number, filename: string) => {
    const downloadUrl = `/api/admin/backups/${backupId}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center">
            <Shield className="w-6 h-6 mr-2" />
            Backup & Security
          </h2>
          <p className="text-muted-foreground">
            Manage database backups and monitor security events
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'security'] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="backups" className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>Database Backups</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Security Logs</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center space-x-2">
            <Server className="w-4 h-4" />
            <span>Security Stats</span>
          </TabsTrigger>
        </TabsList>

        {/* DATABASE BACKUPS TAB */}
        <TabsContent value="backups" className="space-y-6">
          {/* Create Backup Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <HardDrive className="w-5 h-5 mr-2" />
                Create New Backup
              </CardTitle>
              <CardDescription>
                Create a database backup that can be downloaded and restored later
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-type">Backup Type</Label>
                  <Select value={backupType} onValueChange={(value: any) => setBackupType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Backup (Schema + Data)</SelectItem>
                      <SelectItem value="schema_only">Schema Only</SelectItem>
                      <SelectItem value="data_only">Data Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backup-description">Description (Optional)</Label>
                  <Input
                    id="backup-description"
                    value={backupDescription}
                    onChange={(e) => setBackupDescription(e.target.value)}
                    placeholder="Backup before major update..."
                  />
                </div>
              </div>
              <Button 
                onClick={() => createBackupMutation.mutate({ type: backupType, description: backupDescription })}
                disabled={createBackupMutation.isPending}
                className="w-full md:w-auto"
              >
                {createBackupMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Create Backup
              </Button>
            </CardContent>
          </Card>

          {/* Backups List */}
          <Card>
            <CardHeader>
              <CardTitle>Backup History</CardTitle>
              <CardDescription>
                View and manage existing database backups
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backupsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : backupsData?.backups?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No backups found. Create your first backup above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Filename</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backupsData?.backups?.map((backup) => {
                      const StatusIcon = statusIcons[backup.status]?.icon || Clock;
                      const statusColor = statusIcons[backup.status]?.color || 'text-gray-500';
                      
                      return (
                        <TableRow key={backup.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                              <Badge variant={backup.status === 'completed' ? 'default' : 
                                backup.status === 'failed' ? 'destructive' : 'secondary'}>
                                {backup.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {backup.filename}
                            {backup.error_message && (
                              <div className="text-xs text-red-500 mt-1">
                                {backup.error_message}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {backupTypeLabels[backup.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {backup.size > 0 ? formatBytes(backup.size) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(backup.created_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatRelativeTime(backup.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {backup.created_by_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @{backup.created_by_username}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {backup.status === 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadBackup(backup.id, backup.filename)}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-red-600">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this backup? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteBackupMutation.mutate(backup.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY LOGS TAB */}
        <TabsContent value="security" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Security Log Filters</CardTitle>
              <CardDescription>Filter security events by type, user, or date range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-type-filter">Event Type</Label>
                  <Select 
                    value={securityLogFilters.event_type} 
                    onValueChange={(value) => setSecurityLogFilters({...securityLogFilters, event_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      {Object.entries(eventTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-filter">User ID</Label>
                  <Input
                    id="user-filter"
                    value={securityLogFilters.user_id}
                    onChange={(e) => setSecurityLogFilters({...securityLogFilters, user_id: e.target.value})}
                    placeholder="Filter by user ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip-filter">IP Address</Label>
                  <Input
                    id="ip-filter"
                    value={securityLogFilters.ip_address}
                    onChange={(e) => setSecurityLogFilters({...securityLogFilters, ip_address: e.target.value})}
                    placeholder="Filter by IP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-date">From Date</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={securityLogFilters.from_date}
                    onChange={(e) => setSecurityLogFilters({...securityLogFilters, from_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-date">To Date</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={securityLogFilters.to_date}
                    onChange={(e) => setSecurityLogFilters({...securityLogFilters, to_date: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>Recent security events and login attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {securityLogsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : securityLogsData?.logs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No security logs found for the selected filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityLogsData?.logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge className={eventTypeColors[log.event_type as keyof typeof eventTypeColors] || 'bg-gray-100 text-gray-800'}>
                            {eventTypeLabels[log.event_type as keyof typeof eventTypeLabels] || log.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.username ? (
                            <div>
                              <div className="font-medium">{log.user_name}</div>
                              <div className="text-xs text-muted-foreground">@{log.username}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unknown User</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ip_address}
                        </TableCell>
                        <TableCell>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="text-xs">
                              {log.details.username && (
                                <div>User: {log.details.username}</div>
                              )}
                              {log.details.reason && (
                                <div>Reason: {log.details.reason}</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(log.created_at)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(log.created_at)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY STATS TAB */}
        <TabsContent value="stats" className="space-y-6">
          {securityStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Successful Logins (24h)</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{securityStats.successful_logins_24h}</div>
                  <p className="text-xs text-muted-foreground">
                    {securityStats.successful_logins_7d} in the last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Logins (24h)</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{securityStats.failed_logins_24h}</div>
                  <p className="text-xs text-muted-foreground">
                    {securityStats.failed_logins_7d} in the last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Users (24h)</CardTitle>
                  <Globe className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{securityStats.unique_users_24h}</div>
                  <p className="text-xs text-muted-foreground">
                    Active users today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Admin Actions (24h)</CardTitle>
                  <Shield className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{securityStats.admin_actions_24h}</div>
                  <p className="text-xs text-muted-foreground">
                    Administrative actions
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}