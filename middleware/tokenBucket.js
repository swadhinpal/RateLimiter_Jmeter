const rateLimit = {
    capacity: 10,        
    tokens: 10,          
    refillRate: 1,       
    lastRefillTimestamp: Date.now() 
};

function tokenBucket(req, res, next) {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - rateLimit.lastRefillTimestamp) / 1000; 

    rateLimit.tokens += elapsedTime * rateLimit.refillRate;
    rateLimit.tokens = Math.min(rateLimit.tokens, rateLimit.capacity); 
    rateLimit.lastRefillTimestamp = currentTime;

   
    if (rateLimit.tokens >= 1) {
        rateLimit.tokens -= 1; 
        const remainingTokens = Math.floor(rateLimit.tokens); 
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
}

module.exports = tokenBucket;
