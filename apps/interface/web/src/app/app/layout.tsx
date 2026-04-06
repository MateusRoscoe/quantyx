'use client';

import { Suspense, useEffect } from 'react';
import {
  useRouter,
  usePathname,
  useParams,
  useSearchParams,
} from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/auth-client';
import {
  useAnalyticsIdentify,
  useAnalyticsTrack,
  useAnalyticsGroup,
  useRoutePattern,
} from '@/hooks/use-analytics';
import { useMembership } from '@/hooks/use-membership';
import { useOrganization } from '@/hooks/use-organizations';
import { getLastVisitedProject } from '@/lib/last-project';
import { ProjectSwitcher } from '@/components/project-switcher';
import { TimezonePicker } from '@/components/timezone-picker';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from 'next-themes';
import {
  Building,
  Building2,
  LayoutDashboard,
  Zap,
  FileText,
  Users,
  Activity,
  Globe,
  Monitor,
  Tags,
  Settings,
  UserCircle,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

const analyticsNavItems = [
  { label: 'Overview', icon: LayoutDashboard, segment: '' },
  { label: 'Events', icon: Zap, segment: '/events' },
  { label: 'Pages', icon: FileText, segment: '/pages' },
  { label: 'Users', icon: Users, segment: '/users' },
  { label: 'Groups', icon: Building, segment: '/groups' },
  { label: 'Sessions', icon: Activity, segment: '/sessions' },
  { label: 'Geography', icon: Globe, segment: '/geography' },
  { label: 'Devices', icon: Monitor, segment: '/devices' },
  { label: 'Properties', icon: Tags, segment: '/properties' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      }
    >
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ orgId?: string; projectId?: string }>();
  const routePattern = useRoutePattern();
  const track = useAnalyticsTrack();
  const identify = useAnalyticsIdentify();
  const group = useAnalyticsGroup();
  const { theme, setTheme } = useTheme();

  const searchParams = useSearchParams();

  const paramsOrgId = params.orgId;
  const paramsProjectId = params.projectId;

  // Fall back to last-visited project for pages without org/project context (e.g. /app/account)
  const lastProject = !paramsOrgId ? getLastVisitedProject() : null;
  const orgId = paramsOrgId ?? lastProject?.orgId;
  const projectId = paramsProjectId ?? lastProject?.projectId;
  const hasProject = !!(orgId && projectId);
  const projectBase = hasProject ? `/app/${orgId}/${projectId}` : '';

  const membership = useMembership(orgId ?? '');
  const { data: org } = useOrganization(orgId ?? '');

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/login');
    }
  }, [isPending, session, router]);

  // Identify user with traits (runs once per session / user data change)
  useEffect(() => {
    if (!session?.user?.id) return;
    identify(session.user.id, {
      props_str: {
        name: session.user.name,
        email: session.user.email,
      },
    });
  }, [session?.user?.id, session?.user?.name, session?.user?.email, identify]);

  // Associate user with organization group
  useEffect(() => {
    if (!session?.user?.id || !orgId || !org) return;
    group('organization', orgId, {
      props_str: { name: org.name },
    });
  }, [session?.user?.id, orgId, org, group]);

  // Track page views on route change
  useEffect(() => {
    if (session?.user?.id) {
      track('page_view', { props_str: { path: routePattern } });
    }
  }, [session?.user?.id, routePattern, track]);

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex-row items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
          <ProjectSwitcher orgId={orgId} projectId={projectId} />
          <Link
            href="/app"
            className="font-display text-lg font-bold text-primary group-data-[collapsible=icon]:hidden"
          >
            Quantyx
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {/* No project context — show navigation entry points */}
          {!hasProject && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === '/app/organizations' ||
                        /^\/app\/[^/]+$/.test(pathname)
                      }
                    >
                      <Link href="/app/organizations">
                        <Building2 className="h-4 w-4" />
                        <span>Organizations</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Analytics nav — when inside a project */}
          {hasProject && (
            <SidebarGroup>
              <SidebarGroupLabel>Analytics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {analyticsNavItems.map((item) => {
                    const basePath = `${projectBase}${item.segment}`;
                    const qs = searchParams.toString();
                    const href = qs ? `${basePath}?${qs}` : basePath;
                    const isActive =
                      item.segment === ''
                        ? pathname === projectBase
                        : pathname.startsWith(basePath);
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Management links */}
          {hasProject && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {membership.isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(
                          `${projectBase}/settings`,
                        )}
                      >
                        <Link href={`${projectBase}/settings`}>
                          <Settings className="h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <TimezonePicker />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Moon className="h-4 w-4 dark:hidden" />
                <Sun className="hidden h-4 w-4 dark:block" />
                <span className="dark:hidden">Dark Mode</span>
                <span className="hidden dark:inline">Light Mode</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/app/account'}>
                <Link href="/app/account">
                  <UserCircle className="h-4 w-4" />
                  <span>Account</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={async () => {
                  track('sign_out');
                  await signOut();
                  router.push('/login');
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-4 pb-2 group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <main className="dashboard-grid-bg flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
