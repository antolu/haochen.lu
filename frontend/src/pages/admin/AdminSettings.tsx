import React, { useEffect, useMemo, useState } from "react";
import { settings as settingsApi } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ImageSettings = {
  responsive_sizes: Record<string, number>;
  quality_settings: Record<string, number>;
  avif_quality_base_offset: number;
  avif_quality_floor: number;
  avif_effort_default: number;
  webp_quality: number;
};

const AdminSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [img, setImg] = useState<ImageSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await settingsApi.getImage();
        if (!mounted) return;
        setImg(data);
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
    return Object.entries(img?.responsive_sizes ?? {});
  }, [img]);

  const qualityEntries = useMemo(() => {
    return Object.entries(img?.quality_settings ?? {});
  }, [img]);

  const handleNumeric = (key: keyof ImageSettings, value: number) => {
    if (!img) return;
    setImg({ ...img, [key]: value });
  };

  const handleMapValue = (
    mapKey: "responsive_sizes" | "quality_settings",
    k: string,
    value: number,
  ) => {
    if (!img) return;
    setImg({
      ...img,
      [mapKey]: {
        ...img[mapKey],
        [k]: value,
      },
    });
  };

  const save = async () => {
    if (!img) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = { ...img };
      await settingsApi.updateImage(payload);
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
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground text-xl">
          Configure image processing and quality settings
        </p>
      </div>

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
            <label key={k} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground w-32 capitalize">
                {k}
              </span>
              <Input
                className="w-40"
                type="number"
                value={v}
                onChange={(e) =>
                  handleMapValue("responsive_sizes", k, Number(e.target.value))
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
            <label key={k} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground w-32 capitalize">
                {k}
              </span>
              <Input
                className="w-40"
                type="number"
                value={v}
                onChange={(e) =>
                  handleMapValue("quality_settings", k, Number(e.target.value))
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
            <span className="text-sm text-foreground">AVIF Quality Offset</span>
            <Input
              className="w-40"
              type="number"
              value={img?.avif_quality_base_offset ?? 0}
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
            <span className="text-sm text-foreground">AVIF Quality Floor</span>
            <Input
              className="w-40"
              type="number"
              value={img?.avif_quality_floor ?? 50}
              onChange={(e) =>
                handleNumeric("avif_quality_floor", Number(e.target.value))
              }
              min={30}
              max={90}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">AVIF Effort Default</span>
            <Input
              className="w-40"
              type="number"
              value={img?.avif_effort_default ?? 6}
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
              value={img?.webp_quality ?? 85}
              onChange={(e) =>
                handleNumeric("webp_quality", Number(e.target.value))
              }
              min={60}
              max={100}
            />
          </label>
        </div>
      </div>

      <div className="pt-6 flex gap-4">
        <Button
          variant="gradient"
          size="lg"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;
