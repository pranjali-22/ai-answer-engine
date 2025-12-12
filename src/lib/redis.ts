// // src/lib/redis.ts
// import { Redis } from 'ioredis';
//
// const getRedisUrl = () => {
//   if (process.env.REDIS_URL) {
//     return process.env.REDIS_URL;
//   }
//
//   return `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
// };
//
// // Create Redis client
// export const redis = new Redis(getRedisUrl());
//
// redis.on('error', (err) => console.error('Redis Client Error', err));
// redis.on('connect', () => console.log('Redis Connected'));
//
// export default redis;