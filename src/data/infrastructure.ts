export interface InfrastructureEntry {
  readonly id: string;
  readonly name: string;
  readonly focus: string;
  readonly coverage: readonly string[];
  readonly latestUpdate: string;
  readonly notes: readonly string[];
}

export interface InfrastructureDirectory {
  readonly items: readonly InfrastructureEntry[];
}

export const INFRASTRUCTURE_DIRECTORY: InfrastructureDirectory = {
  items: [
    {
      id: "blockradar-gateway",
      name: "BlockRadar Gateway Auto-Settlement",
      focus: "Stablecoin treasury automation",
      coverage: [
        "Arbitrum",
        "Avalanche",
        "Base",
        "Ethereum",
        "Optimism",
        "Polygon",
        "Unichain",
      ],
      latestUpdate:
        "Day 1 Circle Gateway partner consolidating USDC balances across supported chains (Aug 20, 2025).",
      notes: [
        "Wallet-as-a-service with compliance tooling for fintech programs.",
        "Auto-settlement flows sweep deposits into Circle Gateway for unified balances.",
      ],
    },
    {
      id: "hyperbridge-defi-singularity",
      name: "Hyperbridge DeFi Singularity Rollout",
      focus: "Verifiable cross-chain interoperability",
      coverage: ["Polkadot", "Arbitrum", "Base", "BNB Chain", "Ethereum", "Polygon"],
      latestUpdate:
        "Polygon mainnet connectivity live as part of Polkadot DeFi Singularity expansion (Sep 30, 2025).",
      notes: [
        "Polkadot DAO backed Hyperbridge as native bridge with 795k DOT liquidity incentives.",
        "Liquidity programs run on Uniswap V4 with DOT/ETH incentives through September 2025.",
      ],
    },
    {
      id: "wormhole-stargate-proposal",
      name: "Wormhole–Stargate Liquidity Hub Proposal",
      focus: "Cross-chain messaging and liquidity aggregation",
      coverage: ["Ethereum", "LayerZero-aligned chains", "Stargate pools"],
      latestUpdate:
        "Wormhole Foundation tabled an all-cash bid exceeding $110M to acquire Stargate Finance (Aug 21, 2025).",
      notes: [
        "Bid positioned as higher-certainty alternative to LayerZero token swap deal.",
        "Stargate processed $4B in July 2025 bridge volume with $345M TVL ahead of the acquisition vote.",
      ],
    },
  ],
};
