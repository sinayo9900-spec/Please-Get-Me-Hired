export interface JobPosting {
  id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  employmentType?: string;
  description: string;
  postedAt?: string;
  collectedAt: string;
  matchScore?: number;
  matchReason?: string;
  summary?: string;
  tags?: string[];
}

export const APPLICATION_STATUSES = [
  'bookmarked',
  'applied',
  'assignment',
  'interview',
  'offer',
  'rejected',
  'closed',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  bookmarked: '관심',
  applied: '지원',
  assignment: '과제',
  interview: '면접',
  offer: '오퍼',
  rejected: '불합격',
  closed: '종료',
};

export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt?: string;
  nextActionAt?: string;
  notes?: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  roles: string[];
  keywords: { include: string[]; exclude: string[] };
  locations: string[];
  matchThreshold: number;
  email: { to: string; maxItems: number };
  updatedAt: string;
}

export interface EmailRun {
  id: string;
  runDate: string;
  jobCount: number;
  success: boolean;
  error?: string;
  createdAt: string;
}

export interface Source {
  id: string;
  name: string;
  type: 'api' | 'html';
  request: { url: string; method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string };
  select: { list: string; fields: Record<string, string> };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  jobsByDate: { date: string; count: number }[];
  jobsBySource: { source: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  totals: { jobs: number; applications: number; runs: number };
}
