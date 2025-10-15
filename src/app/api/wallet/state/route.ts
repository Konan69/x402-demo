import { NextResponse } from "next/server";
import { getWalletState } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export const GET = async () => {
  try {
    const state = await getWalletState();
    return NextResponse.json(state);
  } catch (error) {
    console.error("Failed to fetch wallet state", error);
    return NextResponse.json(
      { error: "Unable to retrieve wallet state." },
      { status: 500 }
    );
  }
};
