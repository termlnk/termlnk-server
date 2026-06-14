import type { IPaginatedUsers, IUser } from '../api/endpoints';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/endpoints';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/cn';

const PAGE_LIMIT = 20;

export function UsersPage() {
  const [data, setData] = useState<IPaginatedUsers | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchUsers = useCallback((p: number, q: string) => {
    setLoading(true);
    api.listUsers(p, PAGE_LIMIT, q || undefined)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers(page, query);
  }, [fetchUsers, page, query]);

  const handleSearchInput = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(value);
      setPage(1);
    }, 300);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="tm:p-8">
      <div className="tm:mb-6 tm:flex tm:items-center tm:justify-end">
        <div className="tm:relative tm:w-72">
          <Search className="tm:absolute tm:left-2.5 tm:top-1/2 tm:-translate-y-1/2 tm:h-4 tm:w-4 tm:text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            defaultValue={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="tm:pl-8"
          />
        </div>
      </div>

      <Card>
        {loading && !data
          ? <SkeletonTable />
          : data && data.users.length > 0
            ? (
              <>
                <table className="tm:w-full tm:text-sm">
                  <thead>
                    <tr className="tm:border-b tm:border-border">
                      <th className="tm:px-4 tm:py-3 tm:text-left tm:font-medium tm:text-muted-foreground">User</th>
                      <th className="tm:px-4 tm:py-3 tm:text-left tm:font-medium tm:text-muted-foreground">Email</th>
                      <th className="tm:px-4 tm:py-3 tm:text-left tm:font-medium tm:text-muted-foreground">Status</th>
                      <th className="tm:px-4 tm:py-3 tm:text-left tm:font-medium tm:text-muted-foreground">Verified</th>
                      <th className="tm:px-4 tm:py-3 tm:text-left tm:font-medium tm:text-muted-foreground">Created</th>
                      <th className="tm:px-4 tm:py-3 tm:text-left tm:font-medium tm:text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <UserRow key={user.id} user={user} onStatusChange={() => fetchUsers(page, query)} />
                    ))}
                  </tbody>
                </table>

                <div className="tm:flex tm:items-center tm:justify-between tm:border-t tm:border-border tm:px-4 tm:py-3">
                  <span className="tm:text-sm tm:text-muted-foreground">
                    {data.total}
                    {' '}
                    results, page
                    {data.page}
                    {' '}
                    of
                    {totalPages}
                  </span>
                  <div className="tm:flex tm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )
            : (
              <div className="tm:py-16 tm:text-center tm:text-sm tm:text-muted-foreground">No users found</div>
            )}
      </Card>
    </div>
  );
}

function UserRow({ user, onStatusChange }: { user: IUser; onStatusChange: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleToggleStatus = async () => {
    setActionLoading(true);
    try {
      if (user.isActive) {
        await api.disableUser(user.id);
      } else {
        await api.enableUser(user.id);
      }
      onStatusChange();
    } finally {
      setActionLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <tr className={cn('tm:border-b tm:border-border/50 tm:transition-colors tm:hover:bg-muted/50')}>
        <td className="tm:px-4 tm:py-3">
          <div className="tm:flex tm:items-center tm:gap-3">
            <Avatar
              src={user.avatarUrl}
              fallback={(user.displayName || user.email)[0]?.toUpperCase() ?? '?'}
            />
            <span className="tm:font-medium">{user.displayName || '—'}</span>
          </div>
        </td>
        <td className="tm:px-4 tm:py-3 tm:text-muted-foreground">{user.email}</td>
        <td className="tm:px-4 tm:py-3">
          {user.isActive
            ? <Badge variant="success">Active</Badge>
            : <Badge variant="destructive">Disabled</Badge>}
        </td>
        <td className="tm:px-4 tm:py-3">
          {user.emailVerified
            ? <Badge variant="outline">Verified</Badge>
            : <Badge variant="secondary">Unverified</Badge>}
        </td>
        <td className="tm:px-4 tm:py-3 tm:text-muted-foreground tm:text-xs">
          {new Date(user.createdAt).toLocaleDateString()}
        </td>
        <td className="tm:px-4 tm:py-3">
          <div className="tm:flex tm:items-center tm:gap-1">
            <Link to={`/admin/users/${user.id}`}>
              <Button variant="ghost" size="sm">View</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              {user.isActive ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        title={user.isActive ? 'Disable User' : 'Enable User'}
        description={
          user.isActive
            ? `Are you sure you want to disable ${user.email}? They will not be able to sign in.`
            : `Are you sure you want to enable ${user.email}?`
        }
        confirmText={user.isActive ? 'Disable' : 'Enable'}
        variant={user.isActive ? 'destructive' : 'default'}
        loading={actionLoading}
      />
    </>
  );
}

function SkeletonTable() {
  return (
    <div className="tm:p-4 tm:space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="tm:flex tm:items-center tm:gap-4">
          <Skeleton className="tm:h-9 tm:w-9 tm:rounded-full" />
          <Skeleton className="tm:h-4 tm:w-32" />
          <Skeleton className="tm:h-4 tm:w-48 tm:ml-auto" />
        </div>
      ))}
    </div>
  );
}
