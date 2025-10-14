import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { SiteInformationSettings } from './settings/site-information';
import { BrandingSettings } from './settings/branding';
import { EmailSettings } from './settings/email';
import { SecuritySettings } from './settings/security';
import { FeaturesSettings } from './settings/features';

export default function AdminSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("site-info");
  
  const { data: settings, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    }
  });

  // Site Information State
  const [siteName, setSiteName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');

  // Branding State
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [theme, setTheme] = useState('system');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [darkMode, setDarkMode] = useState(false);

  // Email Settings State
  const [emailTemplates, setEmailTemplates] = useState({
    welcome: '',
    password_reset: '',
    account_verification: ''
  });
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    secure: true
  });

  // Security Settings State
  const [passwordPolicy, setPasswordPolicy] = useState({
    minLength: 8,
    requireNumbers: true,
    requireSymbols: true,
    requireUppercase: true,
    maxAge: 90
  });
  const [twoFactorAuth, setTwoFactorAuth] = useState({
    enabled: false,
    method: 'authenticator'
  });

  // Features State
  const [features, setFeatures] = useState({
    budgeting: true,
    reports: true,
    categories: true,
    sharing: false,
    customCurrencies: true
  });

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name || '');
      setCurrency(settings.default_currency || 'USD');
      setLanguage(settings.default_language || 'en');
      setLogoPreview(settings.logo_url || '');
      setEmailTemplates(settings.email_templates || {
        welcome: '',
        password_reset: '',
        account_verification: ''
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          site_name: siteName, 
          default_currency: currency,
          default_language: language,
          email_templates: emailTemplates
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Settings saved successfully' });
      refetch();
    },
    onError: () => {
      toast({ 
        title: 'Failed to save settings', 
        variant: 'destructive' 
      });
    }
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async () => {
      if (!logo) return;
      const formData = new FormData();
      formData.append('logo', logo);

      const res = await fetch('/api/admin/settings/logo', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to upload logo');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Logo uploaded successfully' });
      setLogoPreview(data.logo_url);
      refetch();
    },
    onError: () => {
      toast({ 
        title: 'Failed to upload logo', 
        variant: 'destructive' 
      });
    }
  });

  return (
    <div className="space-y-6 p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="site-info">Site Information</TabsTrigger>
          <TabsTrigger value="branding">Branding & Theme</TabsTrigger>
          <TabsTrigger value="email">Email Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="site-info" className="space-y-4">
          <SiteInformationSettings
            siteName={siteName}
            setSiteName={setSiteName}
            defaultLanguage={language}
            setDefaultLanguage={setLanguage}
            defaultTimezone={timezone}
            setDefaultTimezone={setTimezone}
            defaultCurrency={currency}
            setDefaultCurrency={setCurrency}
          />
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <BrandingSettings
            logo={logo}
            setLogo={setLogo}
            logoPreview={logoPreview}
            logoUrl={settings?.logo_url || ''}
            theme={theme}
            setTheme={setTheme}
            primaryColor={primaryColor}
            setPrimaryColor={setPrimaryColor}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            uploadLogoMutation={uploadLogoMutation}
          />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailSettings
            emailTemplates={emailTemplates}
            setEmailTemplates={setEmailTemplates}
            smtpSettings={smtpSettings}
            setSmtpSettings={setSmtpSettings}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecuritySettings
            passwordPolicy={passwordPolicy}
            setPasswordPolicy={setPasswordPolicy}
            twoFactorAuth={twoFactorAuth}
            setTwoFactorAuth={setTwoFactorAuth}
          />
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <FeaturesSettings
            features={features}
            setFeatures={setFeatures}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.status === 'pending'}
          className="min-w-[120px]"
        >
          {saveMutation.status === 'pending' && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
