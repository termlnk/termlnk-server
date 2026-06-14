/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { IStatsOverview, ISyncStats, ISyncResourceCount } from '../api/endpoints';
import { useEffect, useState } from 'react';
import { Database, Link, Monitor, Smartphone, TrendingUp, User, Users, Zap } from 'lucide-react';
import {
  Area, AreaChart,
  Bar, BarChart,
  Cell,
  CartesianGrid,
  Pie, PieChart,
  RadialBar, RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
  Legend,
} from 'recharts';
import { api } from '../api/endpoints';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/cn';

const RESOURCE_LABELS: Record<string, string> = {
  host: 'Hosts',
  config: 'Config',
  ai_provider: 'AI Providers',
  mcp_server: 'MCP Servers',
  skill: 'Skills',
  ssh_key: 'SSH Keys',
  identity: 'Identities',
  known_host: 'Known Hosts',
  port_forwarding_rule: 'Port Forwarding',
};

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function DashboardPage() {
  const [stats, setStats] = useState<IStatsOverview | null>(null);
  const [syncStats, setSyncStats] = useState<ISyncStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.statsOverview(), api.syncStats()])
      .then(([overview, sync]) => {
        setStats(overview);
        setSyncStats(sync);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="tm:p-6 tm:space-y-6">
        <div className="tm:grid tm:grid-cols-2 tm:lg:grid-cols-4 tm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="tm:h-32 tm:rounded-xl" />
          ))}
        </div>
        <div className="tm:grid tm:grid-cols-1 tm:lg:grid-cols-7 tm:gap-4">
          <Skeleton className="tm:lg:col-span-4 tm:h-80 tm:rounded-xl" />
          <Skeleton className="tm:lg:col-span-3 tm:h-80 tm:rounded-xl" />
        </div>
        <div className="tm:grid tm:grid-cols-1 tm:lg:grid-cols-3 tm:gap-4">
          <Skeleton className="tm:h-72 tm:rounded-xl" />
          <Skeleton className="tm:h-72 tm:rounded-xl" />
          <Skeleton className="tm:h-72 tm:rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats || !syncStats) {
    return <div className="tm:p-6 tm:text-muted-foreground">Failed to load stats.</div>;
  }

  const pieData = syncStats.perResource
    .filter((r) => r.count > 0)
    .map((r) => ({ name: RESOURCE_LABELS[r.resource] ?? r.resource, value: r.count }));

  const barData = syncStats.perResource.map((r) => ({
    name: RESOURCE_LABELS[r.resource] ?? r.resource,
    count: r.count,
  }));

  const userComposition = [
    { name: 'Active (30d)', value: stats.activeUsers30d, fill: 'var(--chart-1)' },
    { name: 'New (7d)', value: stats.newUsers7d, fill: 'var(--chart-2)' },
    { name: 'Inactive', value: Math.max(0, stats.totalUsers - stats.activeUsers30d), fill: 'var(--chart-4)' },
  ].filter((d) => d.value > 0);

  const deviceOAuthRadial = [
    { name: 'Devices', value: stats.totalDevices, fill: 'var(--chart-1)' },
    { name: 'OAuth', value: stats.totalOAuthIdentities, fill: 'var(--chart-3)' },
    { name: 'Sync Clients', value: syncStats.totalSyncClients, fill: 'var(--chart-2)' },
  ];

  return (
    <div className="tm:p-6 tm:space-y-6">
      {/* ── Row 1: KPI Cards ────────────────────────────────────────────────── */}
      <div className="tm:grid tm:grid-cols-2 tm:lg:grid-cols-4 tm:gap-4">
        <KpiCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          description="All registered accounts"
          trend={stats.newUsers7d > 0 ? `+${stats.newUsers7d} this week` : undefined}
          trendUp={stats.newUsers7d > 0}
        />
        <KpiCard
          title="Active Users"
          value={stats.activeUsers30d}
          icon={Zap}
          description="Active in the last 30 days"
          trend={stats.totalUsers > 0 ? `${Math.round((stats.activeUsers30d / stats.totalUsers) * 100)}% of total` : undefined}
        />
        <KpiCard
          title="Active Devices"
          value={stats.totalDevices}
          icon={Smartphone}
          description="Non-expired sessions"
        />
        <KpiCard
          title="Sync Objects"
          value={syncStats.totalSyncObjects}
          icon={Database}
          description={`Across ${syncStats.totalSyncClients} client${syncStats.totalSyncClients !== 1 ? 's' : ''}`}
        />
      </div>

      {/* ── Row 2–3: 2x2 Chart Grid ──────────────────────────────────────── */}
      <div className="tm:grid tm:grid-cols-2 tm:gap-4">
        {/* Sync distribution bar */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Resource Distribution</CardTitle>
            <CardDescription>Object count per resource type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="tm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--popover-foreground)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User composition pie */}
        <Card>
          <CardHeader>
            <CardTitle>User Composition</CardTitle>
            <CardDescription>Activity breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="tm:h-64 tm:flex tm:items-center tm:justify-center">
              {userComposition.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={userComposition}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {userComposition.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--popover-foreground)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No user data yet" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connections radial */}
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>Devices, OAuth & Sync clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="tm:h-64 tm:flex tm:items-center tm:justify-center">
              {deviceOAuthRadial.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="30%"
                    outerRadius="90%"
                    data={deviceOAuthRadial}
                    startAngle={180}
                    endAngle={0}
                    barSize={14}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      background={{ fill: 'var(--accent)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--popover-foreground)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', color: 'var(--muted-foreground)' }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No connection data" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sync resource detail */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Breakdown</CardTitle>
            <CardDescription>Per-resource object count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="tm:space-y-3">
              {syncStats.perResource.length > 0 ? (
                syncStats.perResource.map((r, i) => (
                  <ResourceBar
                    key={r.resource}
                    label={RESOURCE_LABELS[r.resource] ?? r.resource}
                    count={r.count}
                    total={syncStats.totalSyncObjects}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))
              ) : (
                <p className="tm:text-sm tm:text-muted-foreground tm:py-8 tm:text-center">No sync data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Sync Data area sparkline ─────────────────────────────────── */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Data Landscape</CardTitle>
            <CardDescription>Relative volume comparison across resource types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="tm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={barData} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                  <defs>
                    <linearGradient id="syncGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--popover-foreground)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#syncGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function KpiCard({ title, value, icon: Icon, description, trend, trendUp }: {
  title: string;
  value: number;
  icon: React.ElementType;
  description: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="tm:flex tm:flex-row tm:items-center tm:justify-between tm:pb-2">
        <CardTitle className="tm:text-sm tm:font-medium tm:text-muted-foreground">{title}</CardTitle>
        <Icon className="tm:h-4 tm:w-4 tm:text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="tm:text-2xl tm:font-bold tm:tabular-nums">{value.toLocaleString()}</div>
        <p className="tm:mt-1 tm:text-xs tm:text-muted-foreground">
          {trend ? (
            <span className={cn(trendUp && 'tm:text-emerald-500')}>
              {trendUp && <TrendingUp className="tm:mr-1 tm:inline tm:h-3 tm:w-3" />}
              {trend}
            </span>
          ) : (
            description
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function ResourceBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="tm:space-y-1">
      <div className="tm:flex tm:items-center tm:justify-between tm:text-sm">
        <span className="tm:text-muted-foreground">{label}</span>
        <span className="tm:font-medium tm:tabular-nums">{count}</span>
      </div>
      <div className="tm:h-2 tm:w-full tm:rounded-full tm:bg-accent">
        <div
          className="tm:h-full tm:rounded-full tm:transition-all"
          style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="tm:flex tm:flex-col tm:items-center tm:justify-center tm:gap-2 tm:py-8">
      <Database className="tm:h-8 tm:w-8 tm:text-muted-foreground/30" />
      <p className="tm:text-sm tm:text-muted-foreground">{label}</p>
    </div>
  );
}
