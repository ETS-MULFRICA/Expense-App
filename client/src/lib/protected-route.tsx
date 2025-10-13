// Import authentication hook and loading spinner
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useQuery } from "@tanstack/react-query";

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication and optionally specific roles or permissions
 * 
 * @param path - The URL path to protect
 * @param component - The React component to render if authorized
 * @param requiredRole - Optional role requirement (e.g., "admin") - DEPRECATED, use requiredPermission
 * @param requiredPermission - Optional permission requirement (e.g., "admin:dashboard")
 * 
 * Authentication Flow:
 * 1. Shows loading spinner while checking auth status
 * 2. Redirects to /auth if user not logged in
 * 3. Redirects to home if user lacks required role/permission
 * 4. Renders component if all checks pass
 */
export function ProtectedRoute({
  path,
  component: Component,
  requiredRole,
  requiredPermission,
}: {
  path: string;
  component: () => React.JSX.Element;
  requiredRole?: string;
  requiredPermission?: string;
}) {
  const { user, isLoading } = useAuth();

  // Check for permission if requiredPermission is specified
  const { data: hasPermission, isLoading: isCheckingPermission } = useQuery({
    queryKey: ["userPermissions", user?.id, requiredPermission],
    queryFn: async () => {
      if (!requiredPermission || !user) return true;
      
      const response = await fetch('/api/user/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: requiredPermission }),
        credentials: "include",
      });
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.hasPermission;
    },
    enabled: !!requiredPermission && !!user,
  });

  /**
   * Loading State Handler
   * Shows spinner while authentication status is being determined
   */
  if (isLoading || (requiredPermission && isCheckingPermission)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  /**
   * Authentication Check
   * Redirects unauthenticated users to login page
   */
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  /**
   * Hybrid Authorization Check
   * Supports both role-based and permission-based access control
   * 
   * Access granted if:
   * - No role/permission required (basic auth only)
   * - User has required role AND no permission specified
   * - User has required permission (regardless of role)
   * - User has admin role (always has access)
   */
  const hasRoleAccess = !requiredRole || user.role === requiredRole || user.role === 'admin';
  const hasPermissionAccess = !requiredPermission || hasPermission === true || user.role === 'admin';
  
  // For hybrid control: need EITHER role access OR permission access
  const hasAccess = requiredRole && requiredPermission 
    ? (hasRoleAccess || hasPermissionAccess)  // Either role OR permission is sufficient
    : (hasRoleAccess && hasPermissionAccess); // Both must be satisfied if both are specified

  if (!hasAccess) {
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  /**
   * Authorized Access
   * User is authenticated and has required role (if any)
   */
  return <Route path={path} component={Component} />;
}
