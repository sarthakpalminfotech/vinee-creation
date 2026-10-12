import React, { useState, useRef, useMemo, useEffect, useId } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Search, ChevronDown, Check, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function DropdownCore({
  options,
  placeholder = 'Select',
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearchChange,
  loading,
  emptyText = 'No results',
  disabled,
  invalid,
  id,
  className,
  triggerClassName,
  triggerText,
  isSelected,
  onPick,
  closeOnPick,
  multiple,
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const searchRef = useRef(null);
  const listRef = useRef(null);
  const uniqueId = useId();
  const triggerId = id ?? `${uniqueId}-trigger`;
  const listId = `${uniqueId}-list`;

  const visible = useMemo(() => {
    if (!searchable || !query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        String(o.label).toLowerCase().includes(q) ||
        (o.description ? String(o.description).toLowerCase().includes(q) : false) ||
        String(o.value).toLowerCase().includes(q)
    );
  }, [options, searchable, query]);

  const changeOpen = (val) => {
    if (disabled) return;
    setOpen(val);
    if (val) {
      setQuery('');
      onSearchChange?.('');
      const firstSelected = visible.findIndex((o) => isSelected(o.value));
      setActive(firstSelected >= 0 ? firstSelected : 0);
    }
  };

  useEffect(() => {
    if (open) {
      setActive(0);
    }
  }, [query, open]);

  useEffect(() => {
    if (open && active >= 0 && listRef.current) {
      const el = document.getElementById(`${listId}-${active}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [active, open, listId]);

  const pick = (opt) => {
    if (opt.disabled) return;
    onPick(opt);
    if (closeOnPick) {
      changeOpen(false);
      document.getElementById(triggerId)?.focus();
    }
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((p) => (p < visible.length - 1 ? p + 1 : p));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((p) => (p > 0 ? p - 1 : p));
        break;
      case 'Home':
        if (!searchable) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (!searchable) {
          e.preventDefault();
          setActive(visible.length - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (visible[active]) pick(visible[active]);
        break;
      case ' ':
        if (!searchable && visible[active]) {
          e.preventDefault();
          pick(visible[active]);
        }
        break;
      case 'Tab':
        changeOpen(false);
        break;
    }
  };

  return (
    <div className={cn('flex min-w-0 items-stretch gap-2', className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
        <PopoverPrimitive.Trigger asChild disabled={disabled}>
          <button
            id={triggerId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-invalid={invalid || undefined}
            aria-label={ariaLabel}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                changeOpen(true);
              }
            }}
            className={cn(
              'flex h-11 min-w-0 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              open && 'border-primary-500 ring-1 ring-primary-500',
              invalid && !open && 'border-red-400',
              triggerClassName
            )}
          >
            <span className={cn('truncate', triggerText ? 'font-medium text-slate-900' : 'text-slate-400')}>
              {triggerText ?? placeholder}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200', open && 'rotate-180 text-primary-600')}
              aria-hidden
            />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
            }}
            onKeyDown={onKeyDown}
            className="z-[150] flex w-[var(--radix-popover-trigger-width)] min-w-[200px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg outline-none animate-in fade-in-0 zoom-in-[0.98]"
            style={{ maxHeight: 'min(340px, var(--radix-popover-content-available-height))' }}
          >
            {searchable && (
              <div className="shrink-0 border-b border-slate-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      onSearchChange?.(e.target.value);
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    autoComplete="off"
                    className="h-9 w-full rounded-md bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  {loading && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />
                  )}
                </div>
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-multiselectable={multiple || undefined}
              aria-activedescendant={!searchable && active >= 0 ? `${listId}-${active}` : undefined}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5 outline-none"
            >
              {visible.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-500">
                  {loading ? 'Loading...' : emptyText}
                </li>
              ) : (
                visible.map((option, i) => {
                  const selected = isSelected(option.value);
                  return (
                    <li
                      key={String(option.value)}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={option.disabled || undefined}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={() => pick(option)}
                      className={cn(
                        'mx-1.5 flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-800',
                        i === active && 'bg-slate-100',
                        selected && 'bg-primary-50 text-primary-700',
                        selected && i === active && 'bg-primary-100',
                        option.disabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className={cn('block truncate text-xs font-normal mt-0.5', selected ? 'text-primary-600/70' : 'text-slate-500')}>
                            {option.description}
                          </span>
                        )}
                      </span>
                      <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} aria-hidden />
                    </li>
                  );
                })
              )}
            </ul>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

export const Select = React.forwardRef(({ className = '', error, children, value, onChange, disabled, required, ...props }, ref) => {
  const options = [];
  let placeholder = "Select...";

  React.Children.toArray(children).forEach(child => {
    if (child && child.type === 'option') {
      const val = child.props.value;
      const label = child.props.children;
      const opt = { value: val, label: label };
      if (val === "" || val == null) {
        placeholder = label;
        // A non-required select keeps its empty option ("All qualities", "Select mill…") selectable,
        // so a filter can always be reset to "all" after something was chosen.
        if (!required) options.unshift({ value: '', label });
      } else {
        options.push(opt);
      }
    }
  });

  const empty = value === '' || value == null;
  const current = empty ? null : options.find((o) => String(o.value) === String(value));
  const text = current?.label ?? null;

  return (
    <DropdownCore
      {...props}
      id={props.id}
      className={className}
      disabled={disabled}
      invalid={error}
      options={options}
      placeholder={placeholder}
      triggerText={text}
      isSelected={(v) => (empty ? v === '' : String(v) === String(value))}
      onPick={(o) => {
        if (onChange) {
          onChange({ target: { value: String(o.value) } });
        }
      }}
      closeOnPick
      multiple={false}
    />
  );
});
