const Redis = require('ioredis');

const redis = new Redis(
  'rediss://default:AXzzAAIncDFkNDY3NWQyNjgwNTA0MzRiYjYyZmExNWFjMWM1OTVkYXAxMzE5ODc@glad-dane-31987.upstash.io:6379',
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: {},
  }
);

redis
  .ping()
  .then((pong) => {
    console.log('✅ Redis connected:', pong);
    redis.disconnect();
  })
  .catch((err) => {
    console.error('❌ Redis connection failed:', err.message);
    redis.disconnect();
  });
