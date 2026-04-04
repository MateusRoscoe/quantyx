import { ImageResponse } from 'next/og';

export const alt = 'Quantyx - Event Analytics Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #003D3F 0%, #005C5E 50%, #007A7C 100%)',
          gap: 24,
        }}
      >
        <svg viewBox="0 0 32 32" width={80} height={80} fill="none">
          <path
            d="M16 2L28.124 9V23L16 30L3.876 23V9L16 2Z"
            fill="rgba(255,255,255,0.15)"
          />
          <path
            d="M10 20L16 14L22 20L26 16"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
          }}
        >
          Quantyx
        </div>
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          Event Analytics Platform
        </div>
      </div>
    ),
    { ...size },
  );
}
