import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  MoreHorizontal,
  Shield,
  Flag,
  Eye,
  EyeOff,
  AlertTriangle,
  UserX,
  MessageSquareWarning,
  RefreshCw,
  Filter,
  Search,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";

interface ContentReport {
  id: number;
  content_type: string;
  content_id: number;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  reporter_username: string;
  reporter_name: string;
  reported_username: string;
  reported_name: string;
  reported_user_id: number;
  reported_user_email: string;
  previous_reports: number;
  is_hidden: boolean;
  has_active_warnings: boolean;
}

interface ModerationStats {
  pending_reports: number;
  reviewing_reports: number;
  reports_today: number;
  reports_this_week: number;
  hidden_content: number;
  active_warnings: number;
  active_suspensions: number;
  flagged_users_this_month: number;
}

interface ModerationTemplate {
  id: number;
  template_type: string;
  category: string;
  title: string;
  content: string;
}

export default function ModerationManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [statusFilter, setStatusFilter] = useState("pending");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionReason, setActionReason] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [userFeedback, setUserFeedback] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);

  // Fetch moderation queue
  const { data: reportsData, isLoading: isLoadingReports, refetch: refetchReports } = useQuery({
    queryKey: ["/api/admin/moderation/queue", statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append("status", statusFilter);
      if (priorityFilter !== 'all') params.append("priority", priorityFilter);
      
      const response = await fetch(`/api/admin/moderation/queue?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch moderation queue");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Fetch moderation statistics
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/moderation/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/moderation/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch moderation stats");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Fetch moderation templates
  const { data: templates } = useQuery({
    queryKey: ["/api/admin/moderation/templates"],
    queryFn: async () => {
      const response = await fetch("/api/admin/moderation/templates");
      if (!response.ok) {
        throw new Error("Failed to fetch moderation templates");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Pagination
  const {
    items: paginatedReports,
    pagination,
    setPage,
    setPageSize,
  } = usePagination<ContentReport>(reportsData?.reports || [], 10);

  // Take moderation action mutation
  const takeActionMutation = useMutation({
    mutationFn: async (actionData: any) => {
      const response = await fetch("/api/admin/moderation/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to take moderation action");
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchReports();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/stats"] });
      toast({ title: "Success", description: "Moderation action completed successfully" });
      setIsActionDialogOpen(false);
      setIsResolveDialogOpen(false);
      setSelectedReport(null);
      setActionType("");
      setActionReason("");
      setActionDetails("");
      setUserFeedback("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleTakeAction = () => {
    if (!selectedReport || !actionType || !actionReason) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const actionData = {
      report_id: selectedReport.id,
      action_type: actionType,
      reason: actionReason,
      details: actionDetails,
      user_feedback: userFeedback,
      content_type: selectedReport.content_type,
      content_id: selectedReport.content_id,
      target_user_id: selectedReport.reported_user_id,
    };

    takeActionMutation.mutate(actionData);
  };

  const handleActionClick = (report: ContentReport, action: string) => {
    setSelectedReport(report);
    setActionType(action);
    setActionReason("");
    setActionDetails("");
    setUserFeedback("");
    setSelectedTemplate("");
    setIsActionDialogOpen(true);
  };

  const handleResolveWithFeedback = (report: ContentReport) => {
    setSelectedReport(report);
    setActionType("resolve");
    setActionReason("Report resolved");
    setActionDetails("");
    setUserFeedback("");
    setIsResolveDialogOpen(true);
  };

  const handleResolveSubmit = () => {
    if (!selectedReport) {
      toast({ title: "Error", description: "No report selected", variant: "destructive" });
      return;
    }

    const actionData = {
      report_id: selectedReport.id,
      action_type: "resolve",
      reason: actionReason || "Report resolved",
      details: actionDetails,
      user_feedback: userFeedback,
      content_type: selectedReport.content_type,
      content_id: selectedReport.content_id,
      target_user_id: selectedReport.reported_user_id,
    };

    takeActionMutation.mutate(actionData);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t: ModerationTemplate) => t.id.toString() === templateId);
    if (template) {
      setActionReason(template.title);
      setActionDetails(template.content);
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewing': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'hide_content': return <EyeOff className="h-4 w-4" />;
      case 'warn_user': return <MessageSquareWarning className="h-4 w-4" />;
      case 'suspend_user': return <UserX className="h-4 w-4" />;
      case 'dismiss': return <XCircle className="h-4 w-4" />;
      case 'restore_content': return <Eye className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="text-gray-500">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Moderation & Reports
              </CardTitle>
              <CardDescription>
                Manage flagged content and user reports
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => refetchReports()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                  <p className="text-2xl font-bold">{stats.pending_reports}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Flag className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Reports Today</p>
                  <p className="text-2xl font-bold">{stats.reports_today}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <EyeOff className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Hidden Content</p>
                  <p className="text-2xl font-bold">{stats.hidden_content}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Warnings</p>
                  <p className="text-2xl font-bold">{stats.active_warnings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Moderation Queue</CardTitle>
          <CardDescription>
            Review and take action on reported content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReports ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Reported User</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReports && paginatedReports.length > 0 ? (
                    paginatedReports.map((report: ContentReport) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="font-medium">{report.reporter_name}</div>
                          <div className="text-sm text-gray-500">@{report.reporter_username}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{report.reported_name}</div>
                          <div className="text-sm text-gray-500">
                            @{report.reported_username}
                            {report.previous_reports > 0 && (
                              <span className="ml-2 text-red-600">
                                ({report.previous_reports} prev reports)
                              </span>
                            )}
                          </div>
                          {report.has_active_warnings && (
                            <Badge variant="outline" className="text-xs mt-1 bg-yellow-50">
                              Has Warnings
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              {report.content_type} #{report.content_id}
                            </Badge>
                            {report.is_hidden && (
                              <Badge className="bg-red-100 text-red-800">
                                Hidden
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{report.reason}</div>
                          {report.description && (
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {report.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityBadgeColor(report.priority)}>
                            {report.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(report.status)}>
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(report.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResolveWithFeedback(report)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Resolve with Feedback
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!report.is_hidden && (
                                <DropdownMenuItem onClick={() => handleActionClick(report, 'hide_content')}>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Hide Content
                                </DropdownMenuItem>
                              )}
                              {report.is_hidden && (
                                <DropdownMenuItem onClick={() => handleActionClick(report, 'restore_content')}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Restore Content
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleActionClick(report, 'warn_user')}>
                                <MessageSquareWarning className="h-4 w-4 mr-2" />
                                Warn User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleActionClick(report, 'suspend_user')}>
                                <UserX className="h-4 w-4 mr-2" />
                                Suspend User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleActionClick(report, 'dismiss')}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Dismiss Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4 text-gray-500">
                        No reports found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {reportsData?.reports && reportsData.reports.length > 0 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    total={pagination.total}
                    startIndex={pagination.startIndex}
                    endIndex={pagination.endIndex}
                    hasNextPage={pagination.hasNextPage}
                    hasPreviousPage={pagination.hasPreviousPage}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Moderation Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {getActionIcon(actionType)}
              <span className="ml-2">
                {actionType === 'hide_content' && 'Hide Content'}
                {actionType === 'warn_user' && 'Warn User'}
                {actionType === 'suspend_user' && 'Suspend User'}
                {actionType === 'dismiss' && 'Dismiss Report'}
                {actionType === 'restore_content' && 'Restore Content'}
              </span>
            </DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <>
                  Taking action on {selectedReport.content_type} reported by {selectedReport.reporter_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {templates && templates.length > 0 && (
              <div>
                <Label htmlFor="template">Use Template (Optional)</Label>
                <Select value={selectedTemplate} onValueChange={(value) => {
                  setSelectedTemplate(value);
                  handleTemplateSelect(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template: ModerationTemplate) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Input
                id="reason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason for this action"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="details">Additional Details</Label>
              <Textarea
                id="details"
                value={actionDetails}
                onChange={(e) => setActionDetails(e.target.value)}
                placeholder="Add any additional details or context"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleTakeAction}
              disabled={takeActionMutation.isPending || !actionReason}
            >
              {takeActionMutation.isPending ? "Processing..." : "Take Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve with Feedback Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Resolve Report with Feedback
            </DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <>
                  Resolving report about {selectedReport.content_type} by {selectedReport.reported_name}.
                  You can optionally send feedback to the reporter.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="resolveReason">Resolution Summary</Label>
              <Input
                id="resolveReason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Brief summary of resolution"
                defaultValue="Report resolved"
              />
            </div>
            
            <div>
              <Label htmlFor="userFeedback">
                Message to Reporter (Optional)
                <span className="text-sm text-gray-500 ml-2">
                  This message will be sent to the user who reported the content
                </span>
              </Label>
              <Textarea
                id="userFeedback"
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                placeholder="Thank you for your report. After review, we have determined..."
                rows={4}
                className="resize-none"
              />
              <div className="text-xs text-gray-500 mt-1">
                {userFeedback.length}/500 characters
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What happens when you resolve:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Report will be marked as resolved and archived</li>
                <li>• Reporter will receive a notification</li>
                <li>• If feedback is provided, it will be included in the notification</li>
                <li>• Report can be viewed in resolved reports history</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolveSubmit}
              disabled={takeActionMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {takeActionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}