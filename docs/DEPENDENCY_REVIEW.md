# Dependency review — 2026-11-01 remediation (P0.1)

`npm audit` went from 30 advisories (1 critical, 9 high, 20 moderate) to
**zero**. No `npm audit fix --force` was run and no advisory was suppressed.
This records the reachable-path analysis `CLAUDE.md` requires before any
version bump: what executes in the Worker versus build/dev machines.

## Where each package class executes

| Class | Packages | Runs where |
| --- | --- | --- |
| Worker runtime | `next` (App Router conventions at runtime), `react`, `react-dom`, `react-server-dom-webpack`, `zod`, `drizzle-orm`, `@hookform/resolvers` + UI libs | Deployed Cloudflare Worker — **reachable in production** |
| Build toolchain | `vite`, `vinext`, `wrangler`, `miniflare`, `sharp` (via miniflare), `@cloudflare/vite-plugin`, `@vercel/og` → `satori` → `fflate` (via vinext) | Build machine / CI runner only — never in the deployed Worker |
| Dev / CI tooling | `eslint` chain (`minimatch`, `fast-uri`, `brace-expansion`, `source-map-js`), `prettier`, `drizzle-kit`, `typescript` | Developer machines and CI lint jobs only |

## Changes made

**Same-major upgrades, verified by build and the full test suite:**

| Package | From | To | Advisory class |
| --- | --- | --- | --- |
| `next` | 16.3.4 | 16.4.3 | critical — runtime dependency, fixed first |
| `vite` | 8.2.2 | 8.3.5 | high — build only |
| `wrangler` | 4.129.0 | 4.156.1 | high — build only; also fixed `miniflare`/`sharp`/`undici` |
| `@cloudflare/vite-plugin` | 1.54.4 | 1.67.0 | high — build only |
| `zod` | 3.25.76 | 4.6.7 | high — runtime; the only fix published is 4.x, so this was reviewed as its own change. The API surface used in `lib/server.ts` (z.object/z.string/z.enum/z.uuid/z.boolean, `.refine`, `.parse`, `.default`, `ZodError.issues`) is unchanged in v4 |

**`overrides` (the manifest already pinned `esbuild` this way; same reviewed
mechanism):**

| Override | Why | Risk contained by |
| --- | --- | --- |
| `minimatch: ^11.0.1` | DoS advisories (<11.0.1) in the eslint glob chain; npm's only "fix" was a nonsense downgrade to eslint 4 | `npm run lint` exercises the entire eslint stack |
| `satori: ^0.33.5` | SVG-escaping advisory (<0.33.5) under vinext's OG-image stack; the app never generates OG images and the stack is build-time only | build + full test suite |
| `fflate: ^0.7.5` | unzipSync infinite-loop advisory, pulled in transitively by the satori upgrade | build + full test suite |

`npm audit fix` (without `--force`) applied in-range transitive fixes
(`brace-expansion`, `source-map-js`, `fast-uri`, others) before the overrides
were considered.

## Follow-up

Each `override` is a temporary pin. Remove it when the upstream consumer
(`eslint-plugin-*`/`@typescript-eslint` for minimatch; `@vercel/og` for satori
and fflate) releases a fixed range, and re-run the verification set below.

Verification set for any future dependency change:
`npm run format:check && npm run lint && npm run typecheck` and
`npm test` (which builds then runs the suite against built output), followed
by `npm audit --audit-level=low` expecting zero findings.
