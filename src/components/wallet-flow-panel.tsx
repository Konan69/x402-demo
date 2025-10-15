"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Wallet,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletFlowClientSync } from "@/components/wallet-flow-client-sync";
import {
  useWalletFlowStore,
  type WalletFlowPhase,
} from "@/lib/stores/use-wallet-flow-store";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const phaseOrder: WalletFlowPhase[] = [
  "initiated",
  "holding",
  "releasing",
  "settled",
];

const phaseCopy: Record<
  WalletFlowPhase,
  { label: string; caption: string; tone: "info" | "success" | "error" }
> = {
  idle: {
    label: "Awaiting Transaction",
    caption: "Trigger a payment to view the live wallet flow.",
    tone: "info",
  },
  initiated: {
    label: "Initiated",
    caption: "Buyer has authorised the transfer.",
    tone: "info",
  },
  holding: {
    label: "Authorization Approved",
    caption: "Payment authorization captured. Preparing verification.",
    tone: "info",
  },
  releasing: {
    label: "Releasing",
    caption: "Verification in progress before funds are released.",
    tone: "info",
  },
  settled: {
    label: "Settled",
    caption: "Seller wallet has received the payout.",
    tone: "success",
  },
  failed: {
    label: "Failed",
    caption: "Flow interrupted. No funds were moved.",
    tone: "error",
  },
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type WalletRole = "buyer" | "seller";

type WalletSummaryProps = {
  walletRole: WalletRole;
  balance: number;
  address?: string;
  status: string;
  highlight?: boolean;
  isLoading?: boolean;
};

const walletRoleCopy: Record<WalletRole, { title: string; icon: ReactNode }> = {
  buyer: {
    title: "Agent Wallet",
    icon: <Wallet className="size-4" />,
  },
  seller: {
    title: "Seller Wallet",
    icon: <ShieldCheck className="size-4" />,
  },
};

const formatAddress = (address?: string) => {
  if (!address) {
    return "Wallet pending";
  }
  const start = address.slice(0, 6);
  const end = address.slice(-4);
  return `${start}…${end}`;
};

const WalletSummaryCard = ({
  walletRole,
  balance,
  address,
  status,
  highlight,
  isLoading = false,
}: WalletSummaryProps) => {
  const { title, icon } = walletRoleCopy[walletRole];
  return (
    <Card
      className={cn(
        "rounded-xl border border-white/10 bg-background/70 py-0 shadow-none transition-colors",
        highlight
          ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_20px_45px_-35px_rgba(16,185,129,0.45)]"
          : undefined
      )}
    >
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.18em]">
          <span className="inline-flex h-8 w-8 items-center justify-center border border-white/10 bg-background/60">
            {icon}
          </span>
          {title}
        </CardTitle>
        <CardDescription className="text-foreground/70 text-sm">
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <span className="font-semibold text-foreground text-xl tabular-nums">
              {currency.format(balance)}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-4">
        <div className="flex flex-col gap-1.5 text-foreground/60 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground/70">Status</span>
            {isLoading ? (
              <Skeleton className="h-4 w-16 rounded-full" />
            ) : (
              <Badge className="rounded-full text-[0.65rem]" variant="outline">
                {status}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground/70">Address</span>
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span className="font-mono text-xs">
                {formatAddress(address)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const WalletErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <Card className="rounded-xl border border-red-500/20 bg-red-500/5 py-4 shadow-none">
    <CardContent className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <div className="text-red-400 text-sm">Unable to load wallet data</div>
      <div className="max-w-[200px] text-foreground/60 text-xs">{message}</div>
      <Button className="text-xs" onClick={onRetry} size="sm" variant="outline">
        Retry
      </Button>
    </CardContent>
  </Card>
);

const ACTIVITY_LOG_LIMIT = 10;

const timelineIcons: Record<WalletFlowPhase, ReactNode> = {
  idle: <Sparkles className="size-4" />,
  initiated: <Sparkles className="size-4" />,
  holding: <Clock3 className="size-4" />,
  releasing: <ArrowRight className="size-4" />,
  settled: <CheckCircle2 className="size-4" />,
  failed: <ShieldX className="size-4" />,
};

const getProgressRatio = (phase: WalletFlowPhase) => {
  if (phase === "idle") {
    return 0;
  }
  if (phase === "failed") {
    const releasingIndex = phaseOrder.indexOf("releasing");
    return releasingIndex === -1
      ? 0.75
      : (releasingIndex + 1) / phaseOrder.length;
  }
  const index = phaseOrder.indexOf(phase);
  if (index === -1) {
    return 0;
  }
  return (index + 1) / phaseOrder.length;
};

const resolveStageState = (
  phaseKey: WalletFlowPhase,
  currentPhase: WalletFlowPhase
) => {
  if (currentPhase === "failed") {
    const failureIndex = phaseOrder.indexOf("releasing");
    const stageIndex = phaseOrder.indexOf(phaseKey);
    return {
      isActive: stageIndex === failureIndex,
      isComplete:
        failureIndex !== -1
          ? stageIndex !== -1 && stageIndex < failureIndex
          : false,
      isFailed: stageIndex === failureIndex,
    };
  }

  const activeIndex = phaseOrder.indexOf(currentPhase);
  const stageIndex = phaseOrder.indexOf(phaseKey);
  if (activeIndex === -1 || stageIndex === -1) {
    return { isActive: false, isComplete: false, isFailed: false };
  }

  return {
    isActive: stageIndex === activeIndex,
    isComplete: stageIndex < activeIndex,
    isFailed: false,
  };
};

export const WalletStatusHeader = () => {
  const { phase, events, statusTone } = useWalletFlowStore(
    useShallow((state) => ({
      phase: state.phase,
      events: state.events,
      statusTone: phaseCopy[state.phase].tone,
    }))
  );

  const latestUpdate = events.at(-1);
  const phaseLabel = phaseCopy[phase].label;

  return (
    <header className="relative overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_62%)] p-5">
      <WalletFlowClientSync />
      <div
        aria-hidden="true"
        className="-right-16 pointer-events-none absolute top-0 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="-left-12 pointer-events-none absolute bottom-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl"
      />
      <Badge className="w-fit border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.24em]">
        Wallet Flow
      </Badge>
      <h2 className="mt-3 font-semibold text-2xl text-foreground tracking-tight">
        {phaseLabel}
      </h2>
      <p className="mt-2 max-w-[360px] text-foreground/70 text-sm leading-relaxed">
        {phaseCopy[phase].caption}
      </p>
      {latestUpdate ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-background/60 px-3 py-1 text-foreground/70 text-xs">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-2 rounded-full",
              statusTone === "error"
                ? "bg-rose-400"
                : statusTone === "success"
                  ? "bg-emerald-400"
                  : "bg-sky-400"
            )}
          />
          <span className="max-w-[240px] truncate">{latestUpdate.label}</span>
        </div>
      ) : null}
    </header>
  );
};

export const WalletProgressTimeline = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressIndicatorRef = useRef<HTMLDivElement | null>(null);
  const phaseRefs = useRef<Record<WalletFlowPhase, HTMLElement | null>>({
    idle: null,
    initiated: null,
    holding: null,
    releasing: null,
    settled: null,
    failed: null,
  });

  const { phase, lastEvent, timelineVersion, isHydrated } = useWalletFlowStore(
    useShallow((state) => ({
      phase: state.phase,
      lastEvent: state.lastEvent,
      timelineVersion: state.timelineVersion,
      isHydrated: state.isHydrated,
    }))
  );

  const timelinePhases = useMemo(() => phaseOrder.filter(Boolean), []);

  const handleIndicator = useCallback((targetPhase: WalletFlowPhase) => {
    if (!progressIndicatorRef.current) {
      return;
    }
    gsap.to(progressIndicatorRef.current, {
      width: `${getProgressRatio(targetPhase) * 100}%`,
      duration: 0.6,
      ease: "power2.inOut",
    });
  }, []);

  const handleStagePulse = useCallback((phaseKey: WalletFlowPhase) => {
    const node = phaseRefs.current[phaseKey];
    if (!node) {
      return;
    }
    gsap.fromTo(
      node,
      { scale: 0.96 },
      {
        scale: 1,
        duration: 0.6,
        ease: "elastic.out(1, 0.45)",
      }
    );
  }, []);

  const handleErrorShake = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    gsap.fromTo(
      containerRef.current,
      { x: -4 },
      { x: 0, duration: 0.8, ease: "back.out(1.2)" }
    );
  }, []);

  useGSAP(
    () => {
      if (!(containerRef.current && isHydrated)) {
        return;
      }

      const ctx = gsap.context(() => {
        const cards = Object.values(phaseRefs.current).filter(
          (node): node is HTMLElement => Boolean(node)
        );

        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: "power2.out",
              stagger: 0.08,
            }
          );
        }
      }, containerRef);

      return () => {
        ctx.revert();
      };
    },
    { dependencies: [timelineVersion, isHydrated, phase], scope: containerRef }
  );

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    switch (lastEvent.type) {
      case "start":
        handleStagePulse("initiated");
        handleIndicator("initiated");
        break;
      case "phase":
        handleStagePulse(lastEvent.phase);
        handleIndicator(lastEvent.phase);
        break;
      case "complete":
        handleStagePulse("settled");
        handleIndicator("settled");
        break;
      case "error":
        handleStagePulse("releasing");
        handleIndicator("failed");
        handleErrorShake();
        break;
      default:
        break;
    }
  }, [lastEvent, handleIndicator, handleStagePulse, handleErrorShake]);

  return (
    <section
      aria-label="Transaction progress"
      className="rounded-xl border border-white/10 bg-background/75 p-5"
      ref={containerRef}
    >
      <header className="flex flex-col gap-1">
        <span className="text-[0.65rem] text-foreground/60 uppercase tracking-[0.22em]">
          Progress Timeline
        </span>
        <span className="text-foreground/55 text-xs">
          Watch each milestone unlock as the transaction advances.
        </span>
      </header>
      <div className="relative mt-6">
        <div className="h-1.5 w-full rounded-full bg-white/10" />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 shadow-[0_6px_25px_-8px_rgba(16,185,129,0.65)]"
          ref={progressIndicatorRef}
          style={{ width: `${getProgressRatio(phase) * 100}%` }}
        />
        {timelinePhases.map((phaseKey, index) => {
          const ratio = ((index + 1) / timelinePhases.length) * 100;
          const { isActive, isComplete, isFailed } = resolveStageState(
            phaseKey,
            phase
          );
          return (
            <span
              aria-hidden="true"
              className={cn(
                "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 size-3 rounded-full border border-white/25 bg-background/80 transition-[background-color,border-color,box-shadow,transform]",
                isComplete
                  ? "border-emerald-200 bg-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.55)]"
                  : undefined,
                isActive
                  ? "scale-110 border-emerald-200 bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.65)]"
                  : undefined,
                isFailed
                  ? "border-rose-200 bg-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.6)]"
                  : undefined
              )}
              key={`${phaseKey}-marker`}
              style={{ left: `${ratio}%` }}
            />
          );
        })}
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {timelinePhases.map((phaseKey, index) => {
          const { isActive, isComplete, isFailed } = resolveStageState(
            phaseKey,
            phase
          );
          return (
            <li className="group" data-phase-card="true" key={phaseKey}>
              <article
                aria-current={
                  isActive ? ("step" as "step" | undefined) : undefined
                }
                className={cn(
                  "flex h-full flex-col gap-2 rounded-xl border px-4 py-4 transition-all duration-300",
                  isFailed
                    ? "border-rose-400/60 bg-rose-500/10 text-rose-50 shadow-[0_20px_45px_-30px_rgba(244,63,94,0.7)]"
                    : isActive
                      ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-50 shadow-[0_24px_60px_-35px_rgba(16,185,129,0.7)]"
                      : isComplete
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-100"
                        : "border-white/10 bg-background/60 text-foreground/70"
                )}
                ref={(node) => {
                  phaseRefs.current[phaseKey] = node;
                }}
              >
                <span className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.24em]">
                  <span>Stage {index + 1}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-background/70 text-foreground transition-colors",
                      isFailed
                        ? "border-rose-300/50 bg-rose-500/10 text-rose-50"
                        : isActive
                          ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-50"
                          : isComplete
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                            : undefined
                    )}
                  >
                    {timelineIcons[phaseKey]}
                  </span>
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-foreground text-sm">
                    {phaseCopy[phaseKey].label}
                  </h3>
                  <p className="text-foreground/60 text-xs leading-snug">
                    {phaseCopy[phaseKey].caption}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export const WalletSummaryStack = () => {
  const { buyer, seller, phase, isHydrated, hasError, errorMessage } =
    useWalletFlowStore(
      useShallow((state) => ({
        buyer: state.buyer,
        seller: state.seller,
        phase: state.phase,
        isHydrated: state.isHydrated,
        hasError: state.hasError,
        errorMessage: state.errorMessage,
      }))
    );

  const handleRetry = useCallback(() => {
    useWalletFlowStore.getState().reset();
    window.location.reload();
  }, []);

  if (hasError && errorMessage) {
    return <WalletErrorState message={errorMessage} onRetry={handleRetry} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <WalletSummaryCard
          address={buyer.address}
          balance={buyer.balance}
          highlight={phase === "initiated"}
          isLoading={!isHydrated}
          status={phase === "idle" ? "Standing by" : "Debiting"}
          walletRole="buyer"
        />
      </div>
      <div>
        <WalletSummaryCard
          address={seller.address}
          balance={seller.balance}
          highlight={phase === "settled"}
          isLoading={!isHydrated}
          status={
            phase === "settled"
              ? "Settled"
              : phase === "failed"
                ? "Awaiting retry"
                : "Ready"
          }
          walletRole="seller"
        />
      </div>
    </div>
  );
};

export const WalletActivityLog = () => {
  const events = useWalletFlowStore((state) => state.events);
  const activityScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = activityScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [events.length]);

  const logLabel = (timestamp: number, label: string) => {
    const date = new Date(timestamp);
    return `${date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })}  ${label}`;
  };

  return (
    <section
      aria-label="Wallet activity log"
      className="rounded-xl border border-white/10 bg-background/75 p-3"
    >
      <header className="mb-2 flex items-center justify-between text-[0.65rem] text-foreground/60 uppercase tracking-[0.18em]">
        <span>Activity</span>
        <span>{events.length} updates</span>
      </header>
      <div className="max-h-48 overflow-y-auto pr-1" ref={activityScrollRef}>
        <ol
          aria-live="polite"
          className="space-y-1.5 text-[0.75rem] text-foreground/70"
          role="log"
        >
          {events.slice(-ACTIVITY_LOG_LIMIT).map((event) => (
            <li
              className="flex items-start justify-between gap-3 py-0.5"
              key={event.id}
            >
              <span className="flex-1 truncate">
                {logLabel(event.timestamp, event.label)}
              </span>
              <Badge
                className={cn(
                  "flex-shrink-0 rounded-full text-[0.6rem] uppercase tracking-[0.14em]",
                  event.tone === "success"
                    ? "border-emerald-400/60 text-emerald-300"
                    : event.tone === "error"
                      ? "border-rose-400/60 text-rose-300"
                      : "border-sky-400/60 text-sky-200"
                )}
                variant="outline"
              >
                {event.tone}
              </Badge>
            </li>
          ))}
          {events.length === 0 ? (
            <li className="py-2 text-center text-foreground/50">
              Transactions will appear here in real time.
            </li>
          ) : null}
        </ol>
      </div>
    </section>
  );
};

export const WalletRail = () => (
  <aside className="flex h-full flex-col gap-3">
    <WalletStatusHeader />
    <div className="rounded-xl border border-white/10 bg-background/75 p-4">
      <WalletSummaryStack />
    </div>
    <WalletActivityLog />
  </aside>
);

const WalletFlowPanel = () => (
  <aside className="flex h-full min-w-[320px] flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-background/70 p-4">
    <WalletProgressTimeline />
    <WalletRail />
  </aside>
);

export default WalletFlowPanel;
