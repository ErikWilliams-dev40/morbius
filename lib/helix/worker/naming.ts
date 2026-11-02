/**
 * Project-name normalization and validation.
 *
 * Pure functions, no I/O, so they are cheap to test exhaustively. Jack types a
 * friendly name; GitHub needs a slug. The friendly value is preserved separately
 * as displayName — we never show him the slug as if it were his input.
 */

/** Repository names Helix owns. A project may never take one of these. */
export const RESERVED_NAMES = [
  "helix-engineering",
  "helix-control-plane",
  "helix-project-template",
] as const;

/** GitHub's own limit is 100; 60 keeps names readable and URLs sane. */
export const MAX_SLUG_LENGTH = 60;
const MAX_INPUT_LENGTH = 200;

export type NameValidation =
  | { ok: true; slug: string; displayName: string }
  | { ok: false; code: "name_invalid" | "name_reserved"; message: string };

/**
 * Convert a friendly name to a GitHub repository slug.
 *
 * Deliberately strict: anything outside [a-z0-9-] is dropped rather than
 * transliterated, because a silently-mangled name is worse than a rejection.
 * Control characters, path separators and dots are removed outright, which also
 * makes path traversal (`../`) impossible by construction.
 */
export function toSlug(input: string): string {
  return (
    input
      .normalize("NFKD")
      // Strip combining marks left by NFKD so "é" becomes "e", not "e" + mark.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Any run of non-alphanumerics collapses to a single hyphen. This covers
      // spaces, underscores, slashes, dots and control characters in one rule.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      // Slicing can leave a trailing hyphen.
      .replace(/-+$/, "")
  );
}

/** Tidy the human-facing name without changing its meaning. */
export function toDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function validateProjectName(raw: unknown): NameValidation {
  if (typeof raw !== "string") {
    return { ok: false, code: "name_invalid", message: "Project name must be text." };
  }

  const displayName = toDisplayName(raw);

  if (displayName.length === 0) {
    return { ok: false, code: "name_invalid", message: "Enter a project name." };
  }

  if (displayName.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      code: "name_invalid",
      message: `Project name must be ${MAX_INPUT_LENGTH} characters or fewer.`,
    };
  }

  const slug = toSlug(displayName);

  if (slug.length === 0) {
    return {
      ok: false,
      code: "name_invalid",
      message: "Project name must contain at least one letter or number.",
    };
  }

  // A purely numeric slug is legal on GitHub but reads as an id, not a project.
  if (/^\d+$/.test(slug)) {
    return {
      ok: false,
      code: "name_invalid",
      message: "Project name needs at least one letter.",
    };
  }

  if ((RESERVED_NAMES as readonly string[]).includes(slug)) {
    return {
      ok: false,
      code: "name_reserved",
      message: "That name is reserved for a Helix system project.",
    };
  }

  return { ok: true, slug, displayName };
}

/**
 * Derive a readable name from a slug, for projects created outside Helix that
 * carry no `.helix/project.json`.
 */
export function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Accept a preview URL only if it is a well-formed absolute https URL.
 * http, other schemes, and anything unparseable are rejected — we never
 * present an unvalidated URL as a preview.
 */
export function validatePreviewUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname || url.hostname === "localhost") return null;
  return url.toString();
}

/**
 * Extract a preview URL from a PR body.
 *
 * Only an explicit `Preview: <https url>` marker counts. Arbitrary links
 * elsewhere in the body are ignored — a link in prose is not a declaration
 * that a preview exists.
 */
export function parsePreviewMarker(body: string | null | undefined): string | null {
  if (!body) return null;
  const match = body.match(/^[ \t>*-]*preview[ \t]*:[ \t]*(\S+)/im);
  return match ? validatePreviewUrl(match[1]) : null;
}
