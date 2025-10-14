import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SecuritySettingsProps {
  passwordPolicy: {
    minLength: number;
    requireNumbers: boolean;
    requireSymbols: boolean;
    requireUppercase: boolean;
    maxAge: number;
  };
  setPasswordPolicy: (policy: {
    minLength: number;
    requireNumbers: boolean;
    requireSymbols: boolean;
    requireUppercase: boolean;
    maxAge: number;
  }) => void;
  twoFactorAuth: {
    enabled: boolean;
    method: string;
  };
  setTwoFactorAuth: (settings: {
    enabled: boolean;
    method: string;
  }) => void;
}

export function SecuritySettings({
  passwordPolicy,
  setPasswordPolicy,
  twoFactorAuth,
  setTwoFactorAuth
}: SecuritySettingsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>
            Configure password requirements for users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="min-length">Minimum Password Length</Label>
            <Input
              id="min-length"
              type="number"
              min={8}
              value={passwordPolicy.minLength}
              onChange={(e) => setPasswordPolicy({ ...passwordPolicy, minLength: parseInt(e.target.value) })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="require-numbers"
              checked={passwordPolicy.requireNumbers}
              onCheckedChange={(checked) => setPasswordPolicy({ ...passwordPolicy, requireNumbers: checked })}
            />
            <Label htmlFor="require-numbers">Require Numbers</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="require-symbols"
              checked={passwordPolicy.requireSymbols}
              onCheckedChange={(checked) => setPasswordPolicy({ ...passwordPolicy, requireSymbols: checked })}
            />
            <Label htmlFor="require-symbols">Require Special Characters</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="require-uppercase"
              checked={passwordPolicy.requireUppercase}
              onCheckedChange={(checked) => setPasswordPolicy({ ...passwordPolicy, requireUppercase: checked })}
            />
            <Label htmlFor="require-uppercase">Require Uppercase Letters</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-age">Maximum Password Age (days)</Label>
            <Input
              id="max-age"
              type="number"
              min={0}
              value={passwordPolicy.maxAge}
              onChange={(e) => setPasswordPolicy({ ...passwordPolicy, maxAge: parseInt(e.target.value) })}
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 for no expiration
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Configure two-factor authentication settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="2fa-enabled"
              checked={twoFactorAuth.enabled}
              onCheckedChange={(checked) => setTwoFactorAuth({ ...twoFactorAuth, enabled: checked })}
            />
            <Label htmlFor="2fa-enabled">Enable Two-Factor Authentication</Label>
          </div>

          {twoFactorAuth.enabled && (
            <div className="space-y-2">
              <Label htmlFor="2fa-method">Authentication Method</Label>
              <Select
                value={twoFactorAuth.method}
                onValueChange={(value) => setTwoFactorAuth({ ...twoFactorAuth, method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="authenticator">Authenticator App</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}