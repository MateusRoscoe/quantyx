import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quantyx',
    short_name: 'Quantyx',
    description: 'Event analytics platform',
    start_url: '/app',
    display: 'standalone',
    background_color: '#FAFAFA',
    theme_color: '#005C5E',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
