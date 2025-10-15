"use client";

import { useEffect } from "react";
import {
  useWalletFlowStore,
  type WalletFlowSnapshot,
} from "@/lib/stores/use-wallet-flow-store";

const fetchWalletSnapshot = async (): Promise<WalletFlowSnapshot> => {
  const response = await fetch("/api/wallet/state", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to retrieve wallet state");
  }

  const data = await response.json();

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

export function WalletFlowClientSync() {
  useEffect(() => {
    // Only run on client side after hydration
    const syncWalletState = async () => {
      try {
        const snapshot = await fetchWalletSnapshot();
        useWalletFlowStore.getState().updateBalances(snapshot);
      } catch (error) {
        // Set error state instead of just hydrated
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load wallet data";
        useWalletFlowStore.getState().setError(errorMessage);
      }
    };

    syncWalletState();
  }, []);

  return null;
}
