import { parseDurationToSeconds, average, median, classifyContentProfile, estimateMonetization, clamp, scoreToBand, fetchJson } from "./utils";

export function buildPublicMetrics(channel: any, videos: any[]) {
  const totalViews = Number(channel.statistics?.viewCount || 0);
  const totalVideos = Number(channel.statistics?.videoCount || 0);
  const avgViewsPerVideo = totalVideos ? totalViews / totalVideos : 0;
  
  const normalizedVideos = videos.map((video) => {
    const seconds = parseDurationToSeconds(video.contentDetails?.duration);
    const publishedAt = video.snippet?.publishedAt || null;
    return {
      id: video.id,
      title: video.snippet?.title || "Untitled",
      publishedAt,
      views: Number(video.statistics?.viewCount || 0),
      likes: Number(video.statistics?.likeCount || 0),
      comments: Number(video.statistics?.commentCount || 0),
      durationSeconds: seconds,
      isShort: seconds > 0 && seconds <= 60,
      thumbnail:
        video.snippet?.thumbnails?.medium?.url ||
        video.snippet?.thumbnails?.default?.url ||
        "",
      url: `https://www.youtube.com/watch?v=${video.id}`,
    };
  });

  const videosSortedByDate = [...normalizedVideos].sort((a, b) =>
    (b.publishedAt || "").localeCompare(a.publishedAt || "")
  );
  
  const latestVideo = videosSortedByDate[0] || null;
  const shortCount = normalizedVideos.filter((video) => video.isShort).length;
  const cadenceDays = [];

  for (let i = 1; i < videosSortedByDate.length; i += 1) {
    const newer = new Date(videosSortedByDate[i - 1].publishedAt).getTime();
    const older = new Date(videosSortedByDate[i].publishedAt).getTime();
    const diff = (newer - older) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(diff) && diff >= 0) {
      cadenceDays.push(diff);
    }
  }

  const viewsArray = normalizedVideos.map((video) => video.views);
  const recentAvgViews = average(normalizedVideos, "views");
  const recentMedianViews = median(viewsArray);
  const avgLikes = average(normalizedVideos, "likes");
  const avgComments = average(normalizedVideos, "comments");
  const avgDurationSeconds = average(normalizedVideos, "durationSeconds");
  
  const engagementRate = recentAvgViews
    ? ((avgLikes + avgComments) / recentAvgViews) * 100
    : 0;
    
  const topRecentVideos = [...normalizedVideos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
    
  const avgDaysBetweenUploads = average(
    cadenceDays.map((value) => ({ value })),
    "value"
  );
  
  const shortRatio = normalizedVideos.length ? shortCount / normalizedVideos.length : 0;
  const contentProfile = classifyContentProfile(shortRatio, avgDurationSeconds);
  
  const estimated = estimateMonetization({
    recentAvgViews,
    avgDaysBetweenUploads,
    shortRatio,
    engagementRate,
    totalViews,
    totalVideos,
  });
  
  const uploadConsistencyScore = clamp(
    avgDaysBetweenUploads > 0 ? 100 - avgDaysBetweenUploads * 3 : 0,
    0,
    100
  );
  
  const growthScore = Math.round(
    clamp(
      recentAvgViews > 0 ? recentMedianViews / recentAvgViews : 0,
      0,
      1.2
    ) *
      35 +
      clamp(engagementRate * 6, 0, 30) +
      clamp(uploadConsistencyScore * 0.35, 0, 35)
  );

  return {
    channel: {
      id: channel.id,
      title: channel.snippet?.title || "",
      description: channel.snippet?.description || "",
      customUrl: channel.snippet?.customUrl || "",
      publishedAt: channel.snippet?.publishedAt || "",
      country: channel.snippet?.country || "",
      subscriberCount: Number(channel.statistics?.subscriberCount || 0),
      hiddenSubscriberCount: Boolean(channel.statistics?.hiddenSubscriberCount),
      videoCount: totalVideos,
      totalViews,
      thumbnail:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        "",
      banner:
        channel.brandingSettings?.image?.bannerExternalUrl ||
        channel.brandingSettings?.image?.bannerMobileExtraHdImageUrl ||
        "",
      uploadsPlaylistId:
        channel.contentDetails?.relatedPlaylists?.uploads || "",
    },
    publicMetrics: {
      avgViewsPerVideo,
      totalViews,
      totalVideos,
      lastUpdated:
        latestVideo?.publishedAt || channel.snippet?.publishedAt || null,
      hasShort: shortCount > 0,
      shortCount,
      shortRatio,
      recentAvgViews,
      recentMedianViews,
      avgLikes,
      avgComments,
      avgDurationSeconds,
      engagementRate,
      avgDaysBetweenUploads,
      contentProfile,
      uploadConsistencyScore,
      growthScore,
      growthBand: scoreToBand(growthScore),
      fetchedAt: new Date().toISOString(),
    },
    estimates: {
      ...estimated,
    },
    recentVideos: videosSortedByDate,
    topRecentVideos,
    chartFallback: videosSortedByDate
      .slice()
      .reverse()
      .map((video) => ({
        label: video.publishedAt ? video.publishedAt.slice(0, 10) : video.title,
        views: video.views,
        title: video.title,
      })),
    notes: [
      "Dữ liệu công khai có thể ước tính hiệu suất kênh nhưng không thể hiển thị doanh thu ẩn hoặc phân tích nhân khẩu học.",
      "RPM và doanh thu ước tính là những con số mô phỏng dựa trên phân tích từ đường dẫn.",
      "Xu hướng người đăng ký, RPM, địa lý, và độ tuổi/giới tính yêu cầu quyền truy cập YouTube Analytics từ chủ kênh.",
    ],
  };
}

export async function fetchAnalyticsReport({
  accessToken,
  ids,
  startDate,
  endDate,
  metrics,
  dimensions,
  sort,
  maxResults,
}: any) {
  const params = new URLSearchParams({
    ids,
    startDate,
    endDate,
    metrics,
  });

  if (dimensions) {
    params.set("dimensions", dimensions);
  }
  if (sort) {
    params.set("sort", sort);
  }
  if (maxResults) {
    params.set("maxResults", String(maxResults));
  }

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function mapRows(columns: any[] = [], rows: any[] = []) {
  return rows.map((row) =>
    columns.reduce((acc, column, index) => {
      acc[column.name] = row[index];
      return acc;
    }, {})
  );
}

export async function buildOwnerMetrics(payload: any) {
  const {
    accessToken,
    channelId,
    startDate: requestedStartDate,
    endDate: requestedEndDate,
  } = payload;
  const startDate =
    requestedStartDate ||
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const endDate = requestedEndDate || new Date().toISOString().slice(0, 10);

  if (!accessToken || !channelId) {
    throw new Error("Both accessToken and channelId are required.");
  }

  const ids = `channel==${channelId}`;
  const [timeseries, demographics, geography] = await Promise.all([
    fetchAnalyticsReport({
      accessToken,
      ids,
      startDate,
      endDate,
      metrics:
        "views,estimatedRevenue,subscribersGained,subscribersLost,watchTime",
      dimensions: "day",
      sort: "day",
    }),
    fetchAnalyticsReport({
      accessToken,
      ids,
      startDate,
      endDate,
      metrics: "viewerPercentage",
      dimensions: "ageGroup,gender",
      sort: "-viewerPercentage",
      maxResults: 50,
    }),
    fetchAnalyticsReport({
      accessToken,
      ids,
      startDate,
      endDate,
      metrics: "views,estimatedRevenue,watchTime",
      dimensions: "country",
      sort: "-views",
      maxResults: 20,
    }),
  ]);

  const timeRows = mapRows(timeseries.columnHeaders, timeseries.rows || []);
  const demoRows = mapRows(demographics.columnHeaders, demographics.rows || []);
  const geoRows = mapRows(geography.columnHeaders, geography.rows || []);

  const totals = timeRows.reduce(
    (acc: any, row: any) => {
      acc.views += Number(row.views || 0);
      acc.estimatedRevenue += Number(row.estimatedRevenue || 0);
      acc.subscribersGained += Number(row.subscribersGained || 0);
      acc.subscribersLost += Number(row.subscribersLost || 0);
      acc.watchTime += Number(row.watchTime || 0);
      return acc;
    },
    {
      views: 0,
      estimatedRevenue: 0,
      subscribersGained: 0,
      subscribersLost: 0,
      watchTime: 0,
    }
  );

  const rpm = totals.views ? (totals.estimatedRevenue / totals.views) * 1000 : 0;

  return {
    dateRange: { startDate, endDate },
    monetization: {
      estimatedRevenue: totals.estimatedRevenue,
      rpm,
    },
    audience: {
      netSubscribers: totals.subscribersGained - totals.subscribersLost,
      gained: totals.subscribersGained,
      lost: totals.subscribersLost,
    },
    demographics: demoRows,
    geography: geoRows,
    timeseries: timeRows,
  };
}
