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

import type { ISyncStats } from '../api/endpoints';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

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

function formatResource(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

export function SyncPage() {
  const [stats, setStats] = useState<ISyncStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.syncStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="tm:p-8">
        <Skeleton className="tm:mb-6 tm:h-7 tm:w-36" />
        <div className="tm:grid tm:gap-4 tm:sm:grid-cols-2">
          <Skeleton className="tm:h-28 tm:rounded-xl" />
          <Skeleton className="tm:h-28 tm:rounded-xl" />
        </div>
        <Skeleton className="tm:mt-6 tm:h-72 tm:rounded-xl" />
        <Skeleton className="tm:mt-6 tm:h-64 tm:rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return <div className="tm:p-8 tm:text-muted-foreground">Failed to load sync stats.</div>;
  }

  const totalObjects = stats.totalSyncObjects;
  const chartData = stats.perResource.map((r) => ({
    name: formatResource(r.resource),
    count: r.count,
  }));

  return (
    <div className="tm:p-8">
      {/* Stats cards */}
      <div className="tm:grid tm:gap-4 tm:sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="tm:text-sm tm:font-medium tm:text-muted-foreground">
              Total Sync Objects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tm:text-2xl tm:font-semibold tm:tabular-nums">
              {stats.totalSyncObjects.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="tm:text-sm tm:font-medium tm:text-muted-foreground">
              Active Sync Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tm:text-2xl tm:font-semibold tm:tabular-nums">
              {stats.totalSyncClients.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart */}
      <Card className="tm:mt-6">
        <CardHeader>
          <CardTitle>Resource Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card className="tm:mt-6">
        <CardHeader>
          <CardTitle>Per-Resource Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="tm:w-full tm:text-left tm:text-sm">
            <thead>
              <tr className="tm:border-b tm:text-xs tm:font-medium tm:uppercase tm:tracking-wider tm:text-muted-foreground">
                <th className="tm:px-4 tm:py-3">Resource</th>
                <th className="tm:px-4 tm:py-3">Count</th>
                <th className="tm:px-4 tm:py-3">Percentage</th>
              </tr>
            </thead>
            <tbody className="tm:divide-y">
              {stats.perResource.map((r, index) => {
                const pct = totalObjects > 0 ? (r.count / totalObjects) * 100 : 0;
                return (
                  <tr key={r.resource}>
                    <td className="tm:px-4 tm:py-3">{formatResource(r.resource)}</td>
                    <td className="tm:px-4 tm:py-3 tm:tabular-nums">{r.count.toLocaleString()}</td>
                    <td className="tm:px-4 tm:py-3">
                      <div className="tm:flex tm:items-center tm:gap-3">
                        <div className="tm:h-2 tm:w-24 tm:overflow-hidden tm:rounded-full tm:bg-muted">
                          <div
                            className="tm:h-full tm:rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="tm:text-xs tm:text-muted-foreground tm:tabular-nums">
                          {pct.toFixed(1)}
                          %
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
