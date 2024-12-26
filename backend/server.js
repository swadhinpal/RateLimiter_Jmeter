const express = require('express');
const cors = require('cors');
const globalTokenBucketMiddleware = require('.././middleware/tokenBucket1');

const app = express();
const PORT = 4000;

const corsOptions = {
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};

app.use(cors(corsOptions));


//app.use(cors());
app.use(globalTokenBucketMiddleware);

app.get('/hello', (req, res) => {
    const remainingTokens = res.locals.remainingTokens; 
    res.send(`Hello, World! You have ${remainingTokens} requests left this second.`);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

//sudo service redis-server start
//redis-cli