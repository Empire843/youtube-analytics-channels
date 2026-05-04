export interface YoutubeChannel {
  channelId: string;
  title: string;
  thumbnail: string;
  customUrl: string;
  country: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  description: string;
}

export interface ChannelDna {
  topic: string;
  contentStyle: string;
  tone: string;
  searchQueries: string[];
  language: string;
}

export interface CompetitorSource extends YoutubeChannel, ChannelDna {}

export interface Competitor extends YoutubeChannel {
  publishedAt: string;
  hiddenSubscriberCount: boolean;
}

export interface CompetitorResponse {
  source: CompetitorSource;
  competitors: Competitor[];
}

export interface HistoryEntry {
  id: string;
  channelId: string;
  analyzedAt: string;
  channel: any;
  publicMetrics: any;
  estimates: any;
  insights: any;
}

export interface PromptVariable {
  name: string;
  purpose: string;
  suggestedType: string;
}

export interface PromptAnalysis {
  suggestedTitle: string;
  summary: string;
  primaryGroup: string;
  groups: string[];
  tags: string[];
  useCases: string[];
  qualityNotes: string[];
  risks: string[];
  variables: PromptVariable[];
}

export interface PromptLibraryEntry {
  id: string;
  title: string;
  prompt: string;
  renderedPrompt: string;
  analysis: PromptAnalysis;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  filePath?: string;
  relativePath?: string;
}
