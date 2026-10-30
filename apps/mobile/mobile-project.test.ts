import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import brand from '../../brand.config.json' with { type: 'json' };
import config from './capacitor.config.ts';
import pkg from './package.json' with { type: 'json' };
import { squareIcon } from './scripts/native-icons.ts';

const read = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('the iPhone project', () => {
  it('carries the brand id and name, and wraps the app build of the web app', () => {
    expect(config.appId).toBe('com.hoandat.truyen');
    expect(config.appId).toBe(brand.appIds.ios);
    expect(config.appName).toBe(brand.appName);
    expect(config.webDir).toBe('../web/dist-native');
    const project = read('./ios/App/App.xcodeproj/project.pbxproj');
    expect(project.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)).toEqual(Array(2).fill(`PRODUCT_BUNDLE_IDENTIFIER = ${brand.appIds.ios};`));
    expect(project.match(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)).toEqual(Array(2).fill('TARGETED_DEVICE_FAMILY = 1;'));
    expect(read('./ios/App/App/Info.plist')).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Truyện<\/string>/);
  });

  it('takes the store version from package.json', () => {
    expect(read('./ios/App/App.xcodeproj/project.pbxproj').match(/MARKETING_VERSION = ([^;]+);/g)).toEqual(Array(2).fill(`MARKETING_VERSION = ${pkg.version};`));
  });

  it('keeps a story playing in the background and with the phone locked', () => {
    expect(read('./ios/App/App/Info.plist')).toMatch(/<key>UIBackgroundModes<\/key>\s*<array>\s*<string>audio<\/string>\s*<\/array>/);
    const delegate = read('./ios/App/App/AppDelegate.swift');
    expect(delegate).toContain('setCategory(.playback, mode: .spokenAudio, options: [])');
    // Mixing with other apps would hand the lock screen controls to them.
    expect(delegate).not.toContain('mixWithOthers');
  });

  it('reads the stories through the app\'s own HTTP and allows no plain-http loads', () => {
    expect(config.plugins?.CapacitorHttp).toEqual({ enabled: true });
    const plist = read('./ios/App/App/Info.plist');
    expect(plist).not.toContain('NSAppTransportSecurity');
    expect(plist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });

  it('ships a 1024 px App Store icon without alpha, drawn square from the brand icon', () => {
    const png = readFileSync(new URL('./ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url));
    // PNG header: width at byte 16, colour type at byte 25 (2 = RGB, 6 = RGBA).
    expect({ width: png.readUInt32BE(16), colourType: png[25] }).toEqual({ width: 1024, colourType: 2 });
    expect(squareIcon('<svg><rect width="1" rx="224" fill="red"/></svg>')).toBe('<svg><rect width="1" fill="red"/></svg>');
    expect(() => squareIcon('<svg><circle r="1"/></svg>')).toThrow(/no rounded tile/);
  });
});
