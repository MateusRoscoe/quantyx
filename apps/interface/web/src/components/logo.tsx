import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'icon' | 'wordmark';
  size?: number;
  className?: string;
}

export function Logo({ variant = 'wordmark', size = 24, className }: LogoProps) {
  const icon = (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16 2L28.124 9V23L16 30L3.876 23V9L16 2Z"
        fill="var(--primary)"
      />
      <path
        d="M10 20L16 14L22 20L26 16"
        stroke="var(--primary-foreground)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === 'icon') {
    return <span className={cn('inline-flex items-center', className)}>{icon}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {icon}
      <span className="font-display font-bold" style={{ fontSize: size * 0.75 }}>
        Quantyx
      </span>
    </span>
  );
}
