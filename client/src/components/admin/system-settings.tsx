import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Settings, Save, RefreshCw, Upload, Download, Globe, Lock, Palette, Mail, Shield, Zap, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface SystemSetting {
  id: number;
  settingKey: string;
  settingValue: string;
  settingType: 'text' | 'number' | 'boolean' | 'json' | 'file';
  category: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SystemSettingsByCategory {
  site: SystemSetting[];
  branding: SystemSetting[];
  localization: SystemSetting[];
  email: SystemSetting[];
  security: SystemSetting[];
  features: SystemSetting[];
}

interface SettingUpdate {
  key: string;
  value: string;
  description?: string;
}

const categoryIcons = {
  site: Globe,
  branding: Palette,
  localization: Globe,
  email: Mail,
  security: Shield,
  features: Zap
};

const categoryLabels = {
  site: 'Site Information',
  branding: 'Branding & Theme',
  localization: 'Localization',
  email: 'Email Settings',
  security: 'Security',
  features: 'Features'
};

export function SystemSettings() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, SettingUpdate>>(new Map());
  const [activeTab, setActiveTab] = useState('site');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch system settings by category
  const { data: settingsByCategory, isLoading, error } = useQuery<SystemSettingsByCategory>({
    queryKey: ['admin', 'settings', 'categories'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings/categories', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch system settings');
      }
      return response.json();
    }
  });

  // Update multiple settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: SettingUpdate[]) => {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ updates })
      });
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setPendingChanges(new Map());
      toast({ title: "Success", description: "Settings updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to update settings: ${error.message}`, variant: "destructive" });
    }
  });

  const handleSettingChange = (setting: SystemSetting, newValue: string) => {
    const update: SettingUpdate = {
      key: setting.settingKey,
      value: newValue,
      description: setting.description
    };
    
    setPendingChanges(prev => new Map(prev.set(setting.settingKey, update)));
  };

  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setIsSaving(true);
    try {
      await updateSettingsMutation.mutateAsync(Array.from(pendingChanges.values()));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingChanges(new Map());
    toast({ title: "Info", description: "Changes discarded" });
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const pendingValue = pendingChanges.get(setting.settingKey)?.value ?? setting.settingValue;
    const hasChanges = pendingChanges.has(setting.settingKey);

    switch (setting.settingType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={pendingValue === 'true'}
              onCheckedChange={(checked) => handleSettingChange(setting, checked.toString())}
            />
            <span className="text-sm text-muted-foreground">
              {pendingValue === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={pendingValue}
            onChange={(e) => handleSettingChange(setting, e.target.value)}
            className={hasChanges ? 'border-blue-500' : ''}
          />
        );

      case 'json':
        // Special handling for email templates - make them user-friendly
        if (setting.settingKey.includes('email_template_')) {
          let templateData = { subject: '', body: '' };
          try {
            templateData = JSON.parse(pendingValue);
          } catch {
            // If invalid JSON, provide defaults
            templateData = { subject: '', body: '' };
          }

          return (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Email Subject</Label>
                <Input
                  value={templateData.subject || ''}
                  onChange={(e) => {
                    const newTemplate = { ...templateData, subject: e.target.value };
                    handleSettingChange(setting, JSON.stringify(newTemplate));
                  }}
                  className={hasChanges ? 'border-blue-500' : ''}
                  placeholder="Enter email subject line"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Email Body</Label>
                <Textarea
                  value={templateData.body || ''}
                  onChange={(e) => {
                    const newTemplate = { ...templateData, body: e.target.value };
                    handleSettingChange(setting, JSON.stringify(newTemplate));
                  }}
                  className={`${hasChanges ? 'border-blue-500' : ''}`}
                  rows={6}
                  placeholder="Enter email body content"
                />
              </div>
              <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
                <div className="font-medium mb-2">Available Variables:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><code>{'{{site_name}}'}</code> - Site name</div>
                  <div><code>{'{{user_name}}'}</code> - User's name</div>
                  {setting.settingKey.includes('expense') && (
                    <>
                      <div><code>{'{{amount}}'}</code> - Expense amount</div>
                      <div><code>{'{{description}}'}</code> - Expense description</div>
                      <div><code>{'{{category}}'}</code> - Expense category</div>
                      <div><code>{'{{date}}'}</code> - Expense date</div>
                    </>
                  )}
                  {setting.settingKey.includes('password') && (
                    <div><code>{'{{reset_link}}'}</code> - Password reset link</div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // For other JSON settings, keep the original JSON editor
        let formattedValue = pendingValue;
        let isValidJson = true;
        try {
          const parsed = JSON.parse(pendingValue);
          formattedValue = JSON.stringify(parsed, null, 2);
        } catch {
          formattedValue = pendingValue;
          isValidJson = false;
        }
        
        return (
          <div className="space-y-2">
            <Textarea
              value={formattedValue}
              onChange={(e) => {
                handleSettingChange(setting, e.target.value);
              }}
              className={`font-mono text-sm ${hasChanges ? 'border-blue-500' : ''} ${!isValidJson ? 'border-red-500' : ''}`}
              rows={6}
              placeholder="Enter valid JSON"
            />
            {!isValidJson && (
              <div className="flex items-center text-red-500 text-xs">
                <XCircle className="w-3 h-3 mr-1" />
                Invalid JSON format
              </div>
            )}
            {isValidJson && (
              <div className="flex items-center text-green-500 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Valid JSON
              </div>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <Input
              type="text"
              value={pendingValue}
              onChange={(e) => handleSettingChange(setting, e.target.value)}
              className={hasChanges ? 'border-blue-500' : ''}
              placeholder="Enter file URL or path"
            />
            <Button variant="outline" size="sm" className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
          </div>
        );

      default:
        return (
          <Input
            type="text"
            value={pendingValue}
            onChange={(e) => handleSettingChange(setting, e.target.value)}
            className={hasChanges ? 'border-blue-500' : ''}
          />
        );
    }
  };

  const renderCategorySettings = (category: keyof SystemSettingsByCategory, settings: SystemSetting[]) => {
    if (!settings || settings.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No settings found for this category
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {settings.map((setting) => {
          const hasChanges = pendingChanges.has(setting.settingKey);
          
          return (
            <Card key={setting.id} className={hasChanges ? 'border-blue-500 shadow-md' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-medium">
                      {setting.settingKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </CardTitle>
                    {setting.description && (
                      <CardDescription className="text-sm">
                        {setting.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasChanges && (
                      <Badge variant="secondary" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Modified
                      </Badge>
                    )}
                    {setting.isPublic && (
                      <Badge variant="outline" className="text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        Public
                      </Badge>
                    )}
                    {!setting.isPublic && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Private
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor={setting.settingKey} className="text-sm font-medium">
                    Value ({setting.settingType})
                  </Label>
                  {renderSettingInput(setting)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <XCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load system settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center">
            <Settings className="w-6 h-6 mr-2" />
            System Settings
          </h2>
          <p className="text-muted-foreground">
            Configure system-wide settings and preferences
          </p>
        </div>
        
        {/* Action Buttons */}
        {pendingChanges.size > 0 && (
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="px-3 py-1">
              {pendingChanges.size} pending change{pendingChanges.size !== 1 ? 's' : ''}
            </Badge>
            <Button variant="outline" onClick={handleDiscardChanges} disabled={isSaving}>
              <XCircle className="w-4 h-4 mr-2" />
              Discard
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          {Object.entries(categoryLabels).map(([key, label]) => {
            const Icon = categoryIcons[key as keyof typeof categoryIcons];
            const categorySettings = settingsByCategory?.[key as keyof SystemSettingsByCategory] || [];
            const categoryChanges = categorySettings.filter(setting => 
              pendingChanges.has(setting.settingKey)
            ).length;

            return (
              <TabsTrigger key={key} value={key} className="flex items-center space-x-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {categoryChanges > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                    {categoryChanges}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(categoryLabels).map(([key, label]) => (
          <TabsContent key={key} value={key} className="space-y-6">
            <div className="flex items-center space-x-2">
              {React.createElement(categoryIcons[key as keyof typeof categoryIcons], { 
                className: "w-5 h-5" 
              })}
              <h3 className="text-lg font-semibold">{label}</h3>
            </div>
            <Separator />
            {settingsByCategory && renderCategorySettings(
              key as keyof SystemSettingsByCategory, 
              settingsByCategory[key as keyof SystemSettingsByCategory]
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Export/Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Export & Import
          </CardTitle>
          <CardDescription>
            Backup or restore system settings configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Settings
            </Button>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import Settings
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset to Default Settings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will reset all system settings to their default values. 
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive">
                    Reset Settings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}