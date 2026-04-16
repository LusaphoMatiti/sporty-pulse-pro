"use client";

import { useMemo } from "react";

export type WeightMap = Record<string, number>;

export function weightStorageKey(instanceId: string, sessionNumber: number) {
  return `sp_weights_${instanceId}_${sessionNumber}`;
}

export function useSessionWeights(
  instanceId: string,
  sessionNumber: number,
): WeightMap {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem(
        weightStorageKey(instanceId, sessionNumber),
      );
      if (!raw) return {};
      return JSON.parse(raw) as WeightMap;
    } catch {
      return {};
    }
  }, [instanceId, sessionNumber]);
}

export function clearSessionWeights(instanceId: string, sessionNumber: number) {
  try {
    localStorage.removeItem(weightStorageKey(instanceId, sessionNumber));
  } catch {
    // ignore
  }
}
