import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, User, FileText, DollarSign, Settings, BarChart3, Eye } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityLog {
  id: number;
  actionType: string;
  resourceType: string;
  resourceId?: number;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: string;
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export default function HistoryPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);

  const { data, isLoading, error } = useQuery<ActivityLogsResponse>({
    queryKey: ["/api/activity-logs", currentPage, limit],
    queryFn: async () => {
      const response = await fetch(`/api/activity-logs?page=${currentPage}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }
      return response.json();
    },
  });

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'CREATE': return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'LOGOUT': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'VIEW': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getResourceTypeIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'EXPENSE': return <DollarSign className="h-4 w-4 text-red-600" />;
      case 'INCOME': return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'BUDGET': return <BarChart3 className="h-4 w-4 text-blue-600" />;
      case 'CATEGORY': return <FileText className="h-4 w-4 text-orange-600" />;
      case 'USER': return <User className="h-4 w-4 text-purple-600" />;
      case 'REPORT': return <BarChart3 className="h-4 w-4 text-indigo-600" />;
      case 'SETTINGS': return <Settings className="h-4 w-4 text-gray-600" />;
      default: return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatUserAgent = (userAgent?: string) => {
    if (!userAgent) return 'Unknown device';
    
    // Simple parsing - you could use a library like ua-parser-js for more detailed parsing
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    return 'Unknown Browser';
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;
    
    // Handle different types of metadata
    if (metadata.expense) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Amount:</span> {metadata.expense.amount}</div>
          <div><span className="font-medium">Category:</span> {metadata.expense.category}</div>
          <div><span className="font-medium">Description:</span> {metadata.expense.description}</div>
        </div>
      );
    }
    
    if (metadata.income) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Amount:</span> {metadata.income.amount}</div>
          <div><span className="font-medium">Category:</span> {metadata.income.category}</div>
          <div><span className="font-medium">Description:</span> {metadata.income.description}</div>
        </div>
      );
    }
    
    if (metadata.budget) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Budget Name:</span> {metadata.budget.name}</div>
          <div><span className="font-medium">Total Amount:</span> {metadata.budget.totalAmount}</div>
        </div>
      );
    }
    
    if (metadata.category) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Category Name:</span> {metadata.category.name}</div>
          <div><span className="font-medium">Type:</span> {metadata.category.type}</div>
        </div>
      );
    }
    
    // If it's an object but not one of the known types, show key-value pairs
    if (typeof metadata === 'object') {
      return (
        <div className="space-y-1">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>{' '}
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback to string representation
    return <div>{String(metadata)}</div>;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
          </div>
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading activity history...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
          </div>
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <p className="text-red-600 mb-4">Failed to load activity history</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const { logs = [], pagination } = data || { logs: [], pagination: { page: 1, totalPages: 1, totalCount: 0, limit: 20 } };

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
              <p className="text-gray-600">Track all actions and changes in your account</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {pagination.totalCount} total activities
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No activity history found</p>
                <p className="text-sm text-gray-400">Your actions will appear here</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getResourceTypeIcon(log.resourceType)}
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            className={`${getActionTypeColor(log.actionType)} text-xs font-medium`}
                            variant="outline"
                          >
                            {log.actionType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {log.resourceType}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {format(new Date(log.createdAt), 'MMM dd, yyyy • HH:mm')}
                          </span>
                        </div>
                        
                        <p className="text-gray-900 mb-2">{log.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {log.ipAddress && (
                            <span>IP: {log.ipAddress}</span>
                          )}
                          <span>{formatUserAgent(log.userAgent)}</span>
                        </div>
                        
                        {log.metadata && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View details
                            </summary>
                            <div className="mt-2 text-sm bg-gray-50 p-3 rounded border">
                              {formatMetadata(log.metadata)}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}