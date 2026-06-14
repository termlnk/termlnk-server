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

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../hooks/use-auth';

export function LoginPage() {
  const { admin, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="tm:bg-background tm:min-h-screen tm:flex tm:items-center tm:justify-center">
        <div className="tm:h-8 tm:w-8 tm:animate-spin tm:rounded-full tm:border-2 tm:border-muted tm:border-t-foreground" />
      </div>
    );
  }

  if (admin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tm:bg-background tm:min-h-screen tm:flex tm:items-center tm:justify-center tm:px-4">
      <div className="tm:w-full tm:max-w-sm">
        <div className="tm:bg-card tm:text-card-foreground tm:border tm:rounded-xl tm:shadow-sm tm:p-8">
          <div className="tm:mb-8 tm:text-center">
            <div className="tm:mx-auto tm:mb-4 tm:flex tm:h-10 tm:w-10 tm:items-center tm:justify-center tm:rounded-lg tm:bg-emerald-500 tm:text-lg tm:font-bold tm:text-white">
              T
            </div>
            <h1 className="tm:text-xl tm:font-semibold">Termlnk Admin</h1>
            <p className="tm:mt-1 tm:text-sm tm:text-muted-foreground">Sign in to the admin dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="tm:space-y-4">
            {error && (
              <div className="tm:rounded-lg tm:border tm:border-destructive/50 tm:bg-destructive/10 tm:px-4 tm:py-2.5 tm:text-sm tm:text-destructive">
                {error}
              </div>
            )}

            <div>
              <label className="tm:mb-1.5 tm:block tm:text-xs tm:font-medium tm:text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="tm:mb-1.5 tm:block tm:text-xs tm:font-medium tm:text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <Button type="submit" disabled={submitting} className="tm:w-full">
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
