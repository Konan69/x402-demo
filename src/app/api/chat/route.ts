import { openai } from "@ai-sdk/openai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  convertToModelMessages,
  experimental_createMCPClient as createMCPClient,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { withPayment } from "x402-mcp";
import { env } from "@/lib/env";
import { accessPriceCopy } from "@/lib/pricing";
import {
  chatRatelimit,
  getClientIP,
  MAX_MESSAGE_LENGTH,
  validateMessageLength,
} from "@/lib/rate-limit";
import { getOrCreatePurchaserAccount } from "@/lib/wallet";

export const maxDuration = 30;

export const POST = async (request: Request) => {
  // Rate limiting check
  const ip = getClientIP(request);
  const { success, limit, remaining, reset } = await chatRatelimit.limit(ip);

  if (!success) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: `You can send ${limit} messages per 24 hours. Please try again later.`,
        remaining,
        reset,
      }),
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  const { messages }: { messages: UIMessage[] } = await request.json();

  // Message length validation
  if (messages && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const textParts = lastMessage?.parts?.filter(
      (part) => part.type === "text"
    );
    if (textParts && textParts.length > 0) {
      const messageText = textParts.map((part) => part.text).join("\n");
      const validation = validateMessageLength(messageText);
      if (!validation.isValid) {
        return new Response(
          JSON.stringify({
            error: "Message too long",
            message: validation.error,
            maxLength: MAX_MESSAGE_LENGTH,
          }),
          {
            status: 400,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    }
  }

  const account = await getOrCreatePurchaserAccount();

  const mcpClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL("/mcp", env.URL)),
  }).then((client) =>
    withPayment(client, {
      account,
      network: "base-sepolia",
    })
  );

  const tools = await mcpClient.tools();

  const result = streamText({
    model: openai("gpt-4o"),
    tools,
    messages: convertToModelMessages(messages),
    // biome-ignore lint: Allow step count of 5 as a magic number
    stopWhen: stepCountIs(5),
    onFinish: async () => {
      await mcpClient.close();
    },
    system: `YOU MUST ALWAYS prompt the user to confirm before authorizing payments and explicitly state the exact price (${accessPriceCopy}) before proceeding.
    Once the user confirms, immediately call generatePaymentAuthorization (if needed) and proceed with the paid tool without asking for another confirmation. Do NOT re-confirm after payment authorization succeeds.
    When a tool returns data, echo the relevant details back to the user in the response (include tables or JSON as needed).`,
  });
  const response = result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
    messageMetadata: () => ({ network: "base-sepolia" }),
  });

  // Add rate limit headers to the response
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set("X-RateLimit-Reset", reset.toString());

  return response;
};
