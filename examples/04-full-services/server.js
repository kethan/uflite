import handler from './index.js';

const port = Number(Bun.env.PORT || 3000);
Bun.serve({ port, hostname: '0.0.0.0', fetch: request => handler.fetch(request) });
console.log(`uflite example: http://localhost:${port}`);
