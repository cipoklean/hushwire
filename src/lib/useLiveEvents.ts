"use client";

import { useEffect, useRef, useState } from "react";
import type { ChainEvent } from "@/types";

export interface LiveEventsState {
  events: ChainEvent[] | null; // null = not loaded yet / error
  windowed: boolean;
  updatedAt: number | null;
}

/**
 * Polls /api/events for real Coston2 activity. Used by the landing page
 * "LIVE INTERCEPT" feed and the activity ticker. Polls every 12s; the
 * server always reads fresh chain state.
 */
export function useLiveEvents(pollMs = 12_000): LiveEventsState {
  const [state, setState] = useState<LiveEventsState>({
    events: null,
    windowed: false,
    updatedAt: null,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (!res.ok) throw new Error(`events ${res.status}`);
        const data = await res.json();
        if (cancelled || !mounted.current) return;
        setState({
          events: Array.isArray(data.events) ? data.events : [],
          windowed: Boolean(data.windowed),
          updatedAt: Date.now(),
        });
      } catch {
        if (cancelled || !mounted.current) return;
        setState((prev) => ({ ...prev, events: prev.events ?? [] }));
      }
    };

    load();
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      mounted.current = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return state;
}
