import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";

// Initialize Redis client
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Create a rate limiter for chat/suggestions
export const chatRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(500, "24 h"),
  prefix: "ratelimit:chat",
  analytics: true,
});

// Create a rate limiter for general API requests
export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5000, "1 h"),
  prefix: "ratelimit:api",
  analytics: true,
});

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  return forwarded?.split(",")[0] || realIP || cfConnectingIP || "127.0.0.1";
}

// Message length validation
export const MAX_MESSAGE_LENGTH = 256;
export function validateMessageLength(message: string): {
  isValid: boolean;
  error?: string;
} {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`,
    };
  }
  return { isValid: true };
}
