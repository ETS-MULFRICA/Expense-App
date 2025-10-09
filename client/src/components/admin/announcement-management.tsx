import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, BarChart3, Users, MessageSquare, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Announcement {
  id: number;
  title: string;
  content: string;
  announcementType: string;
  priority: string;
  createdBy: number;
  creatorName: string;
  creatorUsername: string;
  targetAudience: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalInteractions: number;
  totalViews: number;
  totalReads: number;
  totalDismissals: number;
  viewRate: number;
  readRate: number;
  dismissRate: number;
}

interface AnnouncementStats {
  totalUsers: number;
  totalViewed: number;
  totalRead: number;
  totalDismissed: number;
  viewRate: number;
  readRate: number;
  dismissRate: number;
}

interface CreateAnnouncementData {
  title: string;
  content: string;
  announcementType: string;
  priority: string;
  targetAudience: string;
  expiresAt: string | null;
}

const ANNOUNCEMENT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'update', label: 'System Update' },
  { value: 'welcome', label: 'Welcome Message' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const TARGET_AUDIENCES = [
  { value: 'all', label: 'All Users' },
  { value: 'new_users', label: 'New Users' },
  { value: 'active_users', label: 'Active Users' },
  { value: 'specific_roles', label: 'Specific Roles' },
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'normal': return 'bg-blue-500';
    case 'low': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'maintenance': return 'bg-yellow-100 text-yellow-800';
    case 'update': return 'bg-blue-100 text-blue-800';
    case 'welcome': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function AnnouncementManagement() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [selectedStats, setSelectedStats] = useState<AnnouncementStats | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch all announcements
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements'],
    queryFn: async () => {
      const response = await fetch('/api/announcements');
      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }
      return response.json();
    },
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateAnnouncementData) => {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create announcement');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Announcement created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update announcement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateAnnouncementData> }) => {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update announcement');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsEditDialogOpen(false);
      setSelectedAnnouncement(null);
      toast({
        title: "Success",
        description: "Announcement updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete announcement');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch announcement stats
  const fetchStats = async (announcementId: number) => {
    const response = await fetch(`/api/announcements/${announcementId}/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch announcement stats');
    }
    return response.json();
  };

  const handleViewStats = async (announcement: Announcement) => {
    try {
      const stats = await fetchStats(announcement.id);
      setSelectedStats(stats);
      setSelectedAnnouncement(announcement);
      setIsStatsDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load announcement statistics",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (announcement: Announcement) => {
    if (window.confirm(`Are you sure you want to delete "${announcement.title}"?`)) {
      deleteMutation.mutate(announcement.id);
    }
  };

  const activeAnnouncements = announcements.filter(a => a.isActive);
  const inactiveAnnouncements = announcements.filter(a => !a.isActive);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Announcement Management</h1>
          <p className="text-gray-600 mt-2">Create and manage system announcements for all users</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Announcements</p>
                <p className="text-2xl font-bold text-gray-900">{announcements.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeAnnouncements.length}</p>
              </div>
              <Eye className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Urgent Priority</p>
                <p className="text-2xl font-bold text-red-600">
                  {announcements.filter(a => a.priority === 'urgent').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. View Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {announcements.length > 0 
                    ? `${(announcements.reduce((acc, a) => acc + a.viewRate, 0) / announcements.length).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Announcements ({activeAnnouncements.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveAnnouncements.length})</TabsTrigger>
          <TabsTrigger value="all">All Announcements ({announcements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <AnnouncementsList 
            announcements={activeAnnouncements}
            onEdit={(announcement) => {
              setSelectedAnnouncement(announcement);
              setIsEditDialogOpen(true);
            }}
            onDelete={handleDelete}
            onViewStats={handleViewStats}
          />
        </TabsContent>

        <TabsContent value="inactive">
          <AnnouncementsList 
            announcements={inactiveAnnouncements}
            onEdit={(announcement) => {
              setSelectedAnnouncement(announcement);
              setIsEditDialogOpen(true);
            }}
            onDelete={handleDelete}
            onViewStats={handleViewStats}
          />
        </TabsContent>

        <TabsContent value="all">
          <AnnouncementsList 
            announcements={announcements}
            onEdit={(announcement) => {
              setSelectedAnnouncement(announcement);
              setIsEditDialogOpen(true);
            }}
            onDelete={handleDelete}
            onViewStats={handleViewStats}
          />
        </TabsContent>
      </Tabs>

      {/* Create Announcement Dialog */}
      <CreateAnnouncementDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Announcement Dialog */}
      {selectedAnnouncement && (
        <EditAnnouncementDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedAnnouncement(null);
          }}
          announcement={selectedAnnouncement}
          onSubmit={(data) => updateMutation.mutate({ id: selectedAnnouncement.id, data })}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Stats Dialog */}
      {selectedAnnouncement && selectedStats && (
        <StatsDialog
          isOpen={isStatsDialogOpen}
          onClose={() => {
            setIsStatsDialogOpen(false);
            setSelectedAnnouncement(null);
            setSelectedStats(null);
          }}
          announcement={selectedAnnouncement}
          stats={selectedStats}
        />
      )}
    </div>
  );
}

// Announcements List Component
function AnnouncementsList({ 
  announcements, 
  onEdit, 
  onDelete, 
  onViewStats 
}: {
  announcements: Announcement[];
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcement: Announcement) => void;
  onViewStats: (announcement: Announcement) => void;
}) {
  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No announcements found</h3>
          <p className="text-gray-600">Create your first announcement to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {announcements.map((announcement) => (
        <Card key={announcement.id} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                  <Badge className={getTypeColor(announcement.announcementType)}>
                    {announcement.announcementType}
                  </Badge>
                  <div className={`w-3 h-3 rounded-full ${getPriorityColor(announcement.priority)}`} 
                       title={`${announcement.priority} priority`} />
                  {!announcement.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-2">{announcement.content}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {announcement.targetAudience.replace('_', ' ')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {announcement.viewRate.toFixed(1)}% viewed
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {format(new Date(announcement.createdAt), 'MMM d, yyyy')}
                  </span>
                  {announcement.expiresAt && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      Expires {format(new Date(announcement.expiresAt), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewStats(announcement)}
                  className="flex items-center gap-1"
                >
                  <BarChart3 className="h-4 w-4" />
                  Stats
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(announcement)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(announcement)}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Create Announcement Dialog
function CreateAnnouncementDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAnnouncementData) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateAnnouncementData>({
    title: '',
    content: '',
    announcementType: 'general',
    priority: 'normal',
    targetAudience: 'all',
    expiresAt: null,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      announcementType: 'general',
      priority: 'normal',
      targetAudience: 'all',
      expiresAt: null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetForm();
      }
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Announcement</DialogTitle>
          <DialogDescription>
            Create a new announcement that will be visible to users on their dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter announcement title"
              required
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter announcement content"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.announcementType}
                onValueChange={(value) => setFormData({ ...formData, announcementType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="audience">Target Audience</Label>
            <Select
              value={formData.targetAudience}
              onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCES.map((audience) => (
                  <SelectItem key={audience.value} value={audience.value}>
                    {audience.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="expires">Expiration Date (Optional)</Label>
            <Input
              id="expires"
              type="datetime-local"
              value={formData.expiresAt || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                expiresAt: e.target.value || null 
              })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Announcement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Announcement Dialog
function EditAnnouncementDialog({
  isOpen,
  onClose,
  announcement,
  onSubmit,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  announcement: Announcement;
  onSubmit: (data: Partial<CreateAnnouncementData> & { isActive?: boolean }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: announcement.title,
    content: announcement.content,
    announcementType: announcement.announcementType,
    priority: announcement.priority,
    targetAudience: announcement.targetAudience,
    isActive: announcement.isActive,
    expiresAt: announcement.expiresAt ? 
      new Date(announcement.expiresAt).toISOString().slice(0, 16) : null,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Announcement</DialogTitle>
          <DialogDescription>
            Update the announcement details and settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.announcementType}
                onValueChange={(value) => setFormData({ ...formData, announcementType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="audience">Target Audience</Label>
            <Select
              value={formData.targetAudience}
              onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCES.map((audience) => (
                  <SelectItem key={audience.value} value={audience.value}>
                    {audience.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="expires">Expiration Date (Optional)</Label>
            <Input
              id="expires"
              type="datetime-local"
              value={formData.expiresAt || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                expiresAt: e.target.value || null 
              })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="isActive">Active (visible to users)</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Announcement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Stats Dialog
function StatsDialog({
  isOpen,
  onClose,
  announcement,
  stats
}: {
  isOpen: boolean;
  onClose: () => void;
  announcement: Announcement;
  stats: AnnouncementStats;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Announcement Analytics</DialogTitle>
          <DialogDescription>
            Detailed engagement statistics for "{announcement.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
                <p className="text-sm text-gray-600">Total Users</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.totalViewed}</p>
                <p className="text-sm text-gray-600">Users Viewed</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.totalRead}</p>
                <p className="text-sm text-gray-600">Users Read</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.totalDismissed}</p>
                <p className="text-sm text-gray-600">Users Dismissed</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>View Rate</span>
                <span>{stats.viewRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(stats.viewRate, 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Read Rate</span>
                <span>{stats.readRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(stats.readRate, 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Dismiss Rate</span>
                <span>{stats.dismissRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(stats.dismissRate, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Created:</strong> {format(new Date(announcement.createdAt), 'PPpp')}</p>
            <p><strong>Last Updated:</strong> {format(new Date(announcement.updatedAt), 'PPpp')}</p>
            {announcement.expiresAt && (
              <p><strong>Expires:</strong> {format(new Date(announcement.expiresAt), 'PPpp')}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}