import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, LayoutDashboard, LogOut, RefreshCw, Settings, Users } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useSidebar } from '../hooks/use-sidebar';
import { cn } from '../lib/cn';
import { ThemeToggle } from './ui/theme-toggle';
import { Avatar } from './ui/avatar';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/sync', label: 'Sync Data', icon: RefreshCw },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  sync: 'Sync Data',
  settings: 'Settings',
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const parts = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Dashboard' }];
  if (parts.length === 1) return [{ label: BREADCRUMB_LABELS[parts[0]] ?? parts[0] }];
  return parts.map((part, i) => ({
    label: BREADCRUMB_LABELS[part] ?? part,
    href: i < parts.length - 1 ? `/admin/${parts.slice(0, i + 1).join('/')}` : undefined,
  }));
}

export function Layout() {
  const { admin, logout, loading } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const location = useLocation();

  if (loading) {
    return (
      <div className="tm:flex tm:h-screen tm:items-center tm:justify-center tm:bg-background">
        <div className="tm:h-8 tm:w-8 tm:animate-spin tm:rounded-full tm:border-2 tm:border-muted tm:border-t-foreground" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="tm:flex tm:h-screen tm:bg-background tm:text-foreground">
      {/* Sidebar */}
      <div className="tm:relative">
        <aside
          className={cn(
            'tm:flex tm:h-full tm:flex-col tm:bg-sidebar tm:text-sidebar-foreground tm:border-r tm:border-sidebar-border tm:transition-all tm:duration-300',
            collapsed ? 'tm:w-16' : 'tm:w-64'
          )}
        >
          {/* Logo */}
          <div className="tm:flex tm:h-14 tm:items-center tm:gap-2 tm:px-4">
            <div className="tm:flex tm:h-8 tm:w-8 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-lg tm:bg-emerald-600 tm:text-sm tm:font-bold tm:text-white">
              T
            </div>
            {!collapsed && (
              <span className="tm:text-sm tm:font-semibold tm:tracking-tight">Termlnk Admin</span>
            )}
          </div>

          <Separator />

          {/* Nav */}
          <nav className="tm:flex-1 tm:space-y-1 tm:p-3">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'tm:flex tm:items-center tm:gap-3 tm:rounded-lg tm:px-3 tm:py-2 tm:text-sm tm:transition-colors',
                    collapsed && 'tm:justify-center tm:px-0',
                    isActive
                      ? 'tm:bg-sidebar-accent tm:text-sidebar-accent-foreground tm:font-medium'
                      : 'tm:text-sidebar-foreground/70 tm:hover:bg-sidebar-accent/50 tm:hover:text-sidebar-foreground'
                  )
                }
                title={label}
              >
                <Icon className="tm:h-4 tm:w-4 tm:shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Sidebar toggle — positioned on the border between sidebar and content */}
        <button
          onClick={toggle}
          className={cn(
            'tm:absolute tm:top-7 tm:-right-3 tm:z-10 tm:flex tm:h-6 tm:w-6 tm:items-center tm:justify-center',
            'tm:rounded-full tm:border tm:border-border tm:bg-background tm:text-muted-foreground',
            'tm:shadow-sm tm:transition-transform tm:cursor-pointer tm:hover:text-foreground'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={cn(
              'tm:h-3 tm:w-3 tm:transition-transform tm:duration-300',
              collapsed && 'tm:rotate-180'
            )}
          />
        </button>
      </div>

      {/* Main content */}
      <div className="tm:flex tm:flex-1 tm:flex-col tm:overflow-hidden">
        {/* Header */}
        <header className="tm:flex tm:h-14 tm:shrink-0 tm:items-center tm:justify-between tm:border-b tm:border-border tm:bg-background tm:px-6">
          <Breadcrumbs pathname={location.pathname} />
          <div className="tm:flex tm:items-center tm:gap-3">
            <ThemeToggle />
            <Separator orientation="vertical" className="tm:h-6" />
            <DropdownMenu
              align="end"
              side="bottom"
              trigger={
                <button className="tm:flex tm:items-center tm:gap-2 tm:rounded-lg tm:px-2 tm:py-1.5 tm:transition-colors tm:cursor-pointer tm:hover:bg-accent">
                  <Avatar fallback={admin.email[0]?.toUpperCase() ?? 'A'} size="sm" />
                  <span className="tm:text-sm tm:text-muted-foreground">{admin.email}</span>
                </button>
              }
            >
              <DropdownMenuLabel>{admin.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut className="tm:h-4 tm:w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="tm:flex-1 tm:overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const items = getBreadcrumbs(pathname);
  return (
    <nav className="tm:flex tm:items-center tm:gap-1.5 tm:text-sm tm:text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="tm:flex tm:items-center tm:gap-1.5">
          {i > 0 && <ChevronRight className="tm:h-3.5 tm:w-3.5" />}
          {item.href ? (
            <a href={item.href} className="tm:hover:text-foreground tm:transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="tm:text-foreground tm:font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
