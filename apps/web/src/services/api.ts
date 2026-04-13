import type { ApiResponse, ApiError } from "@/types";
import { supabase } from "@/lib/supabase";

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const authHeaders: Record<string, string> = {};
  if (session?.access_token) {
    authHeaders["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    // FastAPI returns {"detail": "..."}, our convention is {"error": "..."} — handle both
    const errorMessage =
      (body as ApiError).error ?? body.detail ?? `Request failed with status ${res.status}`;

    if (res.status === 409) {
      throw new DuplicateError(errorMessage);
    }

    throw new Error(errorMessage);
  }

  return (body as ApiResponse<T>).data;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export async function postFile<T>(path: string, file: File): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const formData = new FormData();
  formData.append("file", file);

  const { data: { session } } = await supabase.auth.getSession();
  const authHeaders: Record<string, string> = {};
  if (session?.access_token) {
    authHeaders["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: { ...authHeaders },
  });

  const body = await res.json();

  if (!res.ok) {
    const errorMessage =
      (body as ApiError).error ?? body.detail ?? `Request failed with status ${res.status}`;
    throw new Error(errorMessage);
  }

  return (body as ApiResponse<T>).data;
}

export const api = { get, post, put, patch, del, postFile };
