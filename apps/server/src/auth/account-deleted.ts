/**
 * `POST /api/idp/account-deleted` (auth-next ADR 0018): an account was deleted at auth.hoandat.com/account, the only
 * place an account is deleted, so its data here goes too, at once: the user row and, by cascade in the same statement,
 * its sessions, saved stories (Tủ truyện) and reading progress and history (`deleteUserBySub`). Nothing is shared
 * between accounts here, so nothing changes hands. The IdP calls it server to server with a signed SET as the body
 * (`Content-Type: application/secevent+jwt`), without an Origin, so app.ts mounts it ahead of the same-origin check.
 *
 * Answers 202 once the data is deleted, or when no account here has that `sub` (never signed in, or already deleted:
 * a retried notice is a no-op); 400 when the body is not a SET; 401 when the SET is not a valid one from our IdP for
 * this URL (alg, signature, iss, aud, exp, event); 503 when sign-in is off, the IdP's keys cannot be read or the
 * deletion failed, so the IdP retries. Neither the SET nor the `sub` is logged, only the user's internal id and the
 * outcome.
 */
import express, { type Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ServerConfig } from '../config';
import type { Db } from '../db/client';
import { safeErrorText } from '../log-error';
import { deletedSub, isSecurityEventToken } from './account-deleted-token';
import type { IdpMetadata } from './idp-metadata';
import { decodeJws } from './jws-verify';
import { deleteUserBySub } from './session-store';

export const ACCOUNT_DELETED_PATH = '/api/idp/account-deleted';
const SET_MEDIA_TYPE = 'application/secevent+jwt';
/** Notices per 15 minutes: the IdP calls from one address, and a burst of deletions retries on 429. */
const NOTICE_LIMIT_PER_15_MIN = 300;

export interface AccountDeletedOptions {
  config: ServerConfig;
  db: Db;
  idp: IdpMetadata | null;
  now: () => Date;
}

export function accountDeletedRoute({ config, db, idp, now }: AccountDeletedOptions): Router {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: NOTICE_LIMIT_PER_15_MIN,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).end(),
  });

  router.post(ACCOUNT_DELETED_PATH, limiter, express.text({ type: SET_MEDIA_TYPE, limit: '8kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const body: unknown = req.body;
    const token = typeof body === 'string' ? body.trim() : '';
    const jws = decodeJws(token);
    if (!jws || !isSecurityEventToken(jws)) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { auth } = config;
    if (!auth || !idp) {
      // Sign-in is off here: no IdP to check the signature against. The IdP keeps the notice and retries.
      res.status(503).end();
      return;
    }
    if (jws.header.alg !== 'ES256') {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    let sub: string | null;
    try {
      const payload = await idp.verifiedPayload(token);
      sub = payload ? deletedSub(payload, { issuer: auth.issuer, audience: `${config.publicOrigin}${ACCOUNT_DELETED_PATH}` }, now().getTime()) : null;
    } catch (error) {
      console.warn('account deletion notice: IdP keys unavailable', safeErrorText(error));
      res.status(503).end();
      return;
    }
    if (!sub) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    let userId: string | null;
    try {
      userId = await deleteUserBySub(db, sub);
    } catch (error) {
      console.error('account deletion notice: deletion failed', safeErrorText(error));
      res.status(503).end();
      return;
    }
    if (userId) console.info('account deletion notice: account deleted', userId);
    else console.info('account deletion notice: no account here');
    res.status(202).end();
  });

  return router;
}
