import { facilitator } from "@coinbase/x402";
import { paymentMiddleware } from "x402-next";
import { ACCESS_PRICE_LABEL } from "@/lib/pricing";
import { getOrCreateSellerAccount } from "@/lib/wallet";

const sellerAddress = (await getOrCreateSellerAccount()).address;

export const middleware = paymentMiddleware(
  sellerAddress,
  {
    "GET /api/projects/:slug": {
      price: ACCESS_PRICE_LABEL,
      network: "base-sepolia",
      config: {
        description:
          "Detailed crypto project intelligence including roadmap, risk, and milestones.",
      },
    },
    "GET /api/bridges/compare": {
      price: ACCESS_PRICE_LABEL,
      network: "base-sepolia",
      config: {
        description:
          "Structured cross-chain bridge comparison data (fees, speed, security).",
      },
    },
  },
  facilitator
);

export const config = {
  matcher: ["/api/projects/:slug*", "/api/bridges/compare"],
};
