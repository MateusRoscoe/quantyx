import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';
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
        <Logo variant="wordmark" size={20} className="text-primary" />
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
