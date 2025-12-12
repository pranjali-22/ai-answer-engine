// // src/lib/rateLimit.ts
// import { redis } from './redis';
// import { NextRequest } from 'next/server';
//
// interface RateLimitResult {
//   success: boolean;
//   limit: number;
//   remaining: number;
//   reset: number;
// }
//
// export async function rateLimit(
//   request: NextRequest,
//   limit: number = 10,
//   windowMs: number = 60000
// ): Promise<RateLimitResult> {
//   try {
//     // Get identifier (IP address)
//     const ip = request.ip ||
//       request.headers.get('x-forwarded-for') ||
//       request.headers.get('x-real-ip') ||
//       'anonymous';
//
//     const key = `rate_limit:${ip}`;
//
//     // Get current count
//     const current = await redis.get(key);
//     const requests = current ? parseInt(current) : 0;
//
//     if (requests >= limit) {
//       const ttl = await redis.ttl(key);
//
//       return {
//         success: false,
//         limit,
//         remaining: 0,
//         reset: Date.now() + (ttl * 1000),
//       };
//     }
//
//     // Increment counter
//     const pipeline = redis.pipeline();
//     pipeline.incr(key);
//
//     if (requests === 0) {
//       pipeline.expire(key, Math.ceil(windowMs / 1000));
//     }
//
//     await pipeline.exec();
//
//     return {
//       success: true,
//       limit,
//       remaining: limit - requests - 1,
//       reset: Date.now() + windowMs,
//     };
//   } catch (error) {
//     console.error('Rate limit error:', error);
//     // On error, allow the request
//     return {
//       success: true,
//       limit,
//       remaining: limit,
//       reset: Date.now() + windowMs,
//     };
//   }
// }