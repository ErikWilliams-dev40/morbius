import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";

export type DevVars = Record<string, string>;

/** `.dev.vars` is Wrangler's KEY=VALUE file; comments and blank lines are ignored. */
export function readDevVars(root: string): DevVars {
  let text: string;
  try {
    text = readFileSync(resolve(root, ".dev.vars"), "utf8");
  } catch {
    return {};
  }
  const vars: DevVars = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    vars[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Only a request addressed to this machine may receive the local identity. */
export function isLoopbackRequest(request: IncomingMessage): boolean {
  const host = (request.headers.host ?? "").toLowerCase();
  const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return LOOPBACK_HOSTS.has(name);
}

/**
 * The hosted Sites preview injects `oai-authenticated-user-*` on every request,
 * which is how the Worker identifies a `sites_owner` session. `vite dev` sits
 * behind no such proxy, so without this the workspace answers 401 to every
 * browser request and nothing beyond the sign-in message can be clicked.
 *
 * Dev-only by construction: `apply: "serve"` keeps it out of the build, it needs
 * `MOBIUS_AUTH_MODE=sites_owner` in `.dev.vars`, and it refuses any request whose
 * Host is not loopback, so it cannot stand in for authentication anywhere else.
 */
export function devIdentity(): Plugin {
  return {
    name: "mobius-dev-identity",
    apply: "serve",
    configureServer(server) {
      const vars = readDevVars(server.config.root);
      if (vars.MOBIUS_AUTH_MODE !== "sites_owner") {
        server.config.logger.warn(
          "Mobius: no `.dev.vars` sites_owner identity, so the workspace will report a sign-in error. See README, Local development.",
        );
        return;
      }
      const id = vars.MOBIUS_REVIEW_OWNER_ID || "local-dev";
      const email = vars.MOBIUS_DEV_EMAIL || "dev@localhost";
      server.middlewares.use((request, _response, next) => {
        if (isLoopbackRequest(request)) {
          request.headers["oai-authenticated-user-id"] = id;
          request.headers["oai-authenticated-user-email"] = email;
        }
        next();
      });
    },
  };
}
