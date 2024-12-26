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


const luaScript = `
    local keyTokens = KEYS[1]
    local keyTimestamp = KEYS[2]
    local capacity = tonumber(ARGV[1])
    local refillRate = tonumber(ARGV[2])
    local currentTime = tonumber(ARGV[3])
    local tokensToConsume = tonumber(ARGV[4])

    local tokens = tonumber(redis.call('get', keyTokens)) or capacity
    local lastRefillTimestamp = tonumber(redis.call('get', keyTimestamp)) or currentTime

    local elapsedTime = (currentTime - lastRefillTimestamp) / 1000
    tokens = math.min(capacity, tokens + (elapsedTime * refillRate))

    if tokens >= tokensToConsume then
        tokens = tokens - tokensToConsume
        redis.call('set', keyTokens, tostring(tokens))  -- Store tokens as string
        redis.call('set', keyTimestamp, tostring(currentTime))  -- Store timestamp as string
        return {1, tokens}
    else
        local timeUntilNextToken = 1000 / refillRate
        return {0, tokens, timeUntilNextToken}
    end
`;

async function tokenBucket(req, res, next) {
    const currentTime = Math.floor(Date.now()); 
    const keyTokens = 'rateLimit:tokens';
    const keyTimestamp = 'rateLimit:lastRefillTimestamp';

    try {
        const result = await client.eval(luaScript, {
            keys: [keyTokens, keyTimestamp],
            arguments: [
                rateLimit.capacity.toString(), 
                rateLimit.refillRate.toString(), 
                currentTime.toString(), 
                '1' 
            ]
        });

        const allowed = result[0];
        const remainingTokens = result[1];
        const timeUntilNextToken = result[2] || 0;

        if (allowed === 1) {
            res.setHeader('X-RateLimit-Remaining', remainingTokens);
            res.locals.remainingTokens = remainingTokens;
            next();
        } else {
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', timeUntilNextToken);
            res.status(429).send(`Too Many Requests - Rate limit exceeded. Try again in ${timeUntilNextToken} ms`);
        }
    } catch (err) {
        console.error('Redis error:', err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = tokenBucket;
