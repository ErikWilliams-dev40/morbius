export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/mobius${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      result.error || "Unable to complete that action. Please try again.",
    );
  return result;
}
