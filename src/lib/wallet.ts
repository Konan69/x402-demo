import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http } from "viem";
import { type Account, toAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { WalletSnapshot } from "@/types/wallet";

const cdp = new CdpClient();
const BALANCE_LIMIT = 500_000;
const USDC_SYMBOL = "USDC";
const USDC_DECIMALS = 6;

export const chain = baseSepolia;

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

type TokenBalancesResult = {
  balances: Array<{
    token: {
      symbol?: string;
    };
    amount: {
      amount: bigint;
      decimals: number;
    };
  }>;
};

const toUsdcBalance = (balances: TokenBalancesResult) => {
  const usdcBalance = balances.balances.find(
    (balance) => balance.token.symbol?.toUpperCase() === USDC_SYMBOL
  );

  if (!usdcBalance) {
    return 0;
  }

  const rawAmount = usdcBalance.amount.amount;
  const decimals = usdcBalance.amount.decimals ?? USDC_DECIMALS;
  const numericAmount = Number(rawAmount);

  if (Number.isNaN(numericAmount)) {
    return 0;
  }

  return numericAmount / 10 ** decimals;
};

export async function getOrCreatePurchaserAccount(): Promise<Account> {
  const account = await cdp.evm.getOrCreateAccount({
    name: "Purchaser",
  });
  const balances = await account.listTokenBalances({
    network: "base-sepolia",
  });

  const usdcBalance = balances.balances.find(
    (balance) => balance.token.symbol === "USDC"
  );

  // get testnet tokens from faucet
  if (!usdcBalance || Number(usdcBalance.amount) < BALANCE_LIMIT) {
    const { transactionHash } = await cdp.evm.requestFaucet({
      address: account.address,
      network: "base-sepolia",
      token: "usdc",
    });
    const tx = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });
    if (tx.status !== "success") {
      throw new Error("Failed to recieve funds from faucet");
    }
  }

  return toAccount(account);
}

export async function getOrCreateSellerAccount(): Promise<Account> {
  const account = await cdp.evm.getOrCreateAccount({
    name: "Seller",
  });
  return toAccount(account);
}

export const getWalletState = async (): Promise<WalletSnapshot> => {
  const [purchaserAccount, sellerAccount] = await Promise.all([
    cdp.evm.getOrCreateAccount({ name: "Purchaser" }),
    cdp.evm.getOrCreateAccount({ name: "Seller" }),
  ]);

  const [purchaserBalances, sellerBalances] = (await Promise.all([
    purchaserAccount.listTokenBalances({ network: "base-sepolia" }),
    sellerAccount.listTokenBalances({ network: "base-sepolia" }),
  ])) as [TokenBalancesResult, TokenBalancesResult];

  return {
    buyer: {
      address: purchaserAccount.address,
      balance: toUsdcBalance(purchaserBalances),
    },
    seller: {
      address: sellerAccount.address,
      balance: toUsdcBalance(sellerBalances),
    },
  };
};
