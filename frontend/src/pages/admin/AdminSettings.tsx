import React, { useEffect, useMemo, useState } from "react";
import { settings as settingsApi } from "@/api/client";

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
    (async () => {
      try {
        const data = await settingsApi.getImage();
        if (!mounted) return;
        setImg(data);
        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load settings");
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
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
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
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {ok ? (
        <div className="p-3 rounded bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
          {ok}
        </div>
      ) : null}

      {/* Responsive Sizes */}
      <section>
        <h2 className="text-lg font-medium mb-3">Responsive Sizes (px)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {responsiveEntries.map(([k, v]) => (
            <label key={k} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground w-32 capitalize">
                {k}
              </span>
              <input
                className="w-40 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
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
      </section>

      {/* Quality Settings */}
      <section>
        <h2 className="text-lg font-medium mb-3">Quality Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {qualityEntries.map(([k, v]) => (
            <label key={k} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground w-32 capitalize">
                {k}
              </span>
              <input
                className="w-40 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
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
      </section>

      {/* AVIF/WebP knobs */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Compression Knobs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">AVIF Quality Offset</span>
            <input
              className="w-40 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
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
            <input
              className="w-40 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
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
            <input
              className="w-40 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
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
            <input
              className="w-40 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
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
      </section>

      <div className="pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
