import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/use-theme';
import { cn } from '../../lib/cn';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: Sun },
    { value: 'dark' as const, icon: Moon },
    { value: 'system' as const, icon: Monitor },
  ];

  return (
    <div className="tm:flex tm:items-center tm:rounded-lg tm:border tm:border-border tm:p-0.5">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'tm:rounded-md tm:p-1.5 tm:transition-colors tm:cursor-pointer',
            theme === value
              ? 'tm:bg-accent tm:text-accent-foreground'
              : 'tm:text-muted-foreground tm:hover:text-foreground'
          )}
          title={value.charAt(0).toUpperCase() + value.slice(1)}
        >
          <Icon className="tm:h-3.5 tm:w-3.5" />
        </button>
      ))}
    </div>
  );
}
