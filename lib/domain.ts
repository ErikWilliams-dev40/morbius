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
  {
    id: "terphero",
    name: "Terp Hero",
    short: "Terp Hero",
    initials: "TH",
    color: "#8a6a00",
    tint: "#fbf1cf",
    url: "https://terp-hero-staging.dev40.workers.dev",
    platform: "Cloudflare Workers",
  },
] as const;
export type SiteStage = "Live" | "Staging" | "Preview";
export type Site = {
  id: string;
  label: string;
  url: string;
  stage: SiteStage;
  /** Owning company slot; `null` only for a site with no company yet. */
  company: string | null;
};
const stageOrder: Record<SiteStage, number> = { Live: 0, Staging: 1, Preview: 2 };
// Every existing website link, one entry per deployment. `companies[].url` is a
// company's primary domain, so it appears here as that company's live site once
// the domain serves one. Easy Tiger Botanicals has a registered domain that is
// still parked, so it has no site entry and no linked projects yet. The
// Companies view, the Websites panel, and the request form all read this one
// list, so a link added here reaches project functionality without a second edit.
export const sites: Site[] = [
  {
    id: "helix-live",
    label: "House of Helix Peptides",
    url: "https://houseofhelixpeptides.com/",
    stage: "Live",
    company: "helix",
  },
  {
    id: "sequence-live",
    label: "Advanced Sequence",
    url: "https://advancedsequence.com/",
    stage: "Live",
    company: "sequence",
  },
  {
    id: "halo-live",
    label: "Halo Protocol",
    url: "https://haloprotocol.com/",
    stage: "Live",
    company: "halo",
  },
  {
    id: "inca-live",
    label: "Inca Trail Terpenes",
    url: "https://incatrailterpenes.com/",
    stage: "Live",
    company: "inca",
  },
  {
    id: "smoke-live",
    label: "Smoke Show",
    url: "https://smokeshowlabs.com/",
    stage: "Live",
    company: "smoke",
  },
  {
    id: "smoke-staging",
    label: "Smoke Show staging",
    url: "https://smokeshow-web-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "smoke",
  },
  {
    id: "terpenes-staging",
    label: "All Things Terpenes",
    url: "https://all-things-terpenes-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "terpenes",
  },
  {
    id: "dopemade-staging",
    label: "Dope Made",
    url: "https://dope-made-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "dopemade",
  },
  {
    id: "pepintel-preview",
    label: "Pep Intel",
    url: "https://pep-intel.dev40.workers.dev/",
    stage: "Preview",
    company: "pepintel",
  },
  {
    id: "sugarmenu-preview",
    label: "Sugar Menu",
    url: "https://sugarmenu-preview.dev40.workers.dev/",
    stage: "Preview",
    company: "sugarmenu",
  },
  {
    id: "terphero-staging",
    label: "Terp Hero",
    url: "https://terp-hero-staging.dev40.workers.dev/",
    stage: "Staging",
    company: "terphero",
  },
];
/** A site URL without its trailing slash, lowercased, for comparison. */
export const siteUrlKey = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();
/** A company's sites, live first, then staging, then preview. */
export const sitesForCompany = (companyId: string) =>
  sites
    .filter((s) => s.company === companyId)
    .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage] || a.label.localeCompare(b.label));
/** The site a new request starts from: the live one when there is one. */
export const primarySiteFor = (companyId: string) => sitesForCompany(companyId)[0] ?? null;
export const siteByUrl = (url: string) => {
  const key = siteUrlKey(url);
  return key ? (sites.find((s) => siteUrlKey(s.url) === key) ?? null) : null;
};
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
  access: { private: boolean; externalReviewers: boolean; mode: "helix" | "sites_owner" };
  helix: { configured: boolean };
};
export type ProjectDetail = {
  project: Project;
  versions: Version[];
  comments: Comment[];
  activity: Activity[];
  invitations: Invitation[];
};
