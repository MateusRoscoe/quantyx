'use client';

import { useState, useCallback } from 'react';
import { Plus, Hash, Type, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useFilters, type AnalyticsFilters } from '@/hooks/use-filters';
import { useAnalyticsProperties } from '@/hooks/use-analytics-properties';
import { useParams } from 'next/navigation';

const STANDARD_DIMENSIONS: {
  key: keyof AnalyticsFilters;
  label: string;
}[] = [
  { key: 'event_name', label: 'Event Name' },
  { key: 'user_id', label: 'User ID' },
  { key: 'session_id', label: 'Session ID' },
  { key: 'browser', label: 'Browser' },
  { key: 'os', label: 'OS' },
  { key: 'country', label: 'Country' },
  { key: 'device_type', label: 'Device Type' },
  { key: 'path', label: 'Path' },
];

const propTypeIcon = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
} as const;

const propTypeMap = {
  string: 'str',
  number: 'num',
  boolean: 'bool',
} as const;

type Step =
  | { phase: 'pick-dimension' }
  | { phase: 'pick-value'; dimension: keyof AnalyticsFilters }
  | {
      phase: 'pick-prop-value';
      propName: string;
      propType: 'str' | 'num' | 'bool';
    };

export function FilterBuilder() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setFilter, filters, setPropertyFilter } = useFilters();
  const { data: propsData } = useAnalyticsProperties(projectId);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ phase: 'pick-dimension' });
  const [inputValue, setInputValue] = useState('');

  const reset = useCallback(() => {
    setStep({ phase: 'pick-dimension' });
    setInputValue('');
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) reset();
    },
    [reset],
  );

  const selectDimension = useCallback((key: keyof AnalyticsFilters) => {
    setStep({ phase: 'pick-value', dimension: key });
    setInputValue('');
  }, []);

  const selectProperty = useCallback(
    (name: string, type: 'str' | 'num' | 'bool') => {
      setStep({ phase: 'pick-prop-value', propName: name, propType: type });
      setInputValue('');
    },
    [],
  );

  const applyStandardFilter = useCallback(
    (key: keyof AnalyticsFilters, value: string) => {
      const existing = filters[key] ?? [];
      if (!existing.includes(value)) {
        setFilter(key, [...existing, value]);
      }
      setOpen(false);
      reset();
    },
    [filters, setFilter, reset],
  );

  const applyPropertyFilter = useCallback(
    (type: 'str' | 'num' | 'bool', name: string, value: string) => {
      setPropertyFilter(type, name, value);
      setOpen(false);
      reset();
    },
    [setPropertyFilter, reset],
  );

  const handleInputSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    if (step.phase === 'pick-value') {
      applyStandardFilter(step.dimension, inputValue.trim());
    } else if (step.phase === 'pick-prop-value') {
      applyPropertyFilter(step.propType, step.propName, inputValue.trim());
    }
  }, [inputValue, step, applyStandardFilter, applyPropertyFilter]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Plus className="h-3 w-3" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {step.phase === 'pick-dimension' && (
          <Command>
            <CommandInput placeholder="Search dimensions..." />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Standard">
                {STANDARD_DIMENSIONS.map(({ key, label }) => (
                  <CommandItem
                    key={key}
                    onSelect={() => selectDimension(key)}
                  >
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {propsData?.properties && propsData.properties.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Custom Properties">
                    {propsData.properties.map((prop) => {
                      const Icon =
                        propTypeIcon[
                          prop.type as keyof typeof propTypeIcon
                        ] ?? Type;
                      const mappedType =
                        propTypeMap[prop.type as keyof typeof propTypeMap];
                      if (!mappedType) return null;
                      return (
                        <CommandItem
                          key={`${prop.type}-${prop.name}`}
                          onSelect={() =>
                            selectProperty(prop.name, mappedType)
                          }
                        >
                          <Icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          {prop.name}
                          <Badge
                            variant="secondary"
                            className="ml-auto text-[10px]"
                          >
                            {prop.type}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}

        {step.phase === 'pick-value' && (
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {STANDARD_DIMENSIONS.find((d) => d.key === step.dimension)
                ?.label ?? step.dimension}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleInputSubmit();
              }}
            >
              <Input
                autoFocus
                placeholder="Type a value..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-8 text-sm"
              />
            </form>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={reset}
              >
                Back
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleInputSubmit}
                disabled={!inputValue.trim()}
              >
                Apply
              </Button>
            </div>
          </div>
        )}

        {step.phase === 'pick-prop-value' && (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {step.propName}
              </p>
              <Badge variant="secondary" className="text-[10px]">
                {step.propType}
              </Badge>
            </div>
            {step.propType === 'bool' ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() =>
                    applyPropertyFilter(step.propType, step.propName, 'true')
                  }
                >
                  true
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() =>
                    applyPropertyFilter(step.propType, step.propName, 'false')
                  }
                >
                  false
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInputSubmit();
                }}
              >
                <Input
                  autoFocus
                  placeholder={
                    step.propType === 'num' ? 'Enter number...' : 'Type a value...'
                  }
                  type={step.propType === 'num' ? 'number' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="h-8 text-sm"
                />
              </form>
            )}
            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={reset}
              >
                Back
              </Button>
              {step.propType !== 'bool' && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleInputSubmit}
                  disabled={!inputValue.trim()}
                >
                  Apply
                </Button>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
