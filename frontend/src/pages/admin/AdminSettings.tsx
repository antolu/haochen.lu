import React, { useEffect, useMemo, useState } from "react";
import { settings as settingsApi, type SystemSettings } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AdminPageLayout } from "../../components/admin/AdminPageLayout";

const AdminSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await settingsApi.getSettings();
        if (!mounted) return;
        setSettings(data);
        setLoading(false);
      } catch (e: unknown) {
        if (!mounted) return;
        const errorMessage =
          e instanceof Error ? e.message : "Failed to load settings";
        setError(errorMessage);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const responsiveEntries = useMemo(() => {
    return Object.entries(settings?.responsive_sizes ?? {});
  }, [settings]);

  const qualityEntries = useMemo(() => {
    return Object.entries(settings?.quality_settings ?? {});
  }, [settings]);

  const handleNumeric = (key: keyof SystemSettings, value: number) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleMapValue = (
    mapKey: "responsive_sizes" | "quality_settings",
    k: string,
    value: number,
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [mapKey]: {
        ...settings[mapKey],
        [k]: value,
      },
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = { ...settings };
      await settingsApi.updateSettings(payload);
      setOk("Settings saved");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="Settings"
      description="Configure image processing, quality settings, and API rate limiting"
      actions={
        <Button
          variant="gradient"
          size="lg"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      }
    >
      <div className="space-y-10">
        {ok ? (
          <div className="p-5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            {ok}
          </div>
        ) : null}

        {/* Responsive Sizes */}
        <div className="bg-card p-8 rounded-xl shadow-lg border-border/40">
          <h2 className="text-2xl font-semibold mb-6">Responsive Sizes (px)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {responsiveEntries.map(([k, v]) => (
              <label
                key={k}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-foreground w-32 capitalize">
                  {k}
                </span>
                <Input
                  className="w-40"
                  type="number"
                  value={v}
                  onChange={(e) =>
                    handleMapValue(
                      "responsive_sizes",
                      k,
                      Number(e.target.value),
                    )
                  }
                  min={100}
                  step={50}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Quality Settings */}
        <div className="bg-card p-8 rounded-xl shadow-lg border-border/40">
          <h2 className="text-2xl font-semibold mb-6">Quality Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {qualityEntries.map(([k, v]) => (
              <label
                key={k}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-foreground w-32 capitalize">
                  {k}
                </span>
                <Input
                  className="w-40"
                  type="number"
                  value={v}
                  onChange={(e) =>
                    handleMapValue(
                      "quality_settings",
                      k,
                      Number(e.target.value),
                    )
                  }
                  min={50}
                  max={100}
                />
              </label>
            ))}
          </div>
        </div>

        {/* AVIF/WebP knobs */}
        <div className="bg-card p-8 rounded-xl shadow-lg border-border/40 space-y-6">
          <h2 className="text-2xl font-semibold">Compression Knobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                AVIF Quality Offset
              </span>
              <Input
                className="w-40"
                type="number"
                value={settings?.avif_quality_base_offset ?? 0}
                onChange={(e) =>
                  handleNumeric(
                    "avif_quality_base_offset",
                    Number(e.target.value),
                  )
                }
                min={-30}
                max={10}
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                AVIF Quality Floor
              </span>
              <Input
                className="w-40"
                type="number"
                value={settings?.avif_quality_floor ?? 50}
                onChange={(e) =>
                  handleNumeric("avif_quality_floor", Number(e.target.value))
                }
                min={30}
                max={90}
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                AVIF Effort Default
              </span>
              <Input
                className="w-40"
                type="number"
                value={settings?.avif_effort_default ?? 6}
                onChange={(e) =>
                  handleNumeric("avif_effort_default", Number(e.target.value))
                }
                min={1}
                max={9}
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                WebP Quality (fallback)
              </span>
              <Input
                className="w-40"
                type="number"
                value={settings?.webp_quality ?? 85}
                onChange={(e) =>
                  handleNumeric("webp_quality", Number(e.target.value))
                }
                min={60}
                max={100}
              />
            </label>
          </div>
        </div>

        {/* API & Rate Limiting Settings */}
        <div className="bg-card p-8 rounded-xl shadow-lg border-border/40 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold">API & Rate Limiting</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure request limits and protection rules for API endpoints.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <span className="text-sm font-medium text-foreground block">
                Enable Rate Limiting
              </span>
              <span className="text-xs text-muted-foreground block mt-1">
                Protect the API from brute force attacks and excessive requests.
                Disable this during development or heavy testing.
              </span>
              {settings?.rate_limit_locked && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 mt-2">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Locked by server configuration (RATE_LIMIT_ENABLED environment
                  variable is set).
                </span>
              )}
            </div>
            <Switch
              checked={settings?.rate_limit_enabled ?? false}
              disabled={settings?.rate_limit_locked ?? false}
              onCheckedChange={(checked) => {
                if (settings) {
                  setSettings({ ...settings, rate_limit_enabled: checked });
                }
              }}
            />
          </div>

          <div
            className={`space-y-6 transition-all duration-200 ${settings?.rate_limit_enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}
          >
            <h3 className="text-lg font-medium">Rate Limit Configurations</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* General API Limits */}
              <div className="p-5 rounded-lg border border-border bg-card/50 space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">
                  General API
                </h4>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Max Requests
                    </span>
                    <Input
                      type="number"
                      value={settings?.rate_limit_calls ?? 100}
                      onChange={(e) =>
                        handleNumeric(
                          "rate_limit_calls",
                          Number(e.target.value),
                        )
                      }
                      min={1}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Period (seconds)
                    </span>
                    <Input
                      type="number"
                      value={settings?.rate_limit_period ?? 3600}
                      onChange={(e) =>
                        handleNumeric(
                          "rate_limit_period",
                          Number(e.target.value),
                        )
                      }
                      min={1}
                    />
                  </label>
                </div>
              </div>

              {/* File Access Limits */}
              <div className="p-5 rounded-lg border border-border bg-card/50 space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">
                  File Access
                </h4>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Max Requests
                    </span>
                    <Input
                      type="number"
                      value={settings?.rate_limit_file_calls ?? 20}
                      onChange={(e) =>
                        handleNumeric(
                          "rate_limit_file_calls",
                          Number(e.target.value),
                        )
                      }
                      min={1}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Period (seconds)
                    </span>
                    <Input
                      type="number"
                      value={settings?.rate_limit_file_period ?? 60}
                      onChange={(e) =>
                        handleNumeric(
                          "rate_limit_file_period",
                          Number(e.target.value),
                        )
                      }
                      min={1}
                    />
                  </label>
                </div>
              </div>

              {/* Authentication Limits */}
              <div className="p-5 rounded-lg border border-border bg-card/50 space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">
                  Authentication
                </h4>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Max Requests
                    </span>
                    <Input
                      type="number"
                      value={settings?.rate_limit_auth_calls ?? 60}
                      onChange={(e) =>
                        handleNumeric(
                          "rate_limit_auth_calls",
                          Number(e.target.value),
                        )
                      }
                      min={1}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Period (seconds)
                    </span>
                    <Input
                      type="number"
                      value={settings?.rate_limit_auth_period ?? 60}
                      onChange={(e) =>
                        handleNumeric(
                          "rate_limit_auth_period",
                          Number(e.target.value),
                        )
                      }
                      min={1}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
};

export default AdminSettings;
