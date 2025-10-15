export type ProjectSlug = "blockradar" | "hyperbridge" | "wormhole";

export interface ProjectDetail {
  readonly slug: ProjectSlug;
  readonly name: string;
  readonly symbol: string;
  readonly category: string;
  readonly marketCap: string;
  readonly description: string;
  readonly recentMilestone: string;
  readonly risk: "High" | "Medium" | "Low";
  readonly roadmap: readonly string[];
}

const projectList: readonly ProjectDetail[] = [
  {
    slug: "blockradar",
    name: "BlockRadar",
    symbol: "-",
    category: "Stablecoin Wallet Infrastructure",
    marketCap: "Private platform; volume disclosed to partners",
    description:
      "Non-custodial stablecoin wallet APIs with auto-settlement, AML screening, and Circle Gateway integration for fintech operators.",
    recentMilestone:
      "Went live as a Day 1 Circle Gateway partner, consolidating USDC balances across supported chains (Aug 20, 2025).",
    risk: "Medium",
    roadmap: [
      "Q4 2025: Extend Gateway auto-settlement templates to additional stablecoins.",
      "Q1 2026: Add new fiat banking partners across Africa and LATAM for settlement flows.",
      "Q2 2026: Broaden developer SDK coverage for more custody and treasury use cases.",
    ],
  },
  {
    slug: "hyperbridge",
    name: "Hyperbridge",
    symbol: "BRIDGE",
    category: "Verifiable Interoperability",
    marketCap: "IRO sold 52M of 100M BRIDGE tokens (Jan 2025)",
    description:
      "Polkadot rollup providing zk-backed cross-chain messaging and token transfers with relayer incentives.",
    recentMilestone:
      "Selected by the Polkadot DAO as the native bridge for the DeFi Singularity program, expanding DOT liquidity (Apr 1, 2025).",
    risk: "Medium",
    roadmap: [
      "Q4 2025: Complete Polygon mainnet rollout with production traffic monitoring.",
      "Q1 2026: Launch decentralized relayer staking tied to consensus client upgrades.",
      "Q2 2026: Add Tendermint-based chains via light-client integrations.",
    ],
  },
  {
    slug: "wormhole",
    name: "Wormhole",
    symbol: "W",
    category: "Cross-chain Messaging",
    marketCap: "$2.5B valuation post-$225M round (Nov 2023)",
    description:
      "Cross-chain protocol connecting 30+ networks for asset transfers, messaging, and liquidity routing.",
    recentMilestone:
      "Submitted a cash acquisition proposal for Stargate Finance to create a larger cross-chain liquidity hub (Aug 21, 2025).",
    risk: "High",
    roadmap: [
      "Q4 2025: Complete governance process around the Stargate acquisition bid.",
      "Q1 2026: Expand institutional partnerships following Circle ecosystem integrations.",
      "Q2 2026: Launch next-gen security modules in Wormhole Labs reference clients.",
    ],
  },
];

export const PROJECTS_BY_SLUG: ReadonlyMap<ProjectSlug, ProjectDetail> =
  new Map(projectList.map((project) => [project.slug, project]));

export const PROJECTS: readonly ProjectDetail[] = projectList;
