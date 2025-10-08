import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, UserCog, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface UserWithRoles {
  id: number;
  username: string;
  name: string;
  email: string;
  roles: Role[];
}

interface UserRoleManagerProps {
  user: {
    id: number;
    username: string;
    name: string;
    email: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function UserRoleManager({ user, isOpen, onClose }: UserRoleManagerProps) {
  const { toast } = useToast();
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  // Fetch all available roles
  const { data: allRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const response = await fetch("/api/admin/roles");
      if (!response.ok) {
        throw new Error("Failed to fetch roles");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch user's current roles
  const { data: userPermissions, isLoading: isLoadingUserRoles } = useQuery({
    queryKey: ["/api/admin/users", user.id, "permissions"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user.id}/permissions`);
      if (!response.ok) {
        throw new Error("Failed to fetch user roles");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Update selected roles when user permissions change
  useEffect(() => {
    if (userPermissions?.roles) {
      setSelectedRoleIds(userPermissions.roles.map((role: Role) => role.id));
    }
  }, [userPermissions]);

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const response = await fetch(`/api/admin/users/${user.id}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to assign role");
      }
      
      return response.json();
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const response = await fetch(`/api/admin/users/${user.id}/roles/${roleId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove role");
      }
      
      return response.json();
    },
  });

  const handleRoleToggle = async (roleId: number, checked: boolean) => {
    try {
      if (checked) {
        await assignRoleMutation.mutateAsync(roleId);
        setSelectedRoleIds(prev => [...prev, roleId]);
        toast({
          title: "Success",
          description: "Role assigned successfully",
        });
      } else {
        await removeRoleMutation.mutateAsync(roleId);
        setSelectedRoleIds(prev => prev.filter(id => id !== roleId));
        toast({
          title: "Success",
          description: "Role removed successfully",
        });
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", user.id, "permissions"] });
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setSelectedRoleIds([]);
    onClose();
  };

  const currentRoles = userPermissions?.roles || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserCog className="h-5 w-5 mr-2" />
            Manage Roles for {user.name}
          </DialogTitle>
          <DialogDescription>
            Assign or remove roles for {user.username} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Current Roles */}
          <div className="mb-6">
            <Label className="text-sm font-medium">Current Roles</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {currentRoles.length > 0 ? (
                currentRoles.map((role: Role) => (
                  <Badge 
                    key={role.id} 
                    variant={role.isSystem ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    {role.name}
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => handleRoleToggle(role.id, false)}
                        disabled={removeRoleMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-gray-500">No roles assigned</span>
              )}
            </div>
          </div>

          {/* Available Roles */}
          <div>
            <Label className="text-sm font-medium">Available Roles</Label>
            {isLoadingRoles || isLoadingUserRoles ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="mt-3 space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                {allRoles?.map((role: Role) => {
                  const isAssigned = selectedRoleIds.includes(role.id);
                  const isSystemRole = role.isSystem;
                  
                  return (
                    <div key={role.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={isAssigned}
                        onCheckedChange={(checked) => 
                          handleRoleToggle(role.id, checked as boolean)
                        }
                        disabled={assignRoleMutation.isPending || removeRoleMutation.isPending}
                      />
                      <Label 
                        htmlFor={`role-${role.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{role.name}</span>
                            {role.description && (
                              <span className="text-sm text-gray-500 ml-2">
                                {role.description}
                              </span>
                            )}
                          </div>
                          <Badge 
                            variant={isSystemRole ? "default" : "outline"}
                            className="ml-2"
                          >
                            {isSystemRole ? "System" : "Custom"}
                          </Badge>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}