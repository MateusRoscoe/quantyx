import { render, screen } from '@/test/test-utils';
import { Breadcrumbs } from './breadcrumbs';

const mockUsePathname = vi.fn<() => string>();
const mockUseParams = vi.fn<() => Record<string, string | undefined>>();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useParams: () => mockUseParams(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/hooks/use-organizations', () => ({
  useOrganization: (id: string) => ({
    data: { name: `Org ${id}` },
  }),
}));

vi.mock('@/hooks/use-projects', () => ({
  useProject: (id: string) => ({
    data: { name: `Project ${id}` },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('Breadcrumbs', () => {
  it('returns null for /dashboard', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    mockUseParams.mockReturnValue({});
    const { container } = render(<Breadcrumbs />);
    expect(container.innerHTML).toBe('');
  });

  it('capitalizes static segments', () => {
    mockUsePathname.mockReturnValue('/dashboard/settings');
    mockUseParams.mockReturnValue({});
    render(<Breadcrumbs />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows organization name for orgId segment', () => {
    mockUsePathname.mockReturnValue('/dashboard/organizations/org-123');
    mockUseParams.mockReturnValue({ orgId: 'org-123' });
    render(<Breadcrumbs />);
    expect(screen.getByText('Org org-123')).toBeInTheDocument();
  });

  it('shows project name for projectId segment', () => {
    mockUsePathname.mockReturnValue(
      '/dashboard/organizations/org-1/projects/proj-1',
    );
    mockUseParams.mockReturnValue({ orgId: 'org-1', projectId: 'proj-1' });
    render(<Breadcrumbs />);
    expect(screen.getByText('Project proj-1')).toBeInTheDocument();
  });

  it('renders the last segment as non-link (BreadcrumbPage)', () => {
    mockUsePathname.mockReturnValue('/dashboard/settings');
    mockUseParams.mockReturnValue({});
    render(<Breadcrumbs />);
    const settingsEl = screen.getByText('Settings');
    // The last segment should not be wrapped in <a>
    expect(settingsEl.closest('a')).toBeNull();
  });

  it('renders earlier segments as links', () => {
    mockUsePathname.mockReturnValue('/dashboard/settings');
    mockUseParams.mockReturnValue({});
    render(<Breadcrumbs />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });
});
