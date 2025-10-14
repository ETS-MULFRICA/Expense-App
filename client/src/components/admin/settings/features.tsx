import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface FeaturesSettingsProps {
  features: {
    budgeting: boolean;
    reports: boolean;
    categories: boolean;
    sharing: boolean;
    customCurrencies: boolean;
  };
  setFeatures: (features: {
    budgeting: boolean;
    reports: boolean;
    categories: boolean;
    sharing: boolean;
    customCurrencies: boolean;
  }) => void;
}

export function FeaturesSettings({
  features,
  setFeatures,
}: FeaturesSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Management</CardTitle>
        <CardDescription>
          Enable or disable application features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-budgeting">Budgeting</Label>
              <p className="text-sm text-muted-foreground">
                Enable budget creation and tracking
              </p>
            </div>
            <Switch
              id="feature-budgeting"
              checked={features.budgeting}
              onCheckedChange={(checked) => setFeatures({ ...features, budgeting: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-reports">Reports & Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Enable advanced reporting and analytics
              </p>
            </div>
            <Switch
              id="feature-reports"
              checked={features.reports}
              onCheckedChange={(checked) => setFeatures({ ...features, reports: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-categories">Custom Categories</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to create custom expense categories
              </p>
            </div>
            <Switch
              id="feature-categories"
              checked={features.categories}
              onCheckedChange={(checked) => setFeatures({ ...features, categories: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-sharing">Expense Sharing</Label>
              <p className="text-sm text-muted-foreground">
                Enable expense sharing between users
              </p>
            </div>
            <Switch
              id="feature-sharing"
              checked={features.sharing}
              onCheckedChange={(checked) => setFeatures({ ...features, sharing: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-currencies">Custom Currencies</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to add and use custom currencies
              </p>
            </div>
            <Switch
              id="feature-currencies"
              checked={features.customCurrencies}
              onCheckedChange={(checked) => setFeatures({ ...features, customCurrencies: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}