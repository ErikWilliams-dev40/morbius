import type { User } from "./access.ts";
export const companies = [
  {
    id: "helix",
    name: "House of Helix Peptides",
    short: "House of Helix",
    initials: "HH",
    color: "#4a3fb0",
    tint: "#edeaff",
    url: "https://houseofhelixpeptides.com",
    platform: "React / HTML / CSS",
  },
  {
    id: "sequence",
    name: "Advanced Sequence",
    short: "Advanced Sequence",
    initials: "AS",
    color: "#08796e",
    tint: "#def5f0",
    url: "https://advancedsequence.com",
    platform: "WordPress",
  },
  {
    id: "halo",
    name: "Halo Protocol",
    short: "Halo Protocol",
    initials: "HP",
    color: "#265acb",
    tint: "#e5edff",
    url: "https://haloprotocol.com",
    platform: "Node.js / HTML / CSS",
  },
  {
    id: "inca",
    name: "Inca Trail Terpenes",
    short: "Inca Trail",
    initials: "IT",
    color: "#9a6011",
    tint: "#fff0d4",
    url: "https://incatrailterpenes.com",
    platform: "Shopify",
  },
  {
    id: "smoke",
    name: "Smoke Show Labs",
    short: "Smoke Show",
    initials: "SS",
    color: "#b14452",
    tint: "#ffe8ed",
    url: "https://smokeshowlabs.com",
    platform: "Shopify",
  },
  {
    id: "tiger",
    name: "Easy Tiger Botanicals",
    short: "Easy Tiger",
    initials: "ET",
    color: "#aa531c",
    tint: "#fff0e4",
    url: "https://easytigerbotanicals.com",
    platform: "To be decided",
  },
  {
    id: "terpenes",
    name: "All Things Terpenes",
    short: "All Things Terpenes",
    initials: "AT",
    color: "#4d7a1f",
    tint: "#ecf6dc",
    url: "https://all-things-terpenes-staging.dev40.workers.dev",
    platform: "Cloudflare Workers",
  },
  {
    id: "pepintel",
    name: "Pep Intel",
    short: "Pep Intel",
    initials: "PI",
    color: "#2f6f9f",
    tint: "#e2f0fa",
    url: "https://pep-intel.dev40.workers.dev",
    platform: "Cloudflare Workers",
  },
  {
    id: "dopemade",
    name: "Dope Made",
    short: "Dope Made",
    initials: "DM",
    color: "#7a3a9a",
    tint: "#f4e6fb",
    url: "https://dope-made-staging.dev40.workers.dev",
    platform: "Cloudflare Workers",
  },
  {
    id: "sugarmenu",
    name: "Sugar Menu",
    short: "Sugar Menu",
    initials: "SM",
    color: "#b0377a",
    tint: "#fde6f2",
    url: "https://sugarmenu-preview.dev40.workers.dev",
    platform: "Cloudflare Workers",
  },
] as const;
// Live and staging websites shown on the Companies view. `company` is set only
// where the site's owning company is known; any others are listed as unassigned.
export const sites: { label: string; url: string; stage: string; company: string | null }[] = [
  {
    label: "House of Helix Peptides",
    url: "https://houseofhelixpeptides.com/",
    stage: "Live",
    company: "helix",
  },
  {
    label: "Advanced Sequence",
    url: "https://advancedsequence.com/",
    stage: "Live",
    company: "sequence",
  },
  {
    label: "Smoke Show",
    url: "https://smokeshow-web-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "smoke",
  },
  {
    label: "All Things Terpenes",
    url: "https://all-things-terpenes-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "terpenes",
  },
  {
    label: "Pep Intel",
    url: "https://pep-intel.dev40.workers.dev/",
    stage: "Preview",
    company: "pepintel",
  },
  {
    label: "Dope Made",
    url: "https://dope-made-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "dopemade",
  },
  {
    label: "Sugar Menu",
    url: "https://sugarmenu-preview.dev40.workers.dev/",
    stage: "Preview",
    company: "sugarmenu",
  },
];
export const companyById = (id: string) => companies.find((c) => c.id === id) || companies[0];
export const statuses: Record<string, { label: string; color: string }> = {
  requested: { label: "Requested", color: "bg-slate-100 text-slate-700" },
  queued: { label: "Queued", color: "bg-blue-50 text-blue-700" },
  building: { label: "Building", color: "bg-blue-100 text-blue-800" },
  review: { label: "Needs review", color: "bg-amber-50 text-amber-800" },
  changes: { label: "Changes requested", color: "bg-orange-50 text-orange-800" },
  approved: { label: "Prototype approved", color: "bg-emerald-50 text-emerald-800" },
  handed_off: { label: "With developer", color: "bg-violet-50 text-violet-700" },
};
export type Project = {
  id: string;
  company: string;
  title: string;
  kind: string;
  brief: string;
  criteria: string;
  reference: string;
  issue_url: string;
  status: string;
  approved_version: string | null;
  created_at: number;
  updated_at: number;
  created_by: string;
  version_count?: number;
  latest_version?: string | null;
};
export type Version = {
  id: string;
  project_id: string;
  number: number;
  label: string;
  source: string;
  storage_key: string;
  digest: string;
  created_at: number;
  created_by: string;
  prompt: string;
};
export type Job = {
  id: string;
  project_id: string;
  mode: string;
  prompt: string;
  status: string;
  phase: string;
  error: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  lease: string | null;
  actor: string;
};
export type Comment = {
  id: string;
  project_id: string;
  version_id: string;
  body: string;
  author: string;
  created_at: number;
};
export type Activity = {
  id: string;
  project_id: string;
  text: string;
  actor: string;
  created_at: number;
};
export type Invitation = {
  id: string;
  project_id: string;
  version_id: string;
  email: string;
  created_by: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
};
export type WorkspaceState = {
  user: User;
  projects: Project[];
  jobs: Job[];
  activity: Activity[];
  ai: { configured: boolean; model: string };
  access: {
    private: boolean;
    externalReviewers: boolean;
    mode: "helix" | "sites_owner" | "open";
  };
  helix: { configured: boolean };
};
export type ProjectDetail = {
  project: Project;
  versions: Version[];
  comments: Comment[];
  activity: Activity[];
  invitations: Invitation[];
};
