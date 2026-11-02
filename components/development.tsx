"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, GitBranch, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import type { DevelopmentState } from "@/lib/helix";

const labels = {
  in_progress: "In progress",
  ready_for_review: "In technical review",
  awaiting_decision: "Ready for a decision",
  blocked: "Blocked",
};

export function Development() {
  const [data, setData] = useState<DevelopmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  useEffect(() => {
    let active = true;
    void api<DevelopmentState>("/helix/projects").then(
      (result) => {
        if (active) {
          setData(result);
          setError("");
          setLoading(false);
        }
      },
      (error: Error) => {
        if (active) {
          setData(null);
          setError(error.message);
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [refreshToken]);
  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold">Development stays connected to Helix</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Testing, technical review, and release decisions come from the existing engineering
            workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setError("");
              setRefreshToken((value) => value + 1);
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}{" "}
            Refresh
          </Button>
          <Button asChild>
            <a
              href={data?.dashboardUrl || "https://helix.helixcmd.com"}
              target="_blank"
              rel="noreferrer"
            >
              Open Helix dashboard <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {loading && !data && (
        <p role="status" className="p-8 text-center text-muted-foreground">
          Loading development status…
        </p>
      )}
      {data && data.connection !== "connected" && (
        <section className="panel p-8">
          <GitBranch className="mb-4 size-7 text-primary" />
          <h2 className="text-lg font-semibold">
            {data.connection === "mapping_required"
              ? "Assign the repositories for your companies"
              : "Connect Helix project status"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {data.connection === "mapping_required"
              ? "Your technical admin needs to assign the company repositories before they can appear here."
              : "Your technical admin can connect approved GitHub read access. The Helix dashboard is available above while this connection is being prepared."}
          </p>
        </section>
      )}
      {data?.connection === "connected" && (
        <>
          <p className="text-sm text-muted-foreground">
            GitHub status retrieved {new Date(data.generatedAt!).toLocaleString()}. Refresh before
            making a decision in Helix.
          </p>
          {!data.projects.length && (
            <p className="panel p-8 text-muted-foreground">
              No active projects were returned for your assigned repositories.
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            {data.projects.map((p) => (
              <article key={p.repository} className="panel p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{p.displayName}</h2>
                  <Badge variant="secondary">{labels[p.status]}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{p.latestUpdate}</p>
                <div className="my-5 flex flex-wrap gap-2">
                  {[
                    ["Testing", p.testsPassed],
                    ["Technical review", p.reviewed],
                    ["Preview", p.previewReady],
                  ].map(([label, passed]) => (
                    <span
                      key={String(label)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${passed ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {passed && <Check className="size-3" />}
                      {label}: {passed ? "confirmed" : "pending"}
                    </span>
                  ))}
                </div>
                {p.previewUrl ? (
                  <Button asChild variant="outline">
                    <a href={p.previewUrl} target="_blank" rel="noreferrer">
                      View developer preview <ExternalLink className="size-4" />
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No developer preview is available yet.
                  </p>
                )}
                <details className="mt-5 border-t pt-4 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Technical details
                  </summary>
                  <div className="mt-3 space-y-2">
                    <a
                      className="block text-primary underline"
                      href={p.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.repository}
                    </a>
                    {p.activePullRequest && (
                      <a
                        className="block text-primary underline"
                        href={p.activePullRequest.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Pull request #{p.activePullRequest.number}
                      </a>
                    )}
                    <p>Developer: {p.developer || "Not assigned"}</p>
                    {p.activePullRequest && (
                      <p className="break-all text-xs">Commit: {p.activePullRequest.commitSha}</p>
                    )}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
