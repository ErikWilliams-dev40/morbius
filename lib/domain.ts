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
] as const;
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
export type WorkspaceState = {
  user: User;
  projects: Project[];
  jobs: Job[];
  activity: Activity[];
  ai: { configured: boolean; model: string };
  access: { private: boolean; externalReviewers: boolean; mode: "helix" | "sites_owner" };
  helix: { configured: boolean };
};
export type ProjectDetail = {
  project: Project;
  versions: Version[];
  comments: Comment[];
  activity: Activity[];
};
