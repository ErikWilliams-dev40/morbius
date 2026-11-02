/** Read-only metadata helper adapted from the supplied Helix source. */
import { GitHubClient, ORG } from "./client.ts";

export async function readJsonFile<T>(
  client: GitHubClient,
  slug: string,
  path: string,
): Promise<T | null> {
  try {
    const { status, data } = await client.rest<{ content?: string }>(
      `/repos/${ORG}/${slug}/contents/${path}`,
      { allowStatuses: [404] },
    );
    if (status === 404 || !data?.content) return null;
    return JSON.parse(atob(data.content.replace(/\n/g, ""))) as T;
  } catch {
    return null;
  }
}
