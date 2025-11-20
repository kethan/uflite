import { flite } from '../dist';
import {
    cors, corsAfter,
    logger, loggerAfter,
    requestId, bodyLimit,
    rateLimit, rateLimitAfter,
    bearerAuth,
    secureHeaders, secureHeadersAfter
} from '../middleware';

const app = flite({
    mode: 1,
    before: {
        all: [
            requestId(),
            logger({ format: 'dev' }),
            cors({ origin: ['https://example.com'] }),
            secureHeaders(),
            rateLimit({ max: 100, windowMs: 60000 }),
            bodyLimit({ max: '5mb' })
        ]
    },
    after: {
        all: [
            corsAfter,
            loggerAfter,
            rateLimitAfter,
            secureHeadersAfter
        ]
    }
});

// Protected routes
app.use('/api/*', bearerAuth({ token: 'secret123' }));

app.get('/api/data', () => ({ data: 'protected' }));


export default {
    ...app
}