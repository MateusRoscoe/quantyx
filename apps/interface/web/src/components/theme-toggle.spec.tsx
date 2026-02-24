import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle';

const setTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme, theme: 'system' }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ThemeToggle', () => {
  it('renders the toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('calls setTheme("light") when Light is clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /toggle theme/i }));
    await user.click(screen.getByText('Light'));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme("dark") when Dark is clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /toggle theme/i }));
    await user.click(screen.getByText('Dark'));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme("system") when System is clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /toggle theme/i }));
    await user.click(screen.getByText('System'));
    expect(setTheme).toHaveBeenCalledWith('system');
  });
});
