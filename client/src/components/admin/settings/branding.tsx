import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface BrandingProps {
  logo: File | null;
  setLogo: (file: File | null) => void;
  logoPreview: string;
  logoUrl: string;
  theme: string;
  setTheme: (theme: string) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  uploadLogoMutation: any;
}

export function BrandingSettings({
  logo,
  setLogo,
  logoPreview,
  logoUrl,
  theme,
  setTheme,
  primaryColor,
  setPrimaryColor,
  darkMode,
  setDarkMode,
  uploadLogoMutation
}: BrandingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding & Theme</CardTitle>
        <CardDescription>
          Customize your application's look and feel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="logo">Logo</Label>
          <div className="flex items-center space-x-4">
            {logoPreview && (
              <img 
                src={logoPreview} 
                alt="Site Logo" 
                className="h-12 w-12 object-contain"
              />
            )}
            <div className="flex-1">
              <Input
                id="logo"
                type="file"
                accept="image/jpeg,image/png,image/svg+xml"
                onChange={(e) => setLogo(e.target.files?.[0] || null)}
              />
            </div>
            {logo && (
              <Button
                onClick={() => uploadLogoMutation.mutate()}
                disabled={uploadLogoMutation.isLoading}
              >
                {uploadLogoMutation.isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger>
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary-color">Primary Color</Label>
          <div className="flex items-center space-x-4">
            <Input
              id="primary-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="dark-mode"
            checked={darkMode}
            onCheckedChange={setDarkMode}
          />
          <Label htmlFor="dark-mode">Enable Dark Mode</Label>
        </div>
      </CardContent>
    </Card>
  );
}