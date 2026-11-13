import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { sql } from 'drizzle-orm';
import { accountDeletedRoute } from './auth/account-deleted';
import { authRoutes } from './auth/auth-routes';
import { idpMetadata } from './auth/idp-metadata';
import { requireSameOrigin } from './auth/origin-check';
import type { ServerConfig } from './config';
import type { Db } from './db/client';
import { HttpError } from './http-error';
import { safeErrorText } from './log-error';
import { readingRoutes } from './reading/reading-routes';
import { shelfRoutes } from './shelf/shelf-routes';

export interface AppDeps {
  config: ServerConfig;
  db: Db;
  now?: () => Date;
}

/**
 * The API: health check, sign-in, the saved stories and the reading progress of an account, and the IdP's notice of a
 * deleted account. The site itself (pages and stories) is static, served by nginx; reading never goes through here.
 */
export function createApp({ config, db, now = () => new Date() }: AppDeps): Express {
  const app = express();
  // One reader of the IdP's discovery and keys, shared by sign-in and the account-deletion notice.
  const idp = config.auth ? idpMetadata(config.auth.issuer) : null;
  app.disable('x-powered-by');
  // nginx on the same host sets X-Forwarded-For; trust it from loopback only (rate limits use the client IP).
  app.set('trust proxy', 'loopback');
  app.use(helmet());

  app.get('/healthz', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.set('Cache-Control', 'no-store').type('text/plain').send('ok');
  });

  // The IdP posts server to server, without an Origin: ahead of the same-origin check, with checks of its own.
  app.use(accountDeletedRoute({ config, db, idp, now }));
  app.use(requireSameOrigin(config.publicOrigin));
  // A whole sync of the reading progress is the largest body (a hundred short entries).
  app.use(express.json({ limit: '16kb' }));
  app.use(authRoutes({ config, db, idp, now }));
  app.use(shelfRoutes({ config, db, now }));
  app.use(readingRoutes({ config, db, now }));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not-found')));

  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    // Malformed JSON and oversized bodies from express.json().
    if (typeof err === 'object' && err !== null && 'type' in err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      res.status(400).json({ error: 'invalid-body' });
      return;
    }
    // Never the raw error: a failed query's message carries what the account saved or read.
    console.error('request failed', safeErrorText(err));
    res.status(500).json({ error: 'internal' });
  };
  app.use(onError);
  return app;
}
