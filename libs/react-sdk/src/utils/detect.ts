import type { DeviceContext } from '../types.js';

interface NavigatorUAData {
  brands?: Array<{ brand: string; version: string }>;
  platform?: string;
  mobile?: boolean;
}

/**
 * Detect browser, OS, and device type from the current environment.
 * Uses Client Hints API (Chrome/Edge) with fallback to navigator.userAgent parsing.
 */
export function detectDevice(): DeviceContext {
  const ctx: DeviceContext = { platform: 'web' };

  if (typeof navigator === 'undefined') return ctx;

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData;

  if (uaData?.brands?.length) {
    // Client Hints API (Chromium-based browsers)
    const significant = uaData.brands.find(
      (b) => !b.brand.includes('Not') && b.brand !== 'Chromium',
    );
    const brand =
      significant ?? uaData.brands.find((b) => b.brand === 'Chromium');
    if (brand) {
      ctx.browser = brand.brand;
      ctx.browser_version = brand.version;
    }
    if (uaData.platform) {
      ctx.os = uaData.platform;
    }
    ctx.device_type = uaData.mobile ? 'mobile' : 'desktop';

    if (typeof screen !== 'undefined') {
      ctx.screen_width = screen.width;
      ctx.screen_height = screen.height;
    }

    return ctx;
  }

  // Fallback: parse navigator.userAgent
  const ua = navigator.userAgent;
  if (!ua) return ctx;

  // Browser detection
  if (ua.includes('Firefox/')) {
    ctx.browser = 'Firefox';
    ctx.browser_version = ua.match(/Firefox\/([\d.]+)/)?.[1];
  } else if (ua.includes('Edg/')) {
    ctx.browser = 'Edge';
    ctx.browser_version = ua.match(/Edg\/([\d.]+)/)?.[1];
  } else if (ua.includes('Chrome/')) {
    ctx.browser = 'Chrome';
    ctx.browser_version = ua.match(/Chrome\/([\d.]+)/)?.[1];
  } else if (ua.includes('Safari/') && ua.includes('Version/')) {
    ctx.browser = 'Safari';
    ctx.browser_version = ua.match(/Version\/([\d.]+)/)?.[1];
  }

  // OS detection
  if (ua.includes('Windows')) {
    ctx.os = 'Windows';
    ctx.os_version = ua.match(/Windows NT ([\d.]+)/)?.[1];
  } else if (ua.includes('Mac OS X')) {
    ctx.os = 'macOS';
    ctx.os_version = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.');
  } else if (ua.includes('Android')) {
    ctx.os = 'Android';
    ctx.os_version = ua.match(/Android ([\d.]+)/)?.[1];
  } else if (ua.includes('Linux')) {
    ctx.os = 'Linux';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    ctx.os = 'iOS';
    ctx.os_version = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.');
  }

  // Device type
  ctx.device_type = /Mobi|Android.*Mobile|iPhone|iPod/.test(ua)
    ? 'mobile'
    : /iPad|Android(?!.*Mobile)|Tablet/.test(ua)
      ? 'tablet'
      : 'desktop';

  // Screen dimensions
  if (typeof screen !== 'undefined') {
    ctx.screen_width = screen.width;
    ctx.screen_height = screen.height;
  }

  return ctx;
}
