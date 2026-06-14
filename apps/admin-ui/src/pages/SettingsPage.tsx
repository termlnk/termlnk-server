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
import { api } from '../api/endpoints';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { useAuth } from '../hooks/use-auth';

export function SettingsPage() {
  const { admin } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPwSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tm:p-8">
      <div className="tm:flex tm:flex-col tm:gap-6">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your admin account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="tm:max-w-sm tm:space-y-4">
              {pwError && (
                <div className="tm:rounded-lg tm:border tm:border-destructive/50 tm:bg-destructive/10 tm:px-4 tm:py-2.5 tm:text-sm tm:text-destructive">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="tm:rounded-lg tm:border tm:border-success/50 tm:bg-success/10 tm:px-4 tm:py-2.5 tm:text-sm tm:text-success">
                  {pwSuccess}
                </div>
              )}

              <div>
                <label className="tm:mb-1.5 tm:block tm:text-sm tm:font-medium">Current Password</label>
                <Input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <Separator />

              <div>
                <label className="tm:mb-1.5 tm:block tm:text-sm tm:font-medium">New Password</label>
                <Input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="tm:mb-1.5 tm:block tm:text-sm tm:font-medium">Confirm New Password</label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="tm:grid tm:grid-cols-[auto_1fr] tm:gap-x-8 tm:gap-y-3 tm:text-sm">
              <dt className="tm:text-muted-foreground">Email</dt>
              <dd>{admin?.email ?? '---'}</dd>
              <dt className="tm:text-muted-foreground">Last Login</dt>
              <dd>{admin?.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
