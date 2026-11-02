/** Ports and the test client secret of the E2E run (never a real secret). Each its own, never reused by dev. */
export const WEB_PORT = 5302;
export const API_PORT = 5303;
export const FAKE_IDP_PORT = 5304;
export const E2E_CLIENT_SECRET = 'e2e-only-client-secret-not-a-real-one-000';
/** A deployed site to check instead of a local build, e.g. E2E_BASE_URL=https://truyen.hoandat.com after a release. */
export const DEPLOYED_URL = process.env.E2E_BASE_URL;
