import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Format a number to Argentine locale: dots for thousands, comma for decimals.
 * e.g. 10000 → "10.000", 1234.5 → "1.234,5"
 */
function formatAR(value: number): string {
  if (value === 0) return '';
  // Use Intl to get the base formatting, then clean up trailing zeros
  const parts = value.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = parts[1];
  // Remove trailing zeros from decimal part
  const trimmedDec = decPart.replace(/0+$/, '');
  return trimmedDec ? `${intPart},${trimmedDec}` : intPart;
}

/**
 * Parse a user-typed string in AR format to a number.
 * Accepts: "10.000,50" or "10000.50" or "10000,50" or "10000"
 */
function parseAR(raw: string): number {
  if (!raw.trim()) return 0;
  // If it has both dots and commas, dots are thousands separators
  const cleaned = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

interface CurrencyInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
}

function CurrencyInput({ value, onValueChange, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() => formatAR(value));
  const [isFocused, setIsFocused] = React.useState(false);
  const prevValueRef = React.useRef(value);

  // Sync display when external value changes (but not while user is typing)
  React.useEffect(() => {
    if (!isFocused && value !== prevValueRef.current) {
      setDisplayValue(formatAR(value));
      prevValueRef.current = value;
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Show raw-ish value for easier editing (keep AR format but select all)
    e.target.select();
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const parsed = parseAR(displayValue);
    prevValueRef.current = parsed;
    setDisplayValue(formatAR(parsed));
    onValueChange(parsed);
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, dots, and commas while typing
    if (/^[\d.,]*$/.test(raw)) {
      setDisplayValue(raw);
      // Fire value change on each keystroke for autosave to pick up
      const parsed = parseAR(raw);
      prevValueRef.current = parsed;
      onValueChange(parsed);
    }
  };

  return (
    <input
      data-slot="input"
      inputMode="decimal"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="0,00"
      {...props}
    />
  );
}

export { CurrencyInput, formatAR, parseAR };
