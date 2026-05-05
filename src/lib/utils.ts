export async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON from upstream: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = json?.error?.message || `Upstream error ${response.status}`;
    throw new Error(message);
  }

  return json;
}

export function decodeUrlSegmentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

export function parseDurationToSeconds(duration: string) {
  const match =
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u.exec(duration || "");

  if (!match) {
    return 0;
  }

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function formatDurationHuman(seconds: number) {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function average(items: any[], key: string) {
  if (!items.length) {
    return 0;
  }

  const sum = items.reduce((acc, item) => acc + Number(item[key] || 0), 0);
  return sum / items.length;
}

export function median(numbers: number[]) {
  if (!numbers.length) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function scoreToBand(score: number) {
  if (score >= 75) {
    return "strong";
  }
  if (score >= 50) {
    return "healthy";
  }
  if (score >= 30) {
    return "watch";
  }
  return "early";
}

export function classifyContentProfile(shortRatio: number, avgDurationSeconds: number) {
  if (shortRatio >= 0.7) {
    return "shorts-heavy";
  }
  if (shortRatio >= 0.35) {
    return "hybrid";
  }
  if (avgDurationSeconds >= 900) {
    return "long-form deep";
  }
  return "long-form";
}

export function estimateMonetization({
  recentAvgViews,
  avgDaysBetweenUploads,
  shortRatio,
  engagementRate,
  totalViews,
  totalVideos,
}: {
  recentAvgViews: number;
  avgDaysBetweenUploads: number;
  shortRatio: number;
  engagementRate: number;
  totalViews: number;
  totalVideos: number;
}) {
  const cadence = avgDaysBetweenUploads || 14;
  const uploadsPer30Days = cadence > 0 ? 30 / cadence : 0;
  const monthlyViewsEstimate = Math.max(0, recentAvgViews * uploadsPer30Days);
  const shortsPenalty = 1 - shortRatio * 0.55;
  const engagementBoost = clamp(1 + (engagementRate - 4) * 0.04, 0.8, 1.2);
  const baseRpmLow = 0.45 * shortsPenalty * engagementBoost;
  const baseRpmHigh = 3.5 * shortsPenalty * engagementBoost;
  const estimatedRpmLow = clamp(baseRpmLow, 0.15, 6);
  const estimatedRpmHigh = clamp(baseRpmHigh, 0.5, 12);
  const estimatedMonthlyRevenueLow = (monthlyViewsEstimate / 1000) * estimatedRpmLow;
  const estimatedMonthlyRevenueHigh =
    (monthlyViewsEstimate / 1000) * estimatedRpmHigh;
  const channelMaturityScore = clamp(
    (totalVideos >= 100 ? 25 : totalVideos * 0.25) +
      (totalViews >= 1000000 ? 25 : totalViews / 40000) +
      (recentAvgViews >= 50000 ? 25 : recentAvgViews / 2000) +
      clamp(engagementRate * 4, 0, 25),
    0,
    100
  );

  return {
    estimatedMonthlyViews: Math.round(monthlyViewsEstimate),
    estimatedRpmLow,
    estimatedRpmHigh,
    estimatedMonthlyRevenueLow,
    estimatedMonthlyRevenueHigh,
    channelMaturityScore,
    confidence: shortRatio >= 0.65 ? "low" : shortRatio >= 0.35 ? "medium" : "medium-high",
    notes: [
      "RPM/Doanh thu ước tính được mô phỏng từ số lượt xem gần đây, tần suất đăng video, mức độ tương tác và tỷ lệ shorts.",
      "Những con số này chỉ mang tính định hướng và không phải là dữ liệu YouTube Analytics được chủ kênh xác thực.",
    ],
  };
}

export function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/[\s_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

export function uniqueStrings(items: string[]) {
  return Array.from(
    new Set(
      (items || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

export function sanitizeFilenamePart(value: string) {
  return slugify(value).slice(0, 40) || "unnamed";
}
