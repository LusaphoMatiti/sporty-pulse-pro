// src/api/api.ts
import * as SecureStore from "expo-secure-store";
import type { ApiSuccess, ApiError } from "../../types/api"; // see note below

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

// ─── Session token helpers ────────────────────────────────────────────────────

const SESSION_KEY = "sp_session_token";

export async function storeSessionToken(token: string) {
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

// npm install e

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

async function request<T = unknown>(
  path: string,
  { method = "GET", body, headers = {} }: RequestOptions = {},
): Promise<T> {
  const token = await getSessionToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json: ApiSuccess<T> | ApiError = await response.json();

  // All routes now return { success, data | error }
  if (!json.success) {
    throw new ApiRequestError(
      json.error.code,
      json.error.message,
      response.status,
    );
  }

  return json.data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ─── Typed endpoint helpers ───────────────────────────────────────────────────

import type { SessionDraft } from "../../types/session";

export function saveDraft(instanceId: string, draft: SessionDraft | null) {
  return api.post("/api/session/draft", { instanceId, draft });
}

export function getEquipment() {
  return api.get<{
    equipment: { id: string; name: string; category: string }[];
  }>("/api/equipment");
}

export function completeSession(payload: {
  instanceId: string;
  sessionNumber: number;
  durationSeconds: number;
  completed: boolean;
  logs: {
    plannedExerciseId: string;
    actualSets: number;
    actualReps: number;
    weightKg?: number;
  }[];
}) {
  return api.post(
    "/api/session/complete",
    payload as unknown as Record<string, unknown>,
  );
}

export function getUserProfile() {
  return api.get("/api/user/profile");
}

export function activateProgram(
  planId: string,
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
) {
  return api.post("/api/programs/activate", { planId, level });
}

export function logRecovery(payload: {
  sleepHours?: number;
  sleepQuality: number;
  muscleSoreness: number;
  stressLevel: number;
}) {
  return api.post<{ recoveryPct: number }>("/api/recovery/log", payload);
}

// ─── Signed upload ────────────────────────────────────────────────────────────
// Use this instead of putting your Cloudinary API secret in the app.
//
// Usage:
//   const uri = "file:///...";
//   const url = await uploadToCloudinary(uri, "avatars");

export async function uploadToCloudinary(
  fileUri: string,
  folder: "avatars" | "recovery" = "avatars",
): Promise<string> {
  // 1. Get a short-lived signed params from our server
  const sig = await api.post<{
    signature: string;
    timestamp: number;
    public_id: string;
    folder: string;
    apiKey: string;
    cloudName: string;
  }>("/api/upload/sign", { folder });

  // 2. Upload directly to Cloudinary — API secret never in the app
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "image/jpeg",
    name: "upload.jpg",
  } as unknown as Blob);
  formData.append("signature", sig.signature);
  formData.append("timestamp", String(sig.timestamp));
  formData.append("api_key", sig.apiKey);
  formData.append("public_id", sig.public_id);
  formData.append("folder", sig.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await res.json();
  return data.secure_url as string;
}

export interface RecoveryLog {
  sleepHours?: number;
  sleepQuality: number;
  muscleSoreness: number;
  stressLevel: number;
}
