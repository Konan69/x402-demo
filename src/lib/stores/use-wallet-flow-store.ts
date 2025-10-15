import { nanoid } from "nanoid";
import { create } from "zustand";
import type { WalletSnapshot } from "@/types/wallet";

export type WalletFlowPhase =
  | "idle"
  | "initiated"
  | "holding"
  | "releasing"
  | "settled"
  | "failed";

export type WalletFlowSnapshot = WalletSnapshot;

type WalletFlowEvent = {
  id: string;
  timestamp: number;
  label: string;
  tone: "info" | "success" | "error";
};

type TimelineEvent =
  | { type: "start"; snapshot: WalletFlowSnapshot }
  | { type: "phase"; phase: WalletFlowPhase }
  | { type: "balances"; snapshot: WalletFlowSnapshot }
  | { type: "complete"; snapshot: WalletFlowSnapshot }
  | { type: "error"; message?: string };

type WalletFlowStore = WalletFlowSnapshot & {
  phase: WalletFlowPhase;
  isAnimating: boolean;
  isHydrated: boolean;
  hasError: boolean;
  errorMessage?: string;
  timelineVersion: number;
  events: WalletFlowEvent[];
  lastEvent?: TimelineEvent;
  startFlow: (snapshot: WalletFlowSnapshot) => void;
  setPhase: (phase: WalletFlowPhase) => void;
  updateBalances: (snapshot: WalletFlowSnapshot) => void;
  completeFlow: (snapshot: WalletFlowSnapshot) => void;
  failFlow: (message?: string) => void;
  setError: (message: string) => void;
  reset: () => void;
  setHydrated: () => void;
  logEvent: (event: { label: string; tone?: WalletFlowEvent["tone"] }) => void;
};

const cloneSnapshot = (snapshot: WalletFlowSnapshot): WalletFlowSnapshot => ({
  buyer: { ...snapshot.buyer },
  seller: { ...snapshot.seller },
});

const EVENT_HISTORY_LIMIT = 24;

const appendEvent = (
  events: WalletFlowEvent[],
  event: WalletFlowEvent
): WalletFlowEvent[] => {
  const nextEvents =
    events.length >= EVENT_HISTORY_LIMIT
      ? [...events.slice(-(EVENT_HISTORY_LIMIT - 1)), event]
      : [...events, event];
  return nextEvents;
};

const pushEvent = (
  events: WalletFlowEvent[],
  event: Omit<WalletFlowEvent, "id">
) =>
  appendEvent(events, {
    ...event,
    id: nanoid(),
  });

const INITIAL_SNAPSHOT: WalletFlowSnapshot = {
  buyer: { address: "", balance: 0 },
  seller: { address: "", balance: 0 },
};

export const useWalletFlowStore = create<WalletFlowStore>((set, get) => ({
  ...INITIAL_SNAPSHOT,
  phase: "idle",
  isAnimating: false,
  isHydrated: false,
  hasError: false,
  errorMessage: undefined,
  timelineVersion: 0,
  events: [],
  lastEvent: undefined,
  startFlow: (snapshot) => {
    const timestamp = Date.now();
    set((state) => ({
      ...cloneSnapshot(snapshot),
      phase: "initiated",
      isAnimating: true,
      isHydrated: true,
      hasError: false,
      errorMessage: undefined,
      timelineVersion: state.timelineVersion + 1,
      lastEvent: { type: "start", snapshot },
      events: pushEvent(state.events, {
        timestamp,
        label: "Transaction initiated",
        tone: "info",
      }),
    }));
  },
  setPhase: (phase) => {
    if (get().phase === phase) {
      return;
    }
    const timestamp = Date.now();
    set((state) => ({
      phase,
      lastEvent: { type: "phase", phase },
      events: pushEvent(state.events, {
        timestamp,
        label:
          phase === "holding"
            ? "Authorization approved"
            : phase === "releasing"
            ? "Deliverables under review"
            : phase === "settled"
            ? "Funds released to seller"
            : phase === "failed"
            ? "Transaction failed"
            : "Flow updated",
        tone:
          phase === "failed"
            ? "error"
            : phase === "settled"
            ? "success"
            : "info",
      }),
    }));
  },
  updateBalances: (snapshot) => {
    const timestamp = Date.now();
    set((state) => ({
      ...cloneSnapshot(snapshot),
      isHydrated: true,
      lastEvent: { type: "balances", snapshot },
      events: pushEvent(state.events, {
        timestamp,
        label: "Balances refreshed",
        tone: "info",
      }),
    }));
  },
  completeFlow: (snapshot) => {
    const timestamp = Date.now();
    set((state) => ({
      ...cloneSnapshot(snapshot),
      phase: "settled",
      isAnimating: false,
      isHydrated: true,
      lastEvent: { type: "complete", snapshot },
      events: pushEvent(state.events, {
        timestamp,
        label: "Transaction settled successfully",
        tone: "success",
      }),
    }));
  },
  failFlow: (message) => {
    const timestamp = Date.now();
    const current = cloneSnapshot(get());
    set((state) => ({
      ...current,
      phase: "failed",
      isAnimating: false,
      isHydrated: true,
      timelineVersion: state.timelineVersion + 1,
      lastEvent: { type: "error", message },
      events: pushEvent(state.events, {
        timestamp,
        label: message ?? "Transaction failed",
        tone: "error",
      }),
    }));
  },
  reset: () => {
    const current = cloneSnapshot(get());
    set({
      ...current,
      phase: "idle",
      isAnimating: false,
      isHydrated: get().isHydrated,
      timelineVersion: get().timelineVersion + 1,
      events: [],
      lastEvent: undefined,
    });
  },
  setHydrated: () => {
    set({ isHydrated: true });
  },
  setError: (message: string) => {
    set({ hasError: true, errorMessage: message, isHydrated: true });
  },
  logEvent: ({ label, tone = "info" }) => {
    const timestamp = Date.now();
    set((state) => ({
      events: pushEvent(state.events, {
        timestamp,
        label,
        tone,
      }),
    }));
  },
}));
