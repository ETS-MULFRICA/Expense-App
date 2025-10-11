import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Flag, AlertTriangle } from "lucide-react";

interface ReportContentProps {
  contentType: 'expense' | 'income' | 'budget' | 'announcement' | 'user_profile' | 'category';
  contentId: number;
  reportedUserId: number;
  trigger?: React.ReactNode;
  className?: string;
}

const reportReasons = [
  { value: 'spam', label: 'Spam', description: 'Repetitive or irrelevant content' },
  { value: 'inappropriate', label: 'Inappropriate Content', description: 'Content that violates community guidelines' },
  { value: 'harassment', label: 'Harassment', description: 'Bullying or threatening behavior' },
  { value: 'fraud', label: 'Fraud', description: 'Fraudulent or misleading information' },
  { value: 'offensive', label: 'Offensive', description: 'Offensive or discriminatory content' },
  { value: 'other', label: 'Other', description: 'Other violation not listed above' },
];

export function ReportContentButton({ 
  contentType, 
  contentId, 
  reportedUserId, 
  trigger,
  className = "" 
}: ReportContentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const reportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const response = await fetch("/api/moderation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit report");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Report Submitted", 
        description: "Thank you for your report. Our moderation team will review it shortly." 
      });
      setIsOpen(false);
      setReason("");
      setDescription("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleSubmitReport = () => {
    if (!reason) {
      toast({ 
        title: "Error", 
        description: "Please select a reason for reporting", 
        variant: "destructive" 
      });
      return;
    }

    const reportData = {
      content_type: contentType,
      content_id: contentId,
      reported_user_id: reportedUserId,
      reason,
      description: description.trim() || undefined,
    };

    reportMutation.mutate(reportData);
  };

  // Don't show report button if user is not logged in or trying to report their own content
  if (!user || user.id === reportedUserId) {
    return null;
  }

  const defaultTrigger = (
    <Button 
      variant="ghost" 
      size="sm" 
      className={`text-gray-500 hover:text-red-600 ${className}`}
    >
      <Flag className="h-4 w-4 mr-1" />
      Report
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
            Report Content
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe community by reporting inappropriate content. 
            All reports are reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="content-info">Content Being Reported</Label>
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm font-medium capitalize">
                {contentType.replace('_', ' ')} #{contentId}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                This content will be reviewed by our moderation team
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="reason">Reason for Report *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reportReasons.map((reasonOption) => (
                  <SelectItem key={reasonOption.value} value={reasonOption.value}>
                    <div>
                      <div className="font-medium">{reasonOption.label}</div>
                      <div className="text-xs text-gray-500">{reasonOption.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="description">Additional Details (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context that might help our moderation team understand the issue..."
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1">
              {description.length}/500 characters
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="flex items-start">
              <Flag className="h-4 w-4 text-blue-600 mt-0.5 mr-2" />
              <div className="text-sm text-blue-800">
                <div className="font-medium">Report Guidelines</div>
                <ul className="mt-1 text-xs space-y-1">
                  <li>• Reports are anonymous to the reported user</li>
                  <li>• False reports may result in action against your account</li>
                  <li>• Our team reviews all reports within 24-48 hours</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitReport}
            disabled={reportMutation.isPending || !reason}
            className="bg-red-600 hover:bg-red-700"
          >
            {reportMutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}