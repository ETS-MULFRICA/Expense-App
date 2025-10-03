import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";

// Hidden Categories Manager Component
interface HiddenCategory {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryType: string;
  hiddenAt: string;
}

function HiddenCategoriesManager() {
  const { toast } = useToast();

  // Fetch hidden categories
  const { data: hiddenCategories = [], isLoading, error } = useQuery<HiddenCategory[]>({
    queryKey: ["/api/hidden-categories"],
    queryFn: async () => {
      const response = await fetch("/api/hidden-categories");
      if (!response.ok) {
        throw new Error("Failed to fetch hidden categories");
      }
      const data = await response.json();
      // Sort by hiddenAt date (newest first) and ensure unique entries
      const uniqueData = data.filter((item: any, index: number, arr: any[]) => 
        arr.findIndex(x => x.categoryId === item.categoryId && x.categoryType === item.categoryType) === index
      );
      return uniqueData.sort((a: any, b: any) => new Date(b.hiddenAt).getTime() - new Date(a.hiddenAt).getTime());
    },
  });

  // Restore category mutation
  const restoreCategoryMutation = useMutation({
    mutationFn: async (data: { categoryId: number; categoryType: string }) => {
      const response = await fetch(`/api/hidden-categories/${data.categoryId}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ categoryType: data.categoryType }),
      });
      if (!response.ok) {
        throw new Error("Failed to restore category");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hidden-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({
        title: "Category restored",
        description: data.message || "The category has been restored to your view.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to restore category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRestoreCategory = (categoryId: number, categoryType: string, categoryName: string) => {
    if (window.confirm(`Are you sure you want to restore "${categoryName}" category?`)) {
      restoreCategoryMutation.mutate({ categoryId, categoryType });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading hidden categories...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading hidden categories: {error.message}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.location.reload()} 
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (hiddenCategories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hidden categories found.</p>
        <p className="text-sm text-gray-400 mt-2">
          System categories you hide will appear here and can be restored anytime.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        {hiddenCategories.length} hidden {hiddenCategories.length === 1 ? 'category' : 'categories'}
      </div>
      
      {/* Debug information - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mb-4">
          <summary className="text-xs text-gray-400 cursor-pointer">Debug: Show raw data</summary>
          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(hiddenCategories, null, 2)}
          </pre>
        </details>
      )}
      
      <div className="space-y-4">
        {hiddenCategories.map((hiddenCategory, index) => (
          <div 
            key={`hidden-${hiddenCategory.id}-${hiddenCategory.categoryId}-${hiddenCategory.categoryType}`} 
            className="flex items-start justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 relative"
          >
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-medium text-gray-900 truncate text-base">
                  {hiddenCategory.categoryName}
                </span>
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full whitespace-nowrap flex-shrink-0">
                  {hiddenCategory.categoryType}
                </span>
                {process.env.NODE_ENV === 'development' && (
                  <span className="px-1 py-0.5 text-xs bg-red-100 text-red-600 rounded text-xs">
                    ID:{hiddenCategory.id}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Hidden on {new Date(hiddenCategory.hiddenAt).toLocaleDateString()} at {new Date(hiddenCategory.hiddenAt).toLocaleTimeString()}
              </p>
            </div>
            
            <div className="flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestoreCategory(
                  hiddenCategory.categoryId, 
                  hiddenCategory.categoryType, 
                  hiddenCategory.categoryName
                )}
                disabled={restoreCategoryMutation.isPending}
                className="min-w-[80px] bg-white hover:bg-gray-50"
              >
                {restoreCategoryMutation.isPending && 
                 restoreCategoryMutation.variables?.categoryId === hiddenCategory.categoryId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Restore"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 pt-2 border-t">
        <p>💡 <strong>Tip:</strong> To hide a category, click the delete/trash icon next to any system category in the expense or budget forms.</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [currency, setCurrency] = useState(user?.currency || "XAF");
  const [customCurrencyInput, setCustomCurrencyInput] = useState("");
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    monthlyReport: true,
    budgetAlerts: false
  });

  // Custom currencies query
  const { data: customCurrencies = [] } = useQuery({
    queryKey: ["customCurrencies"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/custom-currencies");
      return await res.json();
    },
  });

  // Log activity for viewing settings page
  useEffect(() => {
    const logPageView = async () => {
      try {
        await fetch('/api/activity-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actionType: 'VIEW',
            resourceType: 'SETTINGS',
            description: 'Viewed settings page',
            metadata: {
              pageType: 'user-settings',
              timestamp: new Date().toISOString()
            }
          }),
        });
      } catch (error) {
        console.error('Failed to log settings page view:', error);
      }
    };

    if (user) {
      logPageView();
    }
  }, [user]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { name: string; email: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", profileData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Notification settings mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (settings: typeof notificationSettings) => {
      const res = await apiRequest("PATCH", "/api/user/notifications", settings);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Notification preferences saved",
        description: "Your notification settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update notifications",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Account action logging
  const logAccountAction = async (action: string, metadata: any = {}) => {
    try {
      await fetch('/api/user/account-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          metadata
        }),
      });
    } catch (error) {
      console.error('Failed to log account action:', error);
    }
  };
  
  // Currency update mutation
  const updateCurrencyMutation = useMutation({
    mutationFn: async (currency: string) => {
      const res = await apiRequest("PATCH", "/api/user/settings", { currency });
      return await res.json();
    },
    onSuccess: () => {
      // Force invalidate ALL queries that might depend on currency
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      
      // Force clear and refetch user data immediately
      queryClient.removeQueries({ queryKey: ["/api/user"] });
      queryClient.refetchQueries({ queryKey: ["/api/user"] });
      
      // Force a complete cache clear for budget-related data
      queryClient.removeQueries({ queryKey: ["/api/budgets"] });
      
      toast({
        title: "Currency updated",
        description: "Your preferred currency has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update currency",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add custom currency mutation
  const addCustomCurrencyMutation = useMutation({
    mutationFn: async (data: { code: string; name: string }) => {
      const res = await apiRequest("POST", "/api/custom-currencies", data);
      return await res.json();
    },
    onSuccess: () => {
      setCustomCurrencyInput("");
      toast({
        title: "Success",
        description: "Custom currency added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["customCurrencies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add custom currency.",
        variant: "destructive",
      });
    },
  });

  // Delete custom currency mutation
  const deleteCustomCurrencyMutation = useMutation({
    mutationFn: async (currencyCode: string) => {
      const res = await apiRequest("DELETE", `/api/custom-currencies/${currencyCode}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Custom currency deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["customCurrencies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete custom currency.",
        variant: "destructive",
      });
    },
  });

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    updateCurrencyMutation.mutate(value);
  };

  const handleAddCustomCurrency = () => {
    if (!customCurrencyInput.trim()) return;
    
    const [code, name] = customCurrencyInput.split(" - ");
    if (!code || !name) {
      toast({
        title: "Error",
        description: "Please enter currency in format: CODE - Name (e.g., 'BTC - Bitcoin')",
        variant: "destructive",
      });
      return;
    }

    addCustomCurrencyMutation.mutate({ 
      code: code.trim().toUpperCase(), 
      name: name.trim() 
    });
  };

  const handleDeleteCustomCurrency = (currencyCode: string) => {
    deleteCustomCurrencyMutation.mutate(currencyCode);
  };
  
  const handleLogout = async () => {
    await logAccountAction('logout', {
      reason: 'user-initiated',
      timestamp: new Date().toISOString()
    });
    logoutMutation.mutate();
  };
  
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const updatedProfile = {
      name: formData.get('fullName') as string,
      email: formData.get('email') as string
    };
    setProfileData(updatedProfile);
    updateProfileMutation.mutate(updatedProfile);
  };
  
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    updateNotificationsMutation.mutate(notificationSettings);
  };

  const handleNotificationChange = (setting: keyof typeof notificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <MobileNav />
        <main className="flex-1 relative overflow-y-auto focus:outline-none pt-16 lg:pt-0">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
              
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input 
                            id="fullName" 
                            name="fullName"
                            defaultValue={user?.name}
                            placeholder="Your full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input 
                            id="email" 
                            name="email"
                            type="email" 
                            defaultValue={user?.email}
                            placeholder="Your email address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input 
                            id="username" 
                            defaultValue={user?.username} 
                            placeholder="Your username"
                            disabled
                          />
                        </div>
                      </div>
                      <Button type="submit" className="btn-gradient" disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Currency Settings</CardTitle>
                    <CardDescription>
                      Set your preferred currency for expense tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency">Preferred Currency</Label>
                        <Select
                          value={currency}
                          onValueChange={handleCurrencyChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Standard Currencies */}
                            <SelectItem value="XAF">XAF - CFA Franc (FCFA)</SelectItem>
                            <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                            <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                            <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                            <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                            <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                            <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                            <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                            
                            {/* Custom Currencies Section */}
                            {customCurrencies.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border-t border-gray-200">
                                  Your Custom Currencies
                                </div>
                                {customCurrencies.map((currency: any) => (
                                  <SelectItem key={currency.code} value={currency.code}>
                                    <span className="text-blue-600">{currency.code} - {currency.name}</span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-gray-500 mt-2">
                          Choose from standard currencies or your custom currencies. This will update the currency symbol throughout the application.
                        </p>
                      </div>

                      {/* Custom Currency Addition */}
                      <div className="space-y-2 border-t pt-4">
                        <Label htmlFor="customCurrency">Add Custom Currency</Label>
                        <div className="flex gap-2">
                          <Input
                            id="customCurrency"
                            value={customCurrencyInput}
                            onChange={(e) => setCustomCurrencyInput(e.target.value)}
                            placeholder="e.g., BTC - Bitcoin"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleAddCustomCurrency}
                            disabled={addCustomCurrencyMutation.isPending || !customCurrencyInput.trim()}
                            size="sm"
                          >
                            {addCustomCurrencyMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-gray-500">
                          Format: CODE - Name (e.g., "BTC - Bitcoin" or "NGN - Nigerian Naira")
                        </p>
                      </div>

                      {/* Custom Currencies List */}
                      {customCurrencies.length > 0 && (
                        <div className="space-y-2 border-t pt-4">
                          <Label>Your Custom Currencies</Label>
                          <div className="space-y-2">
                            {customCurrencies.map((currency: any) => (
                              <div key={currency.code} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                <span className="text-sm">{currency.code} - {currency.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-red-100"
                                  onClick={() => handleDeleteCustomCurrency(currency.code)}
                                  disabled={deleteCustomCurrencyMutation.isPending}
                                >
                                  {deleteCustomCurrencyMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3 text-red-500" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button 
                        type="button"
                        className="btn-gradient"
                        disabled={updateCurrencyMutation.isPending}
                        onClick={() => updateCurrencyMutation.mutate(currency)}
                      >
                        {updateCurrencyMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Update Currency
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Hidden Categories</CardTitle>
                    <CardDescription>
                      Manage categories you've hidden from your interface. Hidden system categories can be restored anytime.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HiddenCategoriesManager />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Settings</CardTitle>
                    <CardDescription>
                      Manage your notification preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveNotifications} className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                            <p className="text-sm text-gray-500">Receive emails about your account activity</p>
                          </div>
                          <Switch 
                            checked={notificationSettings.emailNotifications}
                            onCheckedChange={(checked) => handleNotificationChange('emailNotifications', checked)}
                            id="email-notifications" 
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Monthly Report</h3>
                            <p className="text-sm text-gray-500">Receive a monthly expense summary</p>
                          </div>
                          <Switch 
                            checked={notificationSettings.monthlyReport}
                            onCheckedChange={(checked) => handleNotificationChange('monthlyReport', checked)}
                            id="monthly-report" 
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Budget Alerts</h3>
                            <p className="text-sm text-gray-500">Get notified when you're close to budget limits</p>
                          </div>
                          <Switch 
                            checked={notificationSettings.budgetAlerts}
                            onCheckedChange={(checked) => handleNotificationChange('budgetAlerts', checked)}
                            id="budget-alerts" 
                          />
                        </div>
                      </div>
                      <Button type="submit" className="btn-gradient" disabled={updateNotificationsMutation.isPending}>
                        {updateNotificationsMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Preferences
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Account Actions</CardTitle>
                    <CardDescription>
                      Actions related to your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button 
                        variant="destructive" 
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                      >
                        {logoutMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Logout
                      </Button>
                      <p className="text-sm text-gray-500">
                        This will sign you out of your account on this device.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
