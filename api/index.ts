import type { IncomingMessage, ServerResponse } from 'node:http';
import { getExpressApp } from '../src/server/app.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getExpressApp();
  return app(req as never, res as never);
}
