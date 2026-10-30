import { describe, expect, it } from 'vitest';
import { nativeContentSecurityPolicy, nativeStoryOrigin, siteContentSecurityPolicy, withPolicyMeta } from './vite-native.ts';

describe('the iPhone app build', () => {
  it('reads the stories from the site unless a test build says otherwise', () => {
    expect(nativeStoryOrigin({})).toBe('https://truyen.hoandat.com');
    expect(nativeStoryOrigin({ TRUYEN_STORY_ORIGIN: 'http://localhost:5303' })).toBe('http://localhost:5303');
    expect(nativeStoryOrigin({ TRUYEN_STORY_ORIGIN: 'bundled' })).toBe('');
    expect(() => nativeStoryOrigin({ TRUYEN_STORY_ORIGIN: 'http://example.com' })).toThrow(/https/);
    expect(() => nativeStoryOrigin({ TRUYEN_STORY_ORIGIN: 'https://example.com/stories' })).toThrow(/origin only/);
    expect(() => nativeStoryOrigin({ TRUYEN_STORY_ORIGIN: 'not a url' })).toThrow(/not a URL/);
  });

  it('keeps the site policy without Cloudflare Web Analytics, adding the story origin for media', () => {
    const site = siteContentSecurityPolicy();
    expect(site).toContain('cloudflareinsights');
    const app = nativeContentSecurityPolicy(site, 'https://truyen.hoandat.com');
    expect(app).not.toContain('cloudflareinsights');
    expect(app).not.toContain('frame-ancestors');
    expect(app).toContain("script-src 'self';");
    expect(app).toContain("media-src 'self' https://truyen.hoandat.com");
    expect(app).toContain("img-src 'self' data: https://truyen.hoandat.com");
    expect(app).toContain("connect-src 'self' https://truyen.hoandat.com");
    expect(nativeContentSecurityPolicy(site, '')).toContain("media-src 'self';");
  });

  it('puts the policy in the page head before any script', () => {
    const html = withPolicyMeta('<head>\n    <meta charset="UTF-8" />\n    <script src="/a.js"></script>', "default-src 'self'");
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
  });
});
