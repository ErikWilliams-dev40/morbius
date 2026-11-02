"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  ExternalLink,
  FileCode2,
  FolderKanban,
  GitBranch,
  Infinity as InfinityIcon,
  Layers3,
  ListOrdered,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Monitor,
  Plug,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  companies,
  companyById,
  statuses,
  type ProjectDetail,
  type WorkspaceState,
} from "@/lib/domain";

import { api, ApiError } from "@/lib/client";
import { Development } from "@/components/development";

function CompanyMark({ id }: { id: string }) {
  const c = companyById(id);
  return (
    <span className="company-mark" style={{ color: c.color, background: c.tint }}>
      {c.initials}
    </span>
  );
}
function Status({ value }: { value: string }) {
  const s = statuses[value] || {
    label: value.replaceAll("_", " "),
    color: "bg-slate-100 text-slate-700",
  };
  return (
    <Badge
      variant="secondary"
      className={`gap-1.5 border-0 px-2.5 py-1 text-sm font-medium ${s.color}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </Badge>
  );
}
function date(time: number) {
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function time(time: number) {
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function Empty({
  icon: Icon = FolderKanban,
  title,
  text,
  children,
}: {
  icon?: typeof FolderKanban;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-muted-foreground">{text}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
const nav = [
  { id: "development", label: "Development", icon: GitBranch },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "queue", label: "Build queue", icon: ListOrdered },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "connections", label: "Connections", icon: Plug },
];

export default function Workspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [view, setView] = useState("projects");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [company, setCompany] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const ticking = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api<WorkspaceState>("/state");
      if (mounted.current) {
        setState(next);
        setError("");
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setState(null);
          setDetail(null);
        }
      }
    }
  }, []);
  const refreshDetail = useCallback(async (id: string) => {
    try {
      const next = await api<ProjectDetail>(`/projects/${id}`);
      if (selectedRef.current === id) {
        setDetail(next);
        setDetailError("");
      }
    } catch (e) {
      if (selectedRef.current === id) {
        setDetailError((e as Error).message);
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) setDetail(null);
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    async function initialize() {
      await refresh();
      const id = new URLSearchParams(window.location.search).get("project");
      if (id) {
        setSelected(id);
        selectedRef.current = id;
        await refreshDetail(id);
      }
    }
    void initialize();
    const timer = setInterval(() => {
      void refresh();
      if (selectedRef.current) void refreshDetail(selectedRef.current);
    }, 5000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh, refreshDetail]);
  useEffect(() => {
    if (
      !state?.jobs.some((j) => j.status === "queued" || j.status === "running") ||
      ticking.current
    )
      return;
    ticking.current = true;
    void api("/tick", {})
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        ticking.current = false;
      });
  }, [state]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  function go(next: string) {
    setView(next);
    setSelected(null);
    selectedRef.current = null;
    setDetailError("");
    window.history.replaceState({}, "", "/");
  }
  function openProject(id: string) {
    setSelected(id);
    selectedRef.current = id;
    setDetailError("");
    setView("projects");
    void refreshDetail(id);
    window.history.replaceState({}, "", `/?project=${id}`);
  }
  async function action(path: string, data: unknown, message: string) {
    setBusy(true);
    try {
      await api(path, data);
      setNotice(message);
      await refresh();
      if (selectedRef.current) await refreshDetail(selectedRef.current);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const visibleCompanies = companies.filter((c) => state?.user.companies.includes(c.id));
  const count = (status: string) => state?.projects.filter((p) => p.status === status).length || 0;
  const activeJobs = state?.jobs.filter((j) => ["queued", "running"].includes(j.status)) || [];
  const filtered = (state?.projects || []).filter(
    (p) =>
      (company === "all" || p.company === company) &&
      (filter === "all" ||
        (filter === "review" && ["review", "changes"].includes(p.status)) ||
        p.status === filter) &&
      `${p.title} ${p.brief}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SidebarProvider style={{ "--sidebar-width": "15.5rem" } as CSSProperties}>
      <Sidebar className="border-r-0">
        <SidebarHeader className="px-6 py-7">
          <button
            onClick={() => {
              go("projects");
              setCompany("all");
              setFilter("all");
            }}
            aria-label="Mobius home"
            className="flex items-center gap-3 text-white"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-[#344e79]">
              <InfinityIcon className="size-7" strokeWidth={2} />
            </span>
            <span className="text-[1.6rem] font-semibold tracking-tight">
              mobius<span className="text-blue-300">.</span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <SidebarGroup>
            <SidebarGroupLabel className="mb-2 text-xs text-slate-400">WORKSPACE</SidebarGroupLabel>
            <SidebarMenu className="gap-1.5">
              {nav.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    onClick={() => go(n.id)}
                    isActive={view === n.id}
                    className="h-11 px-3 text-[.95rem]"
                  >
                    <n.icon className="size-[1.1rem]" />
                    <span>{n.label}</span>
                    {n.id === "queue" && activeJobs.length > 0 && (
                      <span className="ml-auto rounded bg-white/10 px-1.5 text-sm">
                        {activeJobs.length}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-5">
            <SidebarGroupLabel className="mb-2 text-xs text-slate-400">
              YOUR COMPANIES
            </SidebarGroupLabel>
            <SidebarMenu>
              {visibleCompanies.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton
                    onClick={() => {
                      go("projects");
                      setCompany(c.id);
                    }}
                    className="h-10 px-3 text-sm"
                  >
                    <span className="size-2 rounded-full" style={{ background: c.tint }} />
                    <span>{c.short}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-4 p-5">
          <div className="rounded-xl border border-sidebar-border bg-white/[.035] px-3 py-3">
            <div className="flex items-center gap-2 text-sm text-white">
              <ShieldCheck className="size-4 text-blue-300" />
              Private workspace
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Project requests and decisions stay together.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-600 text-sm text-white">
              {(state?.user.name || "M").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {state?.user.name || "Your workspace"}
              </p>
              <p className="text-xs text-slate-400">{state?.user.role || "Sign-in required"}</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between gap-4 border-b bg-white/95 px-5 backdrop-blur md:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <span className="text-sm text-muted-foreground">Workspace</span>
            <ChevronRight className="size-4 text-slate-300" />
            <span className="truncate text-sm font-medium">
              {selected ? "Project review" : nav.find((n) => n.id === view)?.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <LockKeyhole className="size-3.5" />
              Private
            </span>
            <Button
              disabled={!state?.user.capabilities.canRequest}
              onClick={() => setNewOpen(true)}
              className="gap-2 shadow-sm"
            >
              <Plus className="size-4" />
              <span>New request</span>
            </Button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1550px] px-5 py-7 md:px-9 md:py-9">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
            >
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void refresh();
                  if (selected) void refreshDetail(selected);
                }}
              >
                Retry
              </Button>
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                {notice}
              </span>
              <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
                <X className="size-4" />
              </button>
            </div>
          )}
          {selected ? (
            detail?.project.id === selected ? (
              <ProjectReview
                key={selected}
                detail={detail}
                state={state}
                busy={busy}
                onBack={() => go("projects")}
                action={action}
                onConnections={() => go("connections")}
              />
            ) : (
              <div className="panel p-10 text-center">
                {detailError || (
                  <span className="inline-flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    Loading project…
                  </span>
                )}
              </div>
            )
          ) : (
            <>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow mb-2 text-primary">
                    {view === "projects"
                      ? "FROM IDEA TO IMPLEMENTATION"
                      : view === "queue"
                        ? "ONE BUILD AT A TIME"
                        : view === "companies"
                          ? "SIX COMPANIES, ONE WORKSPACE"
                          : view === "development"
                            ? "FROM PROTOTYPE TO RELEASE"
                            : "WORKSPACE SETUP"}
                  </p>
                  <h1 className="text-[1.85rem] font-semibold tracking-tight md:text-[2.1rem]">
                    {view === "projects"
                      ? "Let’s move things forward."
                      : view === "queue"
                        ? "Build queue"
                        : view === "companies"
                          ? "Your companies"
                          : view === "development"
                            ? "Development"
                            : "Connections"}
                  </h1>
                  <p className="mt-1.5 text-muted-foreground">
                    {view === "projects"
                      ? "Request a build. Review the demo. Give your developer a clear next step."
                      : view === "queue"
                        ? "A shared queue for new prototypes and revisions."
                        : view === "companies"
                          ? "Choose a company to see its projects and requests."
                          : view === "development"
                            ? "Follow your developer’s progress and open release decisions in Helix."
                            : "Connect the tools that carry your projects from idea to release."}
                  </p>
                </div>
                {view === "projects" && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers3 className="size-4" />
                    {visibleCompanies.length} companies
                  </span>
                )}
              </div>
              {view === "projects" && (
                <>
                  <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {[
                      {
                        label: "Active projects",
                        value: state?.projects.length || 0,
                        icon: FolderKanban,
                        filter: "all",
                        note: "Across your workspace",
                      },
                      {
                        label: "In the queue",
                        value: activeJobs.length,
                        icon: ListOrdered,
                        filter: "queued",
                        note: activeJobs.some((j) => j.status === "running")
                          ? "One build in progress"
                          : "Ready for the next request",
                      },
                      {
                        label: "Needs your review",
                        value: count("review") + count("changes"),
                        icon: MessageSquare,
                        filter: "review",
                        note: "Feedback moves work forward",
                      },
                      {
                        label: "With developers",
                        value: count("handed_off"),
                        icon: Code2,
                        filter: "handed_off",
                        note: "Production implementation",
                      },
                    ].map((k) => (
                      <button
                        key={k.label}
                        onClick={() => {
                          if (k.filter === "queued") go("queue");
                          else setFilter(k.filter);
                        }}
                        className="panel p-4 text-left transition-colors hover:border-blue-300 md:p-5"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
                          <span>{k.label}</span>
                          <k.icon className="size-4 text-slate-400" />
                        </div>
                        <div className="text-[2rem] font-semibold leading-none tracking-tight">
                          {state ? k.value : "—"}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">{k.note}</p>
                      </button>
                    ))}
                  </div>
                  {!state?.ai.configured && (
                    <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div>
                          <p className="font-medium">
                            Start with a request. Connect AI when you’re ready.
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            You can review an uploaded HTML prototype or try a clearly labeled
                            sample demo now.
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => go("connections")}>
                        Set up AI
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="grid gap-6 2xl:grid-cols-[1fr_300px]">
                    <section className="panel overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
                        <h2 className="text-lg font-semibold">
                          Projects{" "}
                          <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-sm text-muted-foreground">
                            {filtered.length}
                          </span>
                        </h2>
                        <div className="flex w-full flex-wrap gap-2 md:w-auto">
                          <Select value={company} onValueChange={setCompany}>
                            <SelectTrigger className="w-full bg-white sm:w-[190px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All companies</SelectItem>
                              {visibleCompanies.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.short}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="relative min-w-40 flex-1">
                            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <Input
                              aria-label="Search projects"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search projects"
                              className="bg-white pl-9"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="border-b px-5 pt-2">
                        <Tabs value={filter} onValueChange={setFilter}>
                          <TabsList
                            variant="line"
                            className="flex max-w-full justify-start overflow-x-auto"
                          >
                            <TabsTrigger value="all">All projects</TabsTrigger>
                            <TabsTrigger value="review">Needs review</TabsTrigger>
                            <TabsTrigger value="handed_off">With developer</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      {!state && !error ? (
                        <div className="p-12 text-center text-muted-foreground">
                          Loading your workspace…
                        </div>
                      ) : filtered.length === 0 ? (
                        <Empty
                          title={
                            search || company !== "all" || filter !== "all"
                              ? "No projects match these filters"
                              : "Your next project starts here"
                          }
                          text="Describe a new idea or a change to an existing project. Keep the request, prototype, and feedback in one place."
                        >
                          <Button
                            disabled={!state?.user.capabilities.canRequest}
                            onClick={() => setNewOpen(true)}
                          >
                            <Plus className="size-4" />
                            Create a request
                          </Button>
                        </Empty>
                      ) : (
                        <div className="divide-y">
                          {filtered.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => openProject(p.id)}
                              className="project-row flex w-full flex-wrap items-center gap-4 px-5 py-5 text-left"
                            >
                              <CompanyMark id={p.company} />
                              <div className="min-w-0 flex-1 basis-40">
                                <p className="font-semibold">{p.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {companyById(p.company).short}
                                  <span className="mx-2 text-slate-300">/</span>
                                  {p.kind === "new" ? "New project" : "Existing project"}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <Status value={p.status} />
                                <span className="hidden min-w-10 text-right text-sm text-muted-foreground lg:block">
                                  {p.version_count ? `v${p.version_count}` : "—"}
                                </span>
                                <ChevronRight className="size-4 text-slate-400" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                    <aside className="panel self-start p-5">
                      <div className="mb-5 flex items-center gap-2">
                        <Clock3 className="size-4 text-muted-foreground" />
                        <h2 className="font-semibold">Latest activity</h2>
                      </div>
                      {!state?.activity.length ? (
                        <div className="py-6 text-sm leading-6 text-muted-foreground">
                          Build requests, feedback, and approvals will appear here as work moves
                          forward.
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {state.activity.slice(0, 6).map((a) => (
                            <button
                              key={a.id}
                              onClick={() => openProject(a.project_id)}
                              className="block w-full border-l-2 border-blue-100 pl-3 text-left"
                            >
                              <p className="text-sm">{a.text}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {date(a.created_at)} · {a.actor}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-6 border-t pt-4 text-sm text-muted-foreground">
                        <span className="mb-1 block font-medium text-foreground">
                          Approval has a clear boundary.
                        </span>
                        A prototype approval sends a direction to your developer. Production release
                        follows your Helix checks.
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {view === "queue" && (
                <Queue state={state} onProject={openProject} action={action} busy={busy} />
              )}
              {view === "companies" && (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {visibleCompanies.map((c) => (
                    <article key={c.id} className="panel flex flex-col p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <CompanyMark id={c.id} />
                        <Badge variant="outline" className="font-normal">
                          {state?.projects.filter((p) => p.company === c.id).length || 0} projects
                        </Badge>
                      </div>
                      <h2 className="text-lg font-semibold">{c.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{c.platform}</p>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-2 break-all text-sm text-primary"
                      >
                        {c.url.replace("https://", "")}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                      <div className="mt-6 flex items-center justify-between border-t pt-4">
                        <span className="text-xs text-muted-foreground">
                          Website connection pending
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            go("projects");
                            setCompany(c.id);
                          }}
                        >
                          View projects
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {view === "development" && <Development />}
              {view === "connections" && <Connections state={state} busy={busy} action={action} />}
            </>
          )}
        </div>
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 px-5 pb-5 text-xs text-muted-foreground md:px-9">
          <span>Mobius · Early access</span>
          <span>Prototypes use sample data. Production work stays with your developer.</span>
        </footer>
      </SidebarInset>
      <NewRequest
        key={`${company}-${state?.user.companies.join("-")}`}
        assignedCompanies={state?.user.companies || []}
        open={newOpen}
        onOpenChange={setNewOpen}
        company={company}
        onCreated={async (id) => {
          setNewOpen(false);
          await refresh();
          openProject(id);
          setNotice("Project request saved.");
        }}
      />
    </SidebarProvider>
  );
}

function NewRequest({
  assignedCompanies,
  open,
  onOpenChange,
  company,
  onCreated,
}: {
  assignedCompanies: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company: string;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    company: company === "all" ? assignedCompanies[0] || "" : company,
    kind: "new",
    title: "",
    brief: "",
    criteria: "",
    reference: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const p = await api<{ id: string }>("/projects", form);
      setForm({ ...form, title: "", brief: "", criteria: "", reference: "" });
      onCreated(p.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[660px]">
        <DialogHeader>
          <DialogTitle className="text-xl">What should we build?</DialogTitle>
          <DialogDescription>
            Describe the outcome you want. This becomes the brief for your prototype and developer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={form.company} onValueChange={(v) => setForm({ ...form, company: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies
                    .filter((c) => assignedCompanies.includes(c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.short}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type of work</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New project</SelectItem>
                  <SelectItem value="change">Change to an existing project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-title">Project name</Label>
            <Input
              id="request-title"
              required
              maxLength={140}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. A simpler product discovery experience"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-brief">What should change, and why?</Label>
            <Textarea
              id="request-brief"
              required
              minLength={10}
              maxLength={12000}
              rows={5}
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              placeholder="Who is this for? What should they be able to do? Describe the screens and interactions you want to review."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-criteria">
              What would make this a success?{" "}
              <span className="font-normal text-muted-foreground">Optional</span>
            </Label>
            <Textarea
              id="request-criteria"
              rows={3}
              maxLength={5000}
              value={form.criteria}
              onChange={(e) => setForm({ ...form, criteria: e.target.value })}
              placeholder="e.g. Customers can filter, compare two products, and add one to a sample cart."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-reference">
              Existing page or reference link{" "}
              <span className="font-normal text-muted-foreground">
                {form.kind === "new" ? "Optional" : "Recommended"}
              </span>
            </Label>
            <Input
              id="request-reference"
              type="url"
              maxLength={2000}
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="https://"
            />
            <p className="text-xs text-muted-foreground">
              Saved for context. Add relevant page details to the brief; links are not imported
              automatically.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Save request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Action = (path: string, data: unknown, message: string) => Promise<boolean>;
function ProjectReview({
  detail,
  state,
  busy,
  onBack,
  action,
  onConnections,
}: {
  detail: ProjectDetail;
  state: WorkspaceState | null;
  busy: boolean;
  onBack: () => void;
  action: Action;
  onConnections: () => void;
}) {
  const { project: p, versions, comments, activity } = detail;
  const [versionId, setVersionId] = useState("");
  const [mobile, setMobile] = useState(false);
  const [comment, setComment] = useState("");
  const [revision, setRevision] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [tab, setTab] = useState("prototype");
  const [uploadError, setUploadError] = useState("");
  const [copyText, setCopyText] = useState("Copy review link");
  const inputRef = useRef<HTMLInputElement>(null);
  const v = versions.find((v) => v.id === versionId) || versions[0];
  const active = state?.jobs.find(
    (j) => j.project_id === p.id && ["running", "queued"].includes(j.status),
  );
  const newest = v?.id === versions[0]?.id;
  const canApprove = state?.user.capabilities.canApprovePrototype && v && newest && !active;
  const canBuild = state?.user.capabilities.canBuild;
  const [issueUrl, setIssueUrl] = useState(p.issue_url);
  async function upload(file?: File) {
    if (!file) return;
    setUploadError("");
    if (file.size > 500000) {
      setUploadError("Use a self-contained HTML file smaller than 500 KB.");
      return;
    }
    try {
      const html = await file.text();
      await action(
        `/projects/${p.id}/upload`,
        { html, label: file.name },
        "Prototype uploaded. The new version is ready for review.",
      );
      setVersionId("");
    } catch (e) {
      setUploadError((e as Error).message);
    }
    if (inputRef.current) inputRef.current.value = "";
  }
  async function feedback(changes = false) {
    if (
      await action(
        `/projects/${p.id}/feedback`,
        { versionId: v.id, body: comment, changes },
        changes ? "Changes requested for this version." : "Feedback added.",
      )
    )
      setComment("");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?project=${p.id}`);
      setCopyText("Link copied");
      setTimeout(() => setCopyText("Copy review link"), 2500);
    } catch {
      setCopyText("Copy this page’s address");
    }
  }
  return (
    <>
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        All projects
      </button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <CompanyMark id={p.company} />
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{companyById(p.company).name}</span>
              <span>·</span>
              <span>{p.kind === "new" ? "New project" : "Existing project change"}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{p.title}</h1>
          </div>
        </div>
        <Status value={p.status} />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          disabled={busy || !canBuild || !!active || !state?.ai.configured || !p.issue_url}
          onClick={() => {
            if (versions.length) setRevisionOpen(true);
            else
              void action(
                `/projects/${p.id}/enqueue`,
                { mode: "ai", prompt: "" },
                "Prototype added to the build queue.",
              );
          }}
        >
          <Sparkles className="size-4" />
          {versions.length ? "Request AI revision" : "Build with AI"}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !canBuild || !!active}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Upload prototype
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          aria-label="Upload HTML prototype"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button variant="ghost" onClick={copy}>
          <LockKeyhole className="size-4" />
          {copyText}
        </Button>
        {!state?.ai.configured && (
          <Button variant="link" onClick={onConnections}>
            Connect AI
          </Button>
        )}
      </div>
      {uploadError && (
        <p role="alert" className="mb-4 text-red-700">
          {uploadError}
        </p>
      )}
      {active && (
        <div role="status" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="font-medium">
              {active.status === "queued" ? "Your request is in the queue" : active.phase}
            </p>
          </div>
          <p className="ml-8 mt-1 text-sm text-muted-foreground">
            Previous versions remain available while this request is processed.
          </p>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="prototype">
                Prototype {versions.length > 0 && `(${versions.length})`}
              </TabsTrigger>
              <TabsTrigger value="brief">Project brief</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="handoff">Developer handoff</TabsTrigger>
            </TabsList>
            <TabsContent value="prototype">
              <section className="panel overflow-hidden">
                {v ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                      <Select value={v.id} onValueChange={setVersionId}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {versions.map((x) => (
                            <SelectItem key={x.id} value={x.id}>
                              Version {x.number} ·{" "}
                              {x.source === "sample"
                                ? "Sample demo"
                                : x.source === "upload"
                                  ? "Uploaded"
                                  : "AI prototype"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant={!mobile ? "secondary" : "ghost"}
                          aria-label="Desktop preview"
                          onClick={() => setMobile(false)}
                        >
                          <Monitor className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={mobile ? "secondary" : "ghost"}
                          aria-label="Mobile preview"
                          onClick={() => setMobile(true)}
                        >
                          <Smartphone className="size-4" />
                        </Button>
                        <Button asChild size="icon" variant="ghost">
                          <a
                            href={`/preview/${v.id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open prototype in a new tab"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="border-b bg-slate-50 px-4 py-2 text-xs text-muted-foreground">
                      {v.source === "sample"
                        ? "Sample demo · Template-based example, not generated from your brief"
                        : `Version ${v.number} · ${v.label}`}
                      <span className="ml-2">· Simulated interactions</span>
                    </div>
                    <div className="flex min-h-[600px] justify-center bg-slate-100 p-2 md:p-4">
                      <iframe
                        key={v.id}
                        src={`/preview/${v.id}`}
                        title={`${p.title} version ${v.number}`}
                        sandbox="allow-scripts"
                        referrerPolicy="no-referrer"
                        className={`min-h-[600px] rounded-lg border bg-white shadow-sm ${mobile ? "w-[390px] max-w-full" : "w-full"}`}
                      />
                    </div>
                  </>
                ) : (
                  <Empty
                    icon={Monitor}
                    title="Your prototype will appear here"
                    text="Generate a demo from your brief once AI is connected, or upload a self-contained HTML prototype to start reviewing."
                  >
                    <Button
                      variant="outline"
                      disabled={busy || !canBuild || !!active}
                      onClick={() =>
                        void action(
                          `/projects/${p.id}/enqueue`,
                          { mode: "sample", prompt: "" },
                          "Sample demo added to the queue.",
                        )
                      }
                    >
                      <Monitor className="size-4" />
                      Try a sample demo
                    </Button>
                  </Empty>
                )}
              </section>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                Review links currently open only for the workspace owner. Invited external review
                requires the email access integration.
              </p>
            </TabsContent>
            <TabsContent value="brief">
              <section className="panel space-y-6 p-6">
                <div>
                  <h2 className="mb-3 font-semibold">The request</h2>
                  <p className="prose-copy">{p.brief}</p>
                </div>
                <div className="border-t pt-5">
                  <h3 className="mb-3 font-semibold">Acceptance criteria</h3>
                  <p className="prose-copy text-muted-foreground">
                    {p.criteria || "No additional criteria provided."}
                  </p>
                </div>
                {p.reference && (
                  <div className="border-t pt-5">
                    <h3 className="mb-2 font-semibold">Reference</h3>
                    <a
                      href={p.reference}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-primary underline"
                    >
                      {p.reference}
                    </a>
                  </div>
                )}
                <p className="border-t pt-4 text-sm text-muted-foreground">
                  Requested by {p.created_by} on {date(p.created_at)}
                </p>
              </section>
            </TabsContent>
            <TabsContent value="activity">
              <section className="panel p-6">
                <h2 className="mb-6 font-semibold">Project history</h2>
                <div className="space-y-6">
                  {activity.map((a) => (
                    <div key={a.id} className="border-l-2 border-blue-100 pl-4">
                      <p>{a.text}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.actor} · {time(a.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="handoff">
              <section className="panel space-y-5 p-6">
                <div className="flex items-start gap-3">
                  <Code2 className="mt-1 size-6 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">Give your developer the full picture</h2>
                    <p className="mt-1 text-muted-foreground">
                      Export the brief, prototype history, feedback, and recorded decisions.
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline">
                  <a href={`/api/mobius/projects/${p.id}/handoff`} download>
                    <ArrowDownToLine className="size-4" />
                    Download handoff brief
                  </a>
                </Button>
                {v && (
                  <Button asChild variant="outline" className="ml-0 sm:ml-2">
                    <a href={`/preview/${v.id}?download=1`} download>
                      <FileCode2 className="size-4" />
                      Download version {v.number}
                    </a>
                  </Button>
                )}
                <div className="space-y-3 rounded-xl bg-muted p-4">
                  <div className="flex justify-between gap-4">
                    <span>Prototype direction</span>
                    <span
                      className={p.approved_version ? "text-emerald-700" : "text-muted-foreground"}
                    >
                      {p.approved_version ? "Approved" : "Awaiting approval"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Technical review</span>
                    <span className="text-muted-foreground">GitHub not connected</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Production release</span>
                    <span className="text-muted-foreground">Not authorized here</span>
                  </div>
                </div>
                <Button
                  disabled={
                    busy ||
                    !canBuild ||
                    !p.issue_url ||
                    !p.approved_version ||
                    !!active ||
                    p.status === "handed_off"
                  }
                  onClick={() =>
                    void action(
                      `/projects/${p.id}/handoff`,
                      {},
                      "Project marked as handed to your developer.",
                    )
                  }
                >
                  <Send className="size-4" />
                  {p.status === "handed_off"
                    ? "Handed to developer"
                    : "Mark as handed to developer"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  This records a handoff. Share the downloaded files with your developer; Mobius
                  does not send them yet. Copy the handoff record to the linked work item before
                  development begins. Release decisions stay in the Helix dashboard.
                </p>
              </section>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="space-y-5">
          <section className="panel p-5">
            <h2 className="font-semibold">Work item</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Link the open GitHub issue before AI work or developer handoff. You can explore the
              sample workflow first.
            </p>
            {p.issue_url ? (
              <a
                href={p.issue_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block break-all text-sm text-primary underline"
              >
                Open linked work item
              </a>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    `/projects/${p.id}/issue`,
                    { issueUrl },
                    "Work item verified and linked.",
                  );
                }}
              >
                <Label htmlFor="work-item">GitHub issue URL</Label>
                <Input
                  id="work-item"
                  type="url"
                  required
                  maxLength={500}
                  value={issueUrl}
                  onChange={(e) => setIssueUrl(e.target.value)}
                  placeholder="https://github.com/…/issues/…"
                  disabled={!canBuild}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy || !canBuild || !state?.helix.configured}
                >
                  Verify and link
                </Button>
              </form>
            )}
          </section>
          <section className="panel p-5">
            <h2 className="mb-2 font-semibold">Your decision</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {v
                ? `Review version ${v.number} and tell the team what should happen next.`
                : "Add a prototype to begin the review."}
            </p>
            {v && p.approved_version === v.id ? (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Version {v.number} is approved for developer implementation.
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={busy || !canApprove || v?.source === "sample"}
                onClick={() =>
                  void action(
                    `/projects/${p.id}/approve`,
                    { versionId: v.id },
                    `Version ${v.number} approved for developer implementation.`,
                  )
                }
              >
                <Check className="size-4" />
                Approve prototype
              </Button>
            )}
            {v?.source === "sample" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Sample demos are for trying the workflow. Upload or generate a project prototype to
                approve it.
              </p>
            )}
            {v && !newest && (
              <p className="mt-3 text-sm text-amber-800">Select the latest version to approve.</p>
            )}
            <div className="mt-5 border-t pt-4">
              <Label htmlFor="feedback">Feedback{v ? ` on version ${v.number}` : ""}</Label>
              <Textarea
                id="feedback"
                className="mt-2"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={6000}
                disabled={!v}
                placeholder="What works? What should change?"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !v || !comment.trim()}
                  onClick={() => void feedback()}
                >
                  <MessageSquare className="size-3.5" />
                  Add feedback
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    busy ||
                    !state?.user.capabilities.canApprovePrototype ||
                    !v ||
                    !newest ||
                    !!active ||
                    !comment.trim()
                  }
                  onClick={() => void feedback(true)}
                >
                  Request changes
                </Button>
              </div>
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="mb-4 font-semibold">
              Conversation{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {comments.filter((c) => c.version_id === v?.id).length}
              </span>
            </h2>
            {!comments.some((c) => c.version_id === v?.id) ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Feedback stays attached to the version you reviewed.
              </p>
            ) : (
              <div className="space-y-5">
                {comments
                  .filter((c) => c.version_id === v?.id)
                  .map((c) => (
                    <div key={c.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <p className="mb-1 break-all text-xs font-semibold text-muted-foreground">
                        {c.author} · {date(c.created_at)}
                      </p>
                      <p className="prose-copy text-sm">{c.body}</p>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What should change?</DialogTitle>
            <DialogDescription>
              Your developer can still access previous versions. AI will use the latest version and
              the feedback on it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Revision instructions"
            rows={6}
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            maxLength={6000}
            placeholder="Describe the changes you want to see…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !canBuild || !revision.trim()}
              onClick={async () => {
                if (
                  await action(
                    `/projects/${p.id}/enqueue`,
                    { mode: "ai", prompt: revision },
                    "Revision added to the build queue.",
                  )
                ) {
                  setRevisionOpen(false);
                  setRevision("");
                  setVersionId("");
                }
              }}
            >
              Queue revision
              <ArrowRight className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Queue({
  state,
  onProject,
  action,
  busy,
}: {
  state: WorkspaceState | null;
  onProject: (id: string) => void;
  action: Action;
  busy: boolean;
}) {
  const [confirmJob, setConfirmJob] = useState<string | null>(null);
  const jobs = state?.jobs || [];
  const pending = jobs
    .filter((j) => ["running", "queued"].includes(j.status))
    .sort((a, b) =>
      a.status === "running" ? -1 : b.status === "running" ? 1 : a.created_at - b.created_at,
    );
  const history = jobs.filter((j) => !["running", "queued"].includes(j.status));
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm leading-6 text-muted-foreground">
          Mobius processes one build at a time while this workspace is open. AI work already
          submitted continues with the provider; reopening Mobius collects the result and advances
          the queue. Continuous scheduling will be connected with your agent host.
        </p>
      </div>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-semibold">
            Up next <span className="ml-2 text-muted-foreground">{pending.length}</span>
          </h2>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`step-dot ${pending.some((j) => j.status === "running") ? "bg-blue-500" : "bg-slate-300"}`}
            />
            {pending.some((j) => j.status === "running") ? "Building" : "Ready"}
          </span>
        </div>
        {!pending.length ? (
          <Empty
            icon={ListOrdered}
            title="The queue is clear"
            text="Open a project to request an AI prototype, queue a revision, or try a sample demo."
          />
        ) : (
          <div className="divide-y">
            {pending.map((j, i) => {
              const p = state?.projects.find((p) => p.id === j.project_id);
              return (
                <div key={j.id} className="flex flex-wrap items-center gap-4 p-5">
                  <span className="mono grid size-9 place-items-center rounded-full border text-sm text-muted-foreground">
                    {j.status === "running" ? <Loader2 className="size-4 animate-spin" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <button
                      onClick={() => onProject(j.project_id)}
                      className="font-semibold hover:text-primary"
                    >
                      {p?.title || "Project"}
                    </button>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {j.phase} · {j.mode === "sample" ? "Sample demo" : "AI prototype"}
                    </p>
                    {j.status === "running" && !j.error && (
                      <div className="mt-3 max-w-sm">
                        <span className="text-xs text-muted-foreground">
                          Stage{" "}
                          {j.phase.includes("Saving") ? 3 : j.phase.includes("Generating") ? 2 : 1}{" "}
                          of 3
                        </span>
                        <Progress
                          aria-label="Current build stage out of three"
                          value={
                            j.phase.includes("Saving")
                              ? 100
                              : j.phase.includes("Generating")
                                ? 67
                                : 33
                          }
                          className="mt-1 h-1.5"
                        />
                      </div>
                    )}
                    {j.error && <p className="mt-2 text-sm text-amber-800">{j.error}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !state?.user.capabilities.canBuild}
                    onClick={() => {
                      if (j.phase === "Confirm provider status") setConfirmJob(j.id);
                      else void action(`/jobs/${j.id}/cancel`, {}, "Build request cancelled.");
                    }}
                  >
                    {j.phase === "Confirm provider status" ? "Resolve" : "Cancel"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {history.length > 0 && (
        <section className="panel overflow-hidden">
          <h2 className="border-b p-5 font-semibold">Recent builds</h2>
          <div className="divide-y">
            {history.map((j) => (
              <div key={j.id} className="flex flex-wrap items-start gap-3 p-5">
                {j.status === "complete" ? (
                  <CheckCircle2 className="mt-1 size-5 text-emerald-600" />
                ) : (
                  <XCircle className="mt-1 size-5 text-slate-400" />
                )}
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onProject(j.project_id)}
                    className="font-medium hover:text-primary"
                  >
                    {state?.projects.find((p) => p.id === j.project_id)?.title}
                  </button>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {j.status === "complete"
                      ? "Ready for review"
                      : j.status === "failed"
                        ? "Build failed"
                        : "Cancelled"}{" "}
                    · {date(j.created_at)}
                  </p>
                  {j.error && <p className="mt-2 text-sm text-red-700">{j.error}</p>}
                </div>
                {j.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busy ||
                      !state?.user.capabilities.canBuild ||
                      pending.some((p) => p.project_id === j.project_id)
                    }
                    onClick={() =>
                      void action(
                        `/projects/${j.project_id}/enqueue`,
                        { mode: j.mode, prompt: j.prompt },
                        "Request returned to the queue.",
                      )
                    }
                  >
                    Retry build
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialog
        open={!!confirmJob}
        onOpenChange={(v) => {
          if (!v) setConfirmJob(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm the provider has stopped</DialogTitle>
            <DialogDescription>
              Mobius could not confirm whether this build was accepted. Check your AI provider’s
              activity first. Clearing the request allows the next build to start.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmJob(null)}>
              Keep queue paused
            </Button>
            <Button
              disabled={busy || !state?.user.capabilities.canBuild}
              onClick={async () => {
                if (
                  await action(
                    `/jobs/${confirmJob}/cancel`,
                    { confirmedStopped: true },
                    "Request cleared after provider status confirmation.",
                  )
                )
                  setConfirmJob(null);
              }}
            >
              I confirmed it has stopped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Connections({
  state,
  busy,
  action,
}: {
  state: WorkspaceState | null;
  busy: boolean;
  action: Action;
}) {
  const [chosenModel, setModel] = useState<string | null>(null);
  const model = chosenModel || state?.ai.model || "gpt-5.6-sol";
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <section className="panel p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">AI prototype builder</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate interactive HTML demos from your project brief.
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={state?.ai.configured ? "bg-emerald-50 text-emerald-800" : ""}
            >
              {state?.ai.configured ? "Configured" : "Not connected"}
            </Badge>
          </div>
          <div className="mb-5 rounded-xl bg-muted p-4">
            <p className="font-medium">Set up through your technical admin</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your admin approves the AI service and adds its credential through the approved
              runtime secret manager. API keys are never entered into this workspace.
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await action("/settings/ai", { model }, "Model access verified and saved.");
            }}
          >
            <div className="space-y-2">
              <Label>Build model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-5.6-sol">GPT-5.6 Sol</SelectItem>
                  <SelectItem value="gpt-5.6-terra">GPT-5.6 Terra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={busy || !state?.user.capabilities.canManage || !state?.ai.configured}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              Verify and save model
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              Each build sends the project brief, current prototype, and version feedback to the
              approved AI provider. API usage is billed to that provider account. Responses are
              retained for resuming work; Mobius requests deletion after collection. The provider’s
              retention policy applies.
            </p>
          </form>
        </section>
        {[
          {
            icon: GitBranch,
            name: "Helix GitHub",
            desc: "Repository context, developer handoffs, technical checks, and release approvals.",
            next: "The supplied Helix workflow is integrated in code. Your admin can connect approved read access and assign company repositories; release decisions stay in Helix.",
            state: state?.helix.configured ? "Configured" : "Awaiting connection",
          },
          {
            icon: InfinityIcon,
            name: "Hermes / Hostinger",
            desc: "Continuous queue scheduling and a company-aware agent coordinator.",
            next: "Hermes is under consideration. Your first requests and prototype reviews can begin here.",
            state: "Not set up",
          },
          {
            icon: LockKeyhole,
            name: "Team & external reviewers",
            desc: "Access for authorized staff and email-verified invited reviewers.",
            next: "Staff access follows configured identity, company assignments, and separate action permissions. Project-specific external invitations are still pending.",
            state: state?.access.mode === "helix" ? "Helix identity" : "Private review",
          },
        ].map((c) => (
          <section key={c.name} className="panel p-6">
            <div className="flex items-start gap-3">
              <c.icon className="mt-1 size-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{c.name}</h2>
                  <Badge variant="outline" className="font-normal">
                    {c.state}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
                <p className="mt-4 border-t pt-3 text-sm">{c.next}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
      <aside className="panel p-6">
        <h2 className="mb-4 font-semibold">First release scope</h2>
        <ul className="space-y-4 text-sm">
          {[
            "New projects and existing-project changes",
            "One build at a time, with visible status",
            "Versioned clickable demos and feedback",
            "Prototype approval and developer handoff",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t pt-5">
          <h3 className="mb-2 text-sm font-semibold">Operating estimate</h3>
          <p className="text-2xl font-semibold">
            $150–$500<span className="text-sm font-normal text-muted-foreground"> / month</span>
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Preliminary planning range for 26–100 requests weekly. Excludes existing subscriptions
            and developer labor. Actual model usage is unmeasured; heavier requests can exceed this
            range.
          </p>
        </div>
        <div className="mt-6 border-t pt-5">
          <h3 className="mb-2 text-sm font-semibold">Later modules</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Reporting, email, Slack, content, payments, domains, and social tools will connect to
            this workspace after the build and review workflow.
          </p>
        </div>
      </aside>
    </div>
  );
}
