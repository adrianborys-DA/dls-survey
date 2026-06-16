import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStatusMessage('Password updated. You can now return to the dashboard.');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#C5B358] text-[#002855] p-2 rounded font-bold text-sm">
            DLS
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#002855]">Reset password</h1>
            <p className="text-sm text-gray-500">Enter your new dashboard password.</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              New password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002855]"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Confirm new password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002855]"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
              {statusMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#002855] text-white rounded-lg py-2.5 font-bold hover:bg-[#003b7a] disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}