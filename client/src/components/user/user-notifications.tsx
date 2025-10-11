import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  BellRing,
  CheckCircle, 
  Info, 
  AlertTriangle, 
  XCircle,
  Clock,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserNotification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  related_report_id?: number;
  read_at?: string;
  created_at: string;
}

interface NotificationsResponse {
  notifications: UserNotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export default function UserNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch user notifications
  const { data: notificationsData, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ["/api/user/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/user/notifications");
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/user/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
      toast({ title: "Success", description: "All notifications marked as read" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getNotificationIcon = (type: string, isRead: boolean) => {
    const iconClass = `h-5 w-5 ${isRead ? 'text-gray-400' : 'text-current'}`;
    
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-600`} />;
      default:
        return <Info className={`${iconClass} text-blue-600`} />;
    }
  };

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const unreadCount = notificationsData?.unreadCount || 0;
  const notifications = notificationsData?.notifications || [];

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                Mark All Read
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {unreadCount > 0 
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'You have no unread notifications'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-96 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No notifications</p>
              <p className="text-sm text-gray-500">We'll notify you when there are updates</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification, index) => {
                const isRead = !!notification.read_at;
                return (
                  <div key={notification.id}>
                    <Card 
                      className={`cursor-pointer transition-colors ${
                        !isRead ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (!isRead) {
                          markAsReadMutation.mutate(notification.id);
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {getNotificationIcon(notification.type, isRead)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className={`font-medium ${!isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <Badge className={getNotificationBadgeColor(notification.type)}>
                                  {notification.type}
                                </Badge>
                                {!isRead && (
                                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                )}
                              </div>
                            </div>
                            <p className={`text-sm mt-1 ${!isRead ? 'text-gray-700' : 'text-gray-600'}`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center mt-2 text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              {notification.related_report_id && (
                                <span className="ml-2">
                                  • Related to Report #{notification.related_report_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Compact bell icon component for header/navbar
export function NotificationBell() {
  const { user } = useAuth();
  
  const { data: notificationsData } = useQuery<NotificationsResponse>({
    queryKey: ["/api/user/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/user/notifications?unread_only=true&limit=1");
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute
  });

  const unreadCount = notificationsData?.unreadCount || 0;

  return (
    <UserNotifications />
  );
}