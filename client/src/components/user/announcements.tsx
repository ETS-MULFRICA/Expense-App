import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Bell, 
  X, 
  Eye, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Settings, 
  MessageSquare,
  Clock,
  User
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ReportContentButton } from "@/components/ui/report-content-button";

interface UserAnnouncementFeed {
  id: number;
  title: string;
  content: string;
  announcementType: string;
  priority: string;
  createdBy: number;
  creatorName: string;
  createdAt: string;
  expiresAt: string | null;
  viewedAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  isNew: boolean;
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'normal': return <Info className="h-4 w-4 text-blue-500" />;
    case 'low': return <Info className="h-4 w-4 text-gray-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'border-l-red-500 bg-red-50';
    case 'high': return 'border-l-orange-500 bg-orange-50';
    case 'normal': return 'border-l-blue-500 bg-blue-50';
    case 'low': return 'border-l-gray-500 bg-gray-50';
    default: return 'border-l-blue-500 bg-blue-50';
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

export default function UserAnnouncements() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<UserAnnouncementFeed | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch user's announcement feed
  const { data: announcements = [], isLoading } = useQuery<UserAnnouncementFeed[]>({
    queryKey: ['/api/announcements/user/feed'],
    queryFn: async () => {
      const response = await fetch('/api/announcements/user/feed');
      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark as viewed mutation
  const markViewedMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      const response = await fetch(`/api/announcements/user/${announcementId}/view`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark announcement as viewed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/user/feed'] });
    },
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      const response = await fetch(`/api/announcements/user/${announcementId}/read`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark announcement as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/user/feed'] });
    },
  });

  // Dismiss announcement mutation
  const dismissMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      const response = await fetch(`/api/announcements/user/${announcementId}/dismiss`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to dismiss announcement');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/user/feed'] });
      toast({
        title: "Success",
        description: "Announcement dismissed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss announcement",
        variant: "destructive",
      });
    },
  });

  // Auto-mark as viewed when announcements are loaded
  useEffect(() => {
    const newAnnouncements = announcements.filter(a => a.isNew);
    newAnnouncements.forEach(announcement => {
      markViewedMutation.mutate(announcement.id);
    });
  }, [announcements]);

  const handleOpenDetail = (announcement: UserAnnouncementFeed) => {
    setSelectedAnnouncement(announcement);
    setIsDetailDialogOpen(true);
    
    // Mark as read when opened
    if (!announcement.readAt) {
      markReadMutation.mutate(announcement.id);
    }
  };

  const handleDismiss = (announcement: UserAnnouncementFeed) => {
    dismissMutation.mutate(announcement.id);
  };

  const newAnnouncements = announcements.filter(a => a.isNew);
  const readAnnouncements = announcements.filter(a => a.readAt && !a.isNew);
  const unreadAnnouncements = announcements.filter(a => !a.readAt && !a.isNew);

  const displayedAnnouncements = showAll ? announcements : announcements.slice(0, 3);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (announcements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Announcements
          </CardTitle>
          <CardDescription>Stay updated with the latest news and information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No announcements at this time</p>
            <p className="text-sm text-gray-500">We'll notify you when there are updates</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Announcement Feed Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Announcements</CardTitle>
              {newAnnouncements.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {newAnnouncements.length} new
                </Badge>
              )}
            </div>
            {announcements.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `View All (${announcements.length})`}
              </Button>
            )}
          </div>
          <CardDescription>
            Stay updated with the latest news and information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayedAnnouncements.map((announcement) => (
              <AnnouncementItem
                key={announcement.id}
                announcement={announcement}
                onOpenDetail={() => handleOpenDetail(announcement)}
                onDismiss={() => handleDismiss(announcement)}
                isLoading={dismissMutation.isPending}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {announcements.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{newAnnouncements.length}</div>
              <div className="text-sm text-gray-600">New</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{unreadAnnouncements.length}</div>
              <div className="text-sm text-gray-600">Unread</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{readAnnouncements.length}</div>
              <div className="text-sm text-gray-600">Read</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Announcement Detail Dialog */}
      {selectedAnnouncement && (
        <AnnouncementDetailDialog
          isOpen={isDetailDialogOpen}
          onClose={() => {
            setIsDetailDialogOpen(false);
            setSelectedAnnouncement(null);
          }}
          announcement={selectedAnnouncement}
          onDismiss={() => handleDismiss(selectedAnnouncement)}
          isLoading={dismissMutation.isPending}
        />
      )}
    </div>
  );
}

// Individual Announcement Item Component
function AnnouncementItem({
  announcement,
  onOpenDetail,
  onDismiss,
  isLoading
}: {
  announcement: UserAnnouncementFeed;
  onOpenDetail: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  const isUrgent = announcement.priority === 'urgent';
  const isNew = announcement.isNew;
  const isRead = !!announcement.readAt;

  return (
    <Alert className={`${getPriorityColor(announcement.priority)} border-l-4 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between w-full">
        {/* Main clickable content area */}
        <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={onOpenDetail}>
          {getPriorityIcon(announcement.priority)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold ${isNew ? 'text-gray-900' : 'text-gray-700'} truncate`}>
                {announcement.title}
              </h4>
              <Badge className={getTypeColor(announcement.announcementType)}>
                {announcement.announcementType}
              </Badge>
              {isNew && (
                <Badge variant="destructive">
                  NEW
                </Badge>
              )}
              {isRead && (
                <div title="Read">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            
            <AlertDescription className={`${isNew ? 'text-gray-700' : 'text-gray-600'} line-clamp-2`}>
              {announcement.content}
            </AlertDescription>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {announcement.creatorName}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
              </span>
              {announcement.expiresAt && (
                <span className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  Expires {format(new Date(announcement.expiresAt), 'MMM d')}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Action buttons area (not clickable for detail view) */}
        <div className="flex items-center gap-1 ml-3">
          <ReportContentButton
            contentType="announcement"
            contentId={announcement.id}
            reportedUserId={announcement.createdBy}
            className="text-gray-500 hover:text-red-600"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            disabled={isLoading}
            className="hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}

// Announcement Detail Dialog
function AnnouncementDetailDialog({
  isOpen,
  onClose,
  announcement,
  onDismiss,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  announcement: UserAnnouncementFeed;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getPriorityIcon(announcement.priority)}
            <DialogTitle className="flex-1">{announcement.title}</DialogTitle>
            <Badge className={getTypeColor(announcement.announcementType)}>
              {announcement.announcementType}
            </Badge>
          </div>
          <DialogDescription className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              By {announcement.creatorName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(announcement.createdAt), 'PPpp')}
            </span>
            {announcement.expiresAt && (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                Expires {format(new Date(announcement.expiresAt), 'PPpp')}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-700">
              {announcement.content}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {announcement.viewedAt && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Viewed {formatDistanceToNow(new Date(announcement.viewedAt), { addSuffix: true })}
              </span>
            )}
            {announcement.readAt && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Read {formatDistanceToNow(new Date(announcement.readAt), { addSuffix: true })}
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onDismiss}
              disabled={isLoading}
            >
              {isLoading ? 'Dismissing...' : 'Dismiss'}
            </Button>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact Notification Bell Component (for header/navbar)
export function AnnouncementBell() {
  const { data: announcements = [] } = useQuery<UserAnnouncementFeed[]>({
    queryKey: ['/api/announcements/user/feed'],
    queryFn: async () => {
      const response = await fetch('/api/announcements/user/feed');
      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const newCount = announcements.filter(a => a.isNew).length;
  const unreadCount = announcements.filter(a => !a.readAt && !a.isNew).length;
  const totalCount = newCount + unreadCount;

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="relative">
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}