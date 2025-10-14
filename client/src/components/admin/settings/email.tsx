import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface EmailSettingsProps {
  emailTemplates: {
    welcome: string;
    password_reset: string;
    account_verification: string;
  };
  setEmailTemplates: (templates: {
    welcome: string;
    password_reset: string;
    account_verification: string;
  }) => void;
  smtpSettings: {
    host: string;
    port: string;
    username: string;
    password: string;
    secure: boolean;
  };
  setSmtpSettings: (settings: {
    host: string;
    port: string;
    username: string;
    password: string;
    secure: boolean;
  }) => void;
}

export function EmailSettings({
  emailTemplates,
  setEmailTemplates,
  smtpSettings,
  setSmtpSettings
}: EmailSettingsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>
            Customize email templates for different scenarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="welcome-email">Welcome Email</Label>
            <Textarea
              id="welcome-email"
              value={emailTemplates.welcome}
              onChange={(e) => setEmailTemplates({ ...emailTemplates, welcome: e.target.value })}
              placeholder="Enter welcome email template"
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password-reset">Password Reset Email</Label>
            <Textarea
              id="password-reset"
              value={emailTemplates.password_reset}
              onChange={(e) => setEmailTemplates({ ...emailTemplates, password_reset: e.target.value })}
              placeholder="Enter password reset email template"
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-verification">Account Verification Email</Label>
            <Textarea
              id="account-verification"
              value={emailTemplates.account_verification}
              onChange={(e) => setEmailTemplates({ ...emailTemplates, account_verification: e.target.value })}
              placeholder="Enter account verification email template"
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>
            Configure your email server settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={smtpSettings.host}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                value={smtpSettings.port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                placeholder="587"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-username">SMTP Username</Label>
              <Input
                id="smtp-username"
                value={smtpSettings.username}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
                placeholder="username@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-password">SMTP Password</Label>
              <Input
                id="smtp-password"
                type="password"
                value={smtpSettings.password}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="smtp-secure"
              checked={smtpSettings.secure}
              onCheckedChange={(checked) => setSmtpSettings({ ...smtpSettings, secure: checked })}
            />
            <Label htmlFor="smtp-secure">Use Secure Connection (TLS)</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}