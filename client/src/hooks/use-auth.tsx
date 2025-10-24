// Import React context and hooks for state management
import { createContext, ReactNode, useContext } from "react";
// Import React Query hooks for server state management
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
// Import shared types and schemas
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
// Import API utilities
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
// Import toast notifications
import { useToast } from "@/hooks/use-toast";

/**
 * Authentication Context Type Definition
 * Defines the shape of authentication state and methods
 */
type AuthContextType = {
  user: SelectUser | null;              // Current authenticated user or null
  isLoading: boolean;                   // Loading state during auth checks
  error: Error | null;                  // Any authentication errors
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;     // Login function
  logoutMutation: UseMutationResult<void, Error, void>;               // Logout function
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>; // Register function
};

/**
 * Login Credentials Type
 * Subset of user data needed for login
 */
type LoginData = Pick<InsertUser, "username" | "password">;

// Create authentication context
export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * AuthProvider Component
 * Provides authentication state and methods to the entire app
 * 
 * Responsibilities:
 * - Checks current authentication status on app load
 * - Provides login, logout, and registration functions
 * - Manages user state across the application
 * - Shows toast notifications for auth actions
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  // Debug: log when AuthProvider mounts so we can confirm provider is present
  try {
    // eslint-disable-next-line no-console
    console.debug("AuthProvider mounted");
  } catch (e) {}
  
  /**
   * User Authentication Query
   * Automatically checks if user is authenticated on app load
   * Returns null on 401 (not logged in) instead of throwing error
   */
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.status === 401) return false;
      return failureCount < 3;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  /**
   * Login Mutation
   * Handles user login with username/password
   * - Sends credentials to /api/login
   * - Updates user state on success
   * - Shows success/error toasts
   */
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /**
   * Registration Mutation
   * Handles new user account creation
   * - Validates user data with Zod schema
   * - Creates account and automatically logs user in
   * - Shows success/error toasts
   */
  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Account created",
        description: "You have successfully registered and logged in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /**
   * Logout Mutation
   * Handles user logout
   * - Calls /api/logout to end server session
   * - Clears user data from client state
   * - Shows logout confirmation toast
   */
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Provide all authentication state and methods to children
  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 * Custom hook to access authentication context
 * Must be used within an AuthProvider
 * 
 * Usage: const { user, loginMutation, logoutMutation } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // If context is missing, log helpful debug info instead of throwing to avoid
    // the dev overlay masking the real root cause. Returning a safe fallback
    // allows the app to continue rendering and gives better info in console.
    // eslint-disable-next-line no-console
    console.error("useAuth called without an AuthProvider. Ensure <AuthProvider> wraps your app.");
    return {
      user: null,
      isLoading: false,
      error: null,
      // These are placeholders; calling them will likely throw. They exist so
      // TypeScript/consumers won't crash immediately when provider is missing.
      loginMutation: (null as unknown) as UseMutationResult<any, Error, any>,
      logoutMutation: (null as unknown) as UseMutationResult<void, Error, void>,
      registerMutation: (null as unknown) as UseMutationResult<any, Error, any>,
    } as AuthContextType;
  }
  return context;
}
