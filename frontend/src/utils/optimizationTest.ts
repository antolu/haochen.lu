/**
 * Simple utility to test photo caching optimization performance
 */

import type { Photo } from "../types";
import type { OrderByOption } from "../components/OrderBySelector";

interface OptimizationTestResult {
  scenario: string;
  photosReused: number;
  totalPhotos: number;
  reusePercentage: number;
  estimatedSavings: {
    networkRequests: number;
    bandwidthSaved: string;
  };
}

/**
 * Simulates testing the optimization with sample data
 */
export const testPhotoOptimization = (
  currentPhotos: Photo[],
  newOrderPhotos: Photo[],
  scenario: string,
): OptimizationTestResult => {
  const currentIds = new Set(currentPhotos.map((p) => p.id));
  const newIds = new Set(newOrderPhotos.map((p) => p.id));

  // Find intersection
  const intersectionIds = [...currentIds].filter((id) => newIds.has(id));
  const photosReused = intersectionIds.length;
  const totalPhotos = newOrderPhotos.length;
  const reusePercentage =
    totalPhotos > 0 ? (photosReused / totalPhotos) * 100 : 0;

  // Estimate savings
  const savedRequests = Math.floor(photosReused / 24); // pages saved
  const avgPhotoSize = 150; // KB average
  const bandwidthSaved = `${Math.round((photosReused * avgPhotoSize) / 1024)} MB`;

  return {
    scenario,
    photosReused,
    totalPhotos,
    reusePercentage: Math.round(reusePercentage * 100) / 100,
    estimatedSavings: {
      networkRequests: savedRequests,
      bandwidthSaved,
    },
  };
};

/**
 * Logs optimization test results to console
 */
export const logOptimizationTest = (_result: OptimizationTestResult) => {
  // Disabled console logging for production - optimization test results
  // console.group(`📊 Photo Optimization Test: ${result.scenario}`);
  // console.log(`🔄 Photos Reused: ${result.photosReused}/${result.totalPhotos} (${result.reusePercentage}%)`);
  // console.log(`🚀 Network Requests Saved: ${result.estimatedSavings.networkRequests}`);
  // console.log(`💾 Bandwidth Saved: ${result.estimatedSavings.bandwidthSaved}`);
  // if (result.reusePercentage >= 50) {
  //   console.log("✅ Excellent optimization! High photo reuse rate.");
  // } else if (result.reusePercentage >= 20) {
  //   console.log("⚡ Good optimization! Moderate photo reuse rate.");
  // } else {
  //   console.log("📈 Low optimization potential for this order switch.");
  // }
  // console.groupEnd();
};

/**
 * Test scenarios for different order combinations
 */
export const createTestScenarios = () => {
  const scenarios = [
    {
      from: "created_at" as OrderByOption,
      to: "date_taken" as OrderByOption,
      description: "Upload Date → Capture Date",
    },
    {
      from: "date_taken" as OrderByOption,
      to: "order" as OrderByOption,
      description: "Capture Date → Manual Order",
    },
    {
      from: "order" as OrderByOption,
      to: "created_at" as OrderByOption,
      description: "Manual Order → Upload Date",
    },
  ];

  return scenarios;
};

/**
 * Development utility to monitor cache performance
 */
export const monitorCachePerformance = () => {
  if (process.env.NODE_ENV === "development") {
    console.warn("🔍 Photo Cache Performance Monitor Active");

    // Listen for cache events
    window.addEventListener("photo-cache-hit", (_e: Event) => {
      // Disabled console logging for production
      // console.log("🎯 Cache Hit:", e.detail);
    });

    window.addEventListener("photo-cache-miss", (_e: Event) => {
      // Disabled console logging for production
      // console.log("❌ Cache Miss:", e.detail);
    });

    window.addEventListener("photo-order-switch", (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail as {
        from: string;
        to: string;
        cached: Photo[];
        total: Photo[];
      };
      const { from, to, cached, total } = detail;
      const result = testPhotoOptimization(cached, total, `${from} → ${to}`);
      logOptimizationTest(result);
    });
  }
};
