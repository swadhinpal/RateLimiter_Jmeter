const redis = require('redis');

const client = redis.createClient({
    url: 'redis://127.0.0.1:6379' 
});

client.connect().catch(console.error);

client.on('connect', () => {
    console.log('Redis client connected');
});

client.on('error', (err) => {
    console.error('Redis connection error:', err);
});

const rateLimit = {
    capacity: 10,
    refillRate: 1
};

async function tokenBucket(req, res, next) {
    const currentTime = Date.now();
    const keyTokens = 'rateLimit:tokens';
    const keyTimestamp = 'rateLimit:lastRefillTimestamp';

    try {
        let tokens = parseFloat(await client.get(keyTokens)) || rateLimit.capacity;
        let lastRefillTimestamp = parseInt(await client.get(keyTimestamp)) || Date.now();

        const elapsedTime = (currentTime - lastRefillTimestamp) / 1000;

        tokens += elapsedTime * rateLimit.refillRate;
        tokens = Math.min(tokens, rateLimit.capacity);

        lastRefillTimestamp = currentTime;
        await client.set(keyTokens, tokens);
        await client.set(keyTimestamp, lastRefillTimestamp);

        if (tokens >= 1) {
            tokens -= 1;
            await client.set(keyTokens, tokens);
            const remainingTokens = Math.floor(tokens);
            res.setHeader('X-RateLimit-Remaining', remainingTokens);
            res.locals.remainingTokens = remainingTokens;
            next();
        } else {
            const timeUntilNextToken = 1000 / rateLimit.refillRate;
            const nextAvailableTime = Math.max(0, Math.ceil(timeUntilNextToken - (elapsedTime * 1000)));
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', nextAvailableTime);
            res.status(429).send(`Too Many Requests - Rate limit exceeded. Try again in ${nextAvailableTime} ms`);
        }
    } catch (err) {
        console.error('Redis error:', err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = tokenBucket;
