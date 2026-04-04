import { renderHook, act } from '@testing-library/react';
import { render, cleanup } from '@testing-library/react';
import { QuantyxProvider } from './provider.js';
import { useQuantyx, useTrack, useIdentify } from './hooks.js';
import { QuantyxClient } from '../client.js';
import type { QuantyxConfig } from '../types.js';

vi.mock('../client.js', () => {
  const QuantyxClient = vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
  ) {
    this.track = vi.fn();
    this.identify = vi.fn();
    this.flush = vi.fn().mockResolvedValue(undefined);
    this.shutdown = vi.fn().mockResolvedValue(undefined);
  });
  return { QuantyxClient };
});

const TEST_CONFIG: QuantyxConfig = {
  apiKey: 'qx_test',
  endpoint: 'https://test.io',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <QuantyxProvider config={TEST_CONFIG}>{children}</QuantyxProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('useTrack', () => {
  it('returns a function that calls client.track()', () => {
    const { result } = renderHook(() => useTrack(), { wrapper });

    act(() => {
      result.current('page_view', { props_str: { path: '/' } });
    });

    const mockInstance = vi.mocked(QuantyxClient).mock.results[0]?.value as {
      track: ReturnType<typeof vi.fn>;
    };
    expect(mockInstance.track).toHaveBeenCalledWith('page_view', {
      props_str: { path: '/' },
    });
  });
});

describe('useIdentify', () => {
  it('calls client.identify()', () => {
    const { result } = renderHook(() => useIdentify(), { wrapper });

    act(() => {
      result.current('user-123');
    });

    const mockInstance = vi.mocked(QuantyxClient).mock.results[0]?.value as {
      identify: ReturnType<typeof vi.fn>;
    };
    expect(mockInstance.identify).toHaveBeenCalledWith('user-123');
  });
});

describe('useQuantyx', () => {
  it('throws outside QuantyxProvider', () => {
    // Suppress console.error from React for expected error
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useQuantyx())).toThrow(
      'useQuantyx must be used within a <QuantyxProvider>',
    );

    consoleSpy.mockRestore();
  });
});

describe('QuantyxProvider', () => {
  it('calls shutdown() on unmount', () => {
    const { unmount } = render(
      <QuantyxProvider config={TEST_CONFIG}>
        <div>child</div>
      </QuantyxProvider>,
    );

    const mockInstance = vi.mocked(QuantyxClient).mock.results[0]?.value as {
      shutdown: ReturnType<typeof vi.fn>;
    };

    expect(mockInstance.shutdown).not.toHaveBeenCalled();
    unmount();
    expect(mockInstance.shutdown).toHaveBeenCalledOnce();
  });
});
