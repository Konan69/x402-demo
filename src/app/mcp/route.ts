import { facilitator } from "@coinbase/x402";
import { createPaidMcpHandler } from "x402-mcp";
import { z } from "zod";
import { INFRASTRUCTURE_DIRECTORY } from "@/data/infrastructure";
import { PROJECTS_BY_SLUG } from "@/data/projects";
import { toPrettyJson } from "@/lib/mcp/utils";
import { ACCESS_PRICE_USD } from "@/lib/pricing";
import { getOrCreateSellerAccount } from "@/lib/wallet";

const sellerAccount = await getOrCreateSellerAccount();

const handler = createPaidMcpHandler(
  (server) => {
    server.paidTool(
      "getProjectDetail",
      "Fetch detailed information about a tokenised project gated by x402. Requires the `slug` of the project (blockradar | hyperbridge | wormhole).",
      { price: ACCESS_PRICE_USD },
      {
        slug: z.enum(["blockradar", "hyperbridge", "wormhole"]),
      },
      {},

      ({ slug }) => {
        if (!slug) {
          console.log("[mcp] getProjectDetail missing slug");
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "You must provide a project `slug` (blockradar | hyperbridge | wormhole).",
              },
            ],
          };
        }

        console.log("[mcp] getProjectDetail invoked", { slug });
        const project = PROJECTS_BY_SLUG.get(
          slug as "blockradar" | "hyperbridge" | "wormhole"
        );

        if (!project) {
          console.log("[mcp] getProjectDetail missing project", { slug });
          return {
            content: [
              {
                type: "text" as const,
                text: `Project "${slug}" not found.`,
              },
            ],
          };
        }

        const detailText = toPrettyJson(project);

        const response = {
          content: [
            {
              type: "text" as const,
              text: detailText,
            },
          ],
        };
        console.log("[mcp] getProjectDetail response ready", {
          slug,
          bytes: detailText.length,
        });
        return response;
      }
    );

    server.paidTool(
      "listInfrastructure",
      "List notable infrastructure updates across the stablecoin and interoperability stack.",
      { price: ACCESS_PRICE_USD },
      {},
      {},
      () => {
        console.log("[mcp] listInfrastructure invoked");
        const directoryText = toPrettyJson(INFRASTRUCTURE_DIRECTORY);

        const response = {
          content: [
            {
              type: "text" as const,
              text: directoryText,
            },
          ],
        };
        console.log("[mcp] listInfrastructure response ready", {
          bytes: directoryText.length,
        });
        return response;
      }
    );
  },
  {
    capabilities: {
      tools: {
        getProjectDetail: {
          description:
            "Paid access to roadmap, risk posture, and milestones for a crypto project.",
        },
        listInfrastructure: {
          description:
            "Paid snapshot of stablecoin and interoperability infrastructure updates.",
        },
      },
    },
  },
  {
    facilitator,
    recipient: sellerAccount.address,
    network: "base-sepolia",
  }
);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
