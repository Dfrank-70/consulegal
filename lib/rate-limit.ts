/**
 * Rate Limiting - In-Memory Implementation
 * 
 * Simple sliding window rate limiter for MVP.
 * Note: In-memory storage means limits reset on server restart.
 * For production multi-instance, use Redis or DB-backed solution.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store: Map<identifier, RateLimitEntry>
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Check if request is within rate limit.
 * 
 * @param identifier - Unique identifier (userId or IP address)
 * @param limit - Max requests per window (default from env CHAT_RPM or 20)
 * @param windowMs - Time window in milliseconds (default 60000 = 1 minute)
 * @returns RateLimitResult with allowed flag and retry info
 */
export function checkRateLimit(
  identifier: string,
  limit: number = parseInt(process.env.CHAT_RPM || '20'),
  windowMs: number = 60000 // 1 minute
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No previous requests or window expired
  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimitStore.set(identifier, {
      count: 1,
      windowStart: now
    });
    
    return {
      allowed: true,
      limit,
      remaining: limit - 1
    };
  }

  // Within window - check if limit exceeded
  if (entry.count >= limit) {
    const windowEnd = entry.windowStart + windowMs;
    const retryAfterSeconds = Math.ceil((windowEnd - now) / 1000);
    
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    limit,
    remaining: limit - entry.count
  };
}

/**
 * Get client IP from request headers (for fallback rate limiting).
 * Handles proxies (x-forwarded-for, x-real-ip).
 * 
 * @param headers - Request headers
 * @returns IP address or 'unknown'
 */
export function getClientIP(headers: Headers): string {
  // Check proxy headers first
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take first
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return headers.get('cf-connecting-ip') || 'unknown';
}

/**
 * Cleanup old entries to prevent memory leak.
 * Should be called periodically (e.g., every 5 minutes).
 */
export function cleanupRateLimitStore(maxAgeMs: number = 300000) {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [identifier, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > maxAgeMs) {
      rateLimitStore.delete(identifier);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired rate limit entries`);
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupRateLimitStore(), 5 * 60 * 1000);
}
