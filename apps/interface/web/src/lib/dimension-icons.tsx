import type { ComponentType } from 'react';
import {
  FaChrome,
  FaFirefoxBrowser,
  FaSafari,
  FaEdge,
  FaOpera,
  FaInternetExplorer,
  FaWindows,
  FaApple,
  FaLinux,
  FaUbuntu,
  FaAndroid,
} from 'react-icons/fa';
import { SiBrave, SiVivaldi } from 'react-icons/si';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Tv,
  Watch,
  Gamepad2,
} from 'lucide-react';

type IconProps = { className?: string };

// ── Browser icons ──────────────────────────────────────────────

const browserMap: [RegExp, ComponentType<IconProps>][] = [
  [/edg/i, FaEdge],
  [/brave/i, SiBrave],
  [/vivaldi/i, SiVivaldi],
  [/opera|opr/i, FaOpera],
  [/firefox/i, FaFirefoxBrowser],
  [/safari/i, FaSafari],
  [/chrom/i, FaChrome],
  [/ie|internet.?explorer|trident/i, FaInternetExplorer],
];

export function BrowserIcon({
  browser,
  className,
}: {
  browser: string;
  className?: string;
}) {
  const match = browserMap.find(([re]) => re.test(browser));
  const Icon = match ? match[1] : Globe;
  return <Icon className={className} />;
}

// ── OS icons ───────────────────────────────────────────────────

const osMap: [RegExp, ComponentType<IconProps>][] = [
  [/android/i, FaAndroid],
  [/ubuntu/i, FaUbuntu],
  [/linux|debian|fedora|arch|centos/i, FaLinux],
  [/windows/i, FaWindows],
  [/mac|ios|iphone|ipad/i, FaApple],
];

export function OsIcon({ os, className }: { os: string; className?: string }) {
  const match = osMap.find(([re]) => re.test(os));
  const Icon = match ? match[1] : Monitor;
  return <Icon className={className} />;
}

// ── Device type icons ──────────────────────────────────────────

const deviceMap: [RegExp, ComponentType<IconProps>][] = [
  [/phone|mobile/i, Smartphone],
  [/tablet/i, Tablet],
  [/tv|television/i, Tv],
  [/watch|wearable/i, Watch],
  [/console|game/i, Gamepad2],
  [/desktop|pc/i, Monitor],
];

export function DeviceIcon({
  deviceType,
  className,
}: {
  deviceType: string;
  className?: string;
}) {
  const match = deviceMap.find(([re]) => re.test(deviceType));
  const Icon = match ? match[1] : Monitor;
  return <Icon className={className} />;
}
