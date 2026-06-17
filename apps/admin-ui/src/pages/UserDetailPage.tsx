import type { IDevice, IOAuthIdentity, ISyncResourceCount, IUserDetail, IUserSyncStats } from '../api/endpoints';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/endpoints';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<IUserDetail | null>(null);
  const [devices, setDevices] = useState<IDevice[]>([]);
  const [identities, setIdentities] = useState<IOAuthIdentity[]>([]);
  const [syncStats, setSyncStats] = useState<IUserSyncStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [userRes, devicesRes, oauthRes, syncRes] = await Promise.all([
        api.getUser(id),
        api.getUserDevices(id),
        api.getUserOAuthIdentities(id),
        api.getUserSyncStats(id),
      ]);
      setUser(userRes.user);
      setDevices(devicesRes.devices);
      setIdentities(oauthRes.identities);
      setSyncStats(syncRes);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!user) {
    return <div className="tm:p-8 tm:text-muted-foreground">User not found.</div>;
  }

  return (
    <div className="tm:p-8">
      <Link
        to="/admin/users"
        className="tm:mb-6 tm:inline-flex tm:items-center tm:gap-1 tm:text-sm tm:text-muted-foreground tm:transition-colors tm:hover:text-foreground"
      >
        &larr; Back to Users
      </Link>

      <UserHeader user={user} devices={devices} setUser={setUser} setDevices={setDevices} />

      <div className="tm:mt-6 tm:grid tm:grid-cols-1 tm:lg:grid-cols-2 tm:gap-6">
        <AccountInfoCard user={user} />
        <SyncDataCard user={user} syncStats={syncStats} setSyncStats={setSyncStats} />
        <DevicesCard
          user={user}
          devices={devices}
          setDevices={setDevices}
        />
        <OAuthIdentitiesCard identities={identities} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  User Header                                                       */
/* ------------------------------------------------------------------ */

function UserHeader({
  user,
  devices,
  setUser,
  setDevices,
}: {
  user: IUserDetail;
  devices: IDevice[];
  setUser: React.Dispatch<React.SetStateAction<IUserDetail | null>>;
  setDevices: React.Dispatch<React.SetStateAction<IDevice[]>>;
}) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleToggleStatus = async () => {
    setActionLoading(true);
    try {
      if (user.isActive) {
        await api.disableUser(user.id);
      } else {
        await api.enableUser(user.id);
      }
      setUser((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev);
    } finally {
      setActionLoading(false);
      setStatusDialogOpen(false);
    }
  };

  const handleRevokeAll = async () => {
    setActionLoading(true);
    try {
      await api.revokeAllDevices(user.id);
      setDevices([]);
    } finally {
      setActionLoading(false);
      setRevokeDialogOpen(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="tm:p-6">
          <div className="tm:flex tm:items-center tm:justify-between">
            <div className="tm:flex tm:items-center tm:gap-4">
              <Avatar
                src={user.avatarUrl}
                fallback={(user.displayName || user.email)[0]?.toUpperCase() ?? '?'}
                size="lg"
              />
              <div>
                <h1 className="tm:text-xl tm:font-semibold">{user.displayName || user.email}</h1>
                <p className="tm:text-sm tm:text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={user.isActive ? 'success' : 'destructive'} className="tm:ml-2">
                {user.isActive ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className="tm:flex tm:items-center tm:gap-2">
              <Button
                variant={user.isActive ? 'destructive' : 'default'}
                size="sm"
                onClick={() => setStatusDialogOpen(true)}
              >
                {user.isActive ? 'Disable' : 'Enable'}
              </Button>
              {devices.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevokeDialogOpen(true)}
                >
                  Revoke All Sessions
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
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

      <ConfirmDialog
        open={revokeDialogOpen}
        onClose={() => setRevokeDialogOpen(false)}
        onConfirm={handleRevokeAll}
        title="Revoke All Sessions"
        description={`This will revoke all active sessions for ${user.email}. They will need to sign in again.`}
        confirmText="Revoke All"
        variant="destructive"
        loading={actionLoading}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Account Info Card                                                  */
/* ------------------------------------------------------------------ */

function AccountInfoCard({ user }: { user: IUserDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="tm:grid tm:grid-cols-2 tm:gap-y-3 tm:text-sm">
          <span className="tm:text-muted-foreground">ID</span>
          <span className="tm:font-mono tm:text-xs tm:break-all">{user.id}</span>

          <span className="tm:text-muted-foreground">Email</span>
          <span>{user.email}</span>

          <span className="tm:text-muted-foreground">Email Verified</span>
          <span>
            {user.emailVerified
              ? <Badge variant="success">Verified</Badge>
              : <Badge variant="secondary">Unverified</Badge>}
          </span>

          <span className="tm:text-muted-foreground">Encryption Password</span>
          <span>
            {user.hasEncryptionPassword
              ? <Badge variant="outline">Yes</Badge>
              : <Badge variant="secondary">No</Badge>}
          </span>

          <span className="tm:text-muted-foreground">Created</span>
          <span>{new Date(user.createdAt).toLocaleString()}</span>

          <span className="tm:text-muted-foreground">Updated</span>
          <span>{new Date(user.updatedAt).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Sync Data Card                                                     */
/* ------------------------------------------------------------------ */

function SyncDataCard({
  user,
  syncStats,
  setSyncStats,
}: {
  user: IUserDetail;
  syncStats: IUserSyncStats | null;
  setSyncStats: React.Dispatch<React.SetStateAction<IUserSyncStats | null>>;
}) {
  const [clearTarget, setClearTarget] = useState<ISyncResourceCount | null>(null);
  const [clearLoading, setClearLoading] = useState(false);

  const handleClearResource = async () => {
    if (!clearTarget) {
      return;
    }

    setClearLoading(true);
    try {
      await api.clearUserSyncResource(user.id, clearTarget.resource);
      setSyncStats((prev) => {
        if (!prev) {
          return prev;
        }

        const nextPerResource = prev.perResource.filter((r) => r.resource !== clearTarget.resource);
        return {
          ...prev,
          perResource: nextPerResource,
          totalSyncObjects: nextPerResource.reduce((sum, r) => sum + r.count, 0),
        };
      });
    } finally {
      setClearLoading(false);
      setClearTarget(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sync Data</CardTitle>
        </CardHeader>
        <CardContent>
          {!syncStats || syncStats.perResource.length === 0
            ? (
              <p className="tm:text-sm tm:text-muted-foreground">No sync data</p>
            )
            : (
              <>
                <table className="tm:w-full tm:text-sm">
                  <thead>
                    <tr className="tm:border-b tm:border-border">
                      <th className="tm:px-2 tm:py-2 tm:text-left tm:font-medium tm:text-muted-foreground">Resource</th>
                      <th className="tm:px-2 tm:py-2 tm:text-right tm:font-medium tm:text-muted-foreground">Objects</th>
                      <th className="tm:px-2 tm:py-2 tm:text-right tm:font-medium tm:text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncStats.perResource.map((r) => (
                      <tr key={r.resource} className="tm:border-b tm:border-border/50">
                        <td className="tm:px-2 tm:py-2">{r.resource}</td>
                        <td className="tm:px-2 tm:py-2 tm:text-right tm:tabular-nums">{r.count}</td>
                        <td className="tm:px-2 tm:py-2 tm:text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="tm:text-destructive tm:hover:text-destructive"
                            onClick={() => setClearTarget(r)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Separator className="tm:my-3" />
                <p className="tm:text-sm tm:text-muted-foreground">
                  Sync Clients:
                  {' '}
                  <span className="tm:text-foreground tm:font-medium">{syncStats.syncClients.length}</span>
                </p>
              </>
            )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={clearTarget !== null}
        onClose={() => setClearTarget(null)}
        onConfirm={handleClearResource}
        title="Delete Sync Data"
        description={
          clearTarget
            ? `Delete ${clearTarget.count} ${clearTarget.resource} sync object${clearTarget.count === 1 ? '' : 's'} for ${user.email}? This syncs as deletions to the user's devices.`
            : ''
        }
        confirmText="Delete"
        variant="destructive"
        loading={clearLoading}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Active Devices Card                                                */
/* ------------------------------------------------------------------ */

function DevicesCard({
  user,
  devices,
  setDevices,
}: {
  user: IUserDetail;
  devices: IDevice[];
  setDevices: React.Dispatch<React.SetStateAction<IDevice[]>>;
}) {
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const handleRevoke = async () => {
    if (!revokeTarget) {
      return;
    }
    setRevokeLoading(true);
    try {
      await api.revokeDevice(user.id, revokeTarget);
      setDevices((prev) => prev.filter((d) => d.jti !== revokeTarget));
    } finally {
      setRevokeLoading(false);
      setRevokeTarget(null);
    }
  };

  return (
    <>
      <Card className="tm:lg:col-span-2">
        <CardHeader>
          <CardTitle>
            Active Devices (
            {devices.length}
            )
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0
            ? (
              <p className="tm:text-sm tm:text-muted-foreground">No active devices</p>
            )
            : (
              <table className="tm:w-full tm:text-sm">
                <thead>
                  <tr className="tm:border-b tm:border-border">
                    <th className="tm:px-2 tm:py-2 tm:text-left tm:font-medium tm:text-muted-foreground">Device Name</th>
                    <th className="tm:px-2 tm:py-2 tm:text-left tm:font-medium tm:text-muted-foreground">User Agent</th>
                    <th className="tm:px-2 tm:py-2 tm:text-left tm:font-medium tm:text-muted-foreground">Last Seen</th>
                    <th className="tm:px-2 tm:py-2 tm:text-left tm:font-medium tm:text-muted-foreground">Created</th>
                    <th className="tm:px-2 tm:py-2 tm:text-left tm:font-medium tm:text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.jti} className="tm:border-b tm:border-border/50">
                      <td className="tm:px-2 tm:py-2">{device.deviceName || '—'}</td>
                      <td className="tm:px-2 tm:py-2 tm:text-muted-foreground tm:text-xs tm:max-w-[240px] tm:truncate">
                        {device.userAgent || '—'}
                      </td>
                      <td className="tm:px-2 tm:py-2 tm:text-xs tm:text-muted-foreground">
                        {new Date(device.lastSeenAt).toLocaleString()}
                      </td>
                      <td className="tm:px-2 tm:py-2 tm:text-xs tm:text-muted-foreground">
                        {new Date(device.createdAt).toLocaleString()}
                      </td>
                      <td className="tm:px-2 tm:py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="tm:text-destructive tm:hover:text-destructive"
                          onClick={() => setRevokeTarget(device.jti)}
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke Device"
        description="Are you sure you want to revoke this device session? The device will need to sign in again."
        confirmText="Revoke"
        variant="destructive"
        loading={revokeLoading}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  OAuth Identities Card                                              */
/* ------------------------------------------------------------------ */

function OAuthIdentitiesCard({ identities }: { identities: IOAuthIdentity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OAuth Identities</CardTitle>
      </CardHeader>
      <CardContent>
        {identities.length === 0
          ? (
            <p className="tm:text-sm tm:text-muted-foreground">No linked accounts</p>
          )
          : (
            <div className="tm:space-y-3">
              {identities.map((ident) => (
                <div key={ident.id} className="tm:flex tm:items-center tm:gap-3">
                  <Badge variant="outline" className="tm:capitalize">{ident.provider}</Badge>
                  <span className="tm:text-sm">{ident.email || '—'}</span>
                  <span className="tm:ml-auto tm:text-xs tm:text-muted-foreground">
                    Linked
                    {' '}
                    {new Date(ident.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="tm:p-8 tm:space-y-6">
      <Skeleton className="tm:h-4 tm:w-32" />
      <Card>
        <CardContent className="tm:p-6">
          <div className="tm:flex tm:items-center tm:gap-4">
            <Skeleton className="tm:h-12 tm:w-12 tm:rounded-full" />
            <div className="tm:space-y-2">
              <Skeleton className="tm:h-5 tm:w-48" />
              <Skeleton className="tm:h-4 tm:w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="tm:grid tm:grid-cols-1 tm:lg:grid-cols-2 tm:gap-6">
        <Card>
          <CardHeader><Skeleton className="tm:h-5 tm:w-28" /></CardHeader>
          <CardContent className="tm:space-y-3">
            <Skeleton className="tm:h-4 tm:w-full" />
            <Skeleton className="tm:h-4 tm:w-full" />
            <Skeleton className="tm:h-4 tm:w-3/4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="tm:h-5 tm:w-28" /></CardHeader>
          <CardContent className="tm:space-y-3">
            <Skeleton className="tm:h-4 tm:w-full" />
            <Skeleton className="tm:h-4 tm:w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
