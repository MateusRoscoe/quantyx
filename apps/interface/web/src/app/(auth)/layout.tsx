import { ThemeToggle } from '@/components/theme-toggle';
import { AuthPageTracker } from './page-tracker';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted p-4">
      <AuthPageTracker />
      <div className="absolute top-4 left-4">
        <span className="font-display text-lg font-bold text-primary">
          Quantyx
        </span>
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
