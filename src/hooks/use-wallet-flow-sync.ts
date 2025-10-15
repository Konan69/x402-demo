"use client";

import type { DynamicToolUIPart, ToolUIPart, UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import {
  useWalletFlowStore,
  type WalletFlowPhase,
  type WalletFlowSnapshot,
} from "@/lib/stores/use-wallet-flow-store";

type PaymentResponse = {
  success?: boolean;
  transaction?: string | { hash?: string };
  payer?: string;
  network?: string;
};

type WalletStateResponse = {
  buyer: {
    address: string;
    balance: number;
  };
  seller: {
    address: string;
    balance: number;
  };
};

type ToolPart = ToolUIPart | DynamicToolUIPart;
type MessagePart = NonNullable<UIMessage["parts"]>[number];

const isToolPart = (part: MessagePart): part is ToolPart => {
  if (!part || typeof part !== "object" || !("type" in part)) {
    return false;
  }

  const type = (part as { type?: unknown }).type;
  if (type === "dynamic-tool") {
    return true;
  }

  return typeof type === "string" && type.startsWith("tool-");
};

const extractPaymentResponse = (
  part: ToolPart
): PaymentResponse | undefined => {
  if (part.state !== "output-available") {
    return;
  }

  const output = part.output;
  if (!output || typeof output !== "object") {
    return;
  }

  const meta = (output as { _meta?: Record<string, unknown> })._meta;
  if (!meta || typeof meta !== "object") {
    return;
  }

  const payment = meta["x402/payment-response"];
  if (!payment || typeof payment !== "object") {
    return;
  }

  return payment as PaymentResponse;
};

const getPaymentKey = (
  payment: PaymentResponse,
  part: ToolPart,
  fallback: string
) => {
  if (typeof payment.transaction === "string") {
    return payment.transaction;
  }

  if (
    payment.transaction &&
    typeof payment.transaction === "object" &&
    "hash" in payment.transaction &&
    typeof payment.transaction.hash === "string"
  ) {
    return payment.transaction.hash;
  }

  if (typeof part.toolCallId === "string") {
    return part.toolCallId;
  }

  return fallback;
};

const fetchWalletSnapshot = async (
  signal?: AbortSignal
): Promise<WalletFlowSnapshot> => {
  const response = await fetch("/api/wallet/state", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("Failed to retrieve wallet state");
  }

  const data = (await response.json()) as WalletStateResponse;

  // Validate the response data
  if (!data || typeof data !== "object") {
    throw new Error("Invalid wallet state response");
  }

  if (!(data.buyer && data.seller)) {
    throw new Error("Missing buyer or seller data in response");
  }

  // Validate addresses and balances
  const buyerAddress = data.buyer?.address || "";
  const buyerBalance =
    typeof data.buyer?.balance === "number" ? data.buyer.balance : 0;
  const sellerAddress = data.seller?.address || "";
  const sellerBalance =
    typeof data.seller?.balance === "number" ? data.seller.balance : 0;

  return {
    buyer: { address: buyerAddress, balance: buyerBalance },
    seller: { address: sellerAddress, balance: sellerBalance },
  };
};

const snapshotFromStore = (): WalletFlowSnapshot => {
  const state = useWalletFlowStore.getState();
  return {
    buyer: { ...state.buyer },
    seller: { ...state.seller },
  };
};

const waitFor = (duration: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, duration);

    function cleanup() {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
    }

    function handleAbort() {
      cleanup();
      resolve();
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });

const phaseSteps: Array<{ delay: number; phase: WalletFlowPhase }> = [
  { delay: 480, phase: "holding" },
  { delay: 720, phase: "releasing" },
];

const runPhaseSequence = (
  signal: AbortSignal | undefined,
  setPhase: (phase: WalletFlowPhase) => void
) =>
  phaseSteps.reduce(
    (chain, { delay, phase }) =>
      chain
        .then(() => waitFor(delay, signal))
        .then(() => {
          if (!signal?.aborted) {
            setPhase(phase);
          }
        }),
    Promise.resolve()
  );

export const useWalletFlowSync = (messages: UIMessage[]) => {
  const processedTransactionsRef = useRef(new Set<string>());
  const abortControllersRef = useRef(new Map<string, AbortController>());

  const paymentDescriptors = useMemo(() => {
    const descriptors: Array<{
      key: string;
      payment: PaymentResponse;
    }> = [];

    for (const message of messages) {
      const parts = message.parts;
      if (!parts) {
        continue;
      }

      for (const part of parts) {
        if (!isToolPart(part)) {
          continue;
        }

        const payment = extractPaymentResponse(part);
        if (!payment) {
          continue;
        }

        const key = getPaymentKey(payment, part, message.id);
        descriptors.push({ key, payment });
      }
    }

    return descriptors;
  }, [messages]);

  useEffect(() => {
    if (paymentDescriptors.length === 0) {
      return;
    }

    const processTransaction = async ({
      key,
      payment,
    }: (typeof paymentDescriptors)[number]) => {
      if (processedTransactionsRef.current.has(key)) {
        return;
      }

      processedTransactionsRef.current.add(key);

      const store = useWalletFlowStore.getState();

      if (payment.success === false) {
        store.failFlow("Payment failed");
        store.logEvent({ label: "Payment rejected by issuer", tone: "error" });
        return;
      }

      const controller = new AbortController();
      abortControllersRef.current.set(key, controller);

      const currentSnapshot = snapshotFromStore();
      store.startFlow(currentSnapshot);
      store.logEvent({ label: "Awaiting authorization confirmation" });

      if (payment.network) {
        store.logEvent({ label: `Network: ${payment.network}` });
      }

      if (payment.payer) {
        store.logEvent({ label: `Buyer wallet: ${payment.payer}` });
      }

      const transactionLabel =
        typeof payment.transaction === "string"
          ? payment.transaction.slice(0, 12)
          : payment.transaction && typeof payment.transaction === "object"
            ? (payment.transaction.hash ?? "").slice(0, 12)
            : undefined;

      if (transactionLabel) {
        store.logEvent({
          label: `Tx reference ${transactionLabel}`,
        });
      }

      try {
        await runPhaseSequence(controller.signal, store.setPhase);

        if (controller.signal.aborted) {
          return;
        }

        store.logEvent({ label: "Verification checks passed" });

        const snapshot = await fetchWalletSnapshot(controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        store.updateBalances(snapshot);
        store.completeFlow(snapshot);
      } catch (error) {
        if (!controller.signal.aborted) {
          store.failFlow(
            error instanceof Error ? error.message : "Wallet sync failed"
          );
        }
      } finally {
        abortControllersRef.current.delete(key);
      }
    };

    const pending = paymentDescriptors.map((descriptor) =>
      processTransaction(descriptor)
    );

    void Promise.all(pending);
  }, [paymentDescriptors]);

  useEffect(() => {
    if (messages.length > 0) {
      return;
    }

    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
    abortControllersRef.current.clear();
    processedTransactionsRef.current.clear();
    useWalletFlowStore.getState().reset();
  }, [messages.length]);

  useEffect(
    () => () => {
      processedTransactionsRef.current.clear();

      for (const controller of abortControllersRef.current.values()) {
        controller.abort();
      }
      abortControllersRef.current.clear();

      useWalletFlowStore.getState().reset();
    },
    []
  );
};
