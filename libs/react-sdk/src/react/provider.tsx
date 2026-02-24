import { createContext, useEffect, useRef } from 'react';
import { QuantyxClient } from '../client.js';
import type { QuantyxConfig } from '../types.js';

export const QuantyxContext = createContext<QuantyxClient | null>(null);

export interface QuantyxProviderProps {
  config: QuantyxConfig;
  children: React.ReactNode;
}

export function QuantyxProvider({ config, children }: QuantyxProviderProps) {
  const clientRef = useRef<QuantyxClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new QuantyxClient(config);
  }

  useEffect(() => {
    return () => {
      void clientRef.current?.shutdown();
    };
  }, []);

  return <QuantyxContext value={clientRef.current}>{children}</QuantyxContext>;
}
