import React, { useState } from 'react';
import { PasswordResetRequest, PasswordResetConfirm } from '../../../../shared/src/types/auth';

interface PasswordResetFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type ResetStep = 'request' | 'confirm' | 'success';

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<ResetStep>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Request form state
  const [requestData, setRequestData] = useState<PasswordResetRequest>({
    email: '',
  });

  // Confirm form state
  const [confirmData, setConfirmData] = useState<PasswordResetConfirm>({
    token: '',
    newPassword: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send reset email');
      }

      setStep('confirm');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (confirmData.newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (confirmData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(confirmData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to reset password');
      }

      setStep('success');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setError('');
    setIsLoading(true);

    try {
      await handleRequestSubmit(new Event('submit') as any);
    } catch (error) {
      // Error handling is done in handleRequestSubmit
    }
  };

  if (step === 'success') {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Reset Successful</h2>
          <p className="text-gray-600 mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <button
            onClick={onSuccess}
            className="btn-primary w-full"
          >
            Continue to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'request' ? 'Reset Password' : 'Enter Reset Code'}
          </h2>
          <p className="text-gray-600 mt-2">
            {step === 'request' 
              ? 'Enter your email address and we\'ll send you a reset code'
              : 'Enter the reset code sent to your email and your new password'
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={requestData.email}
                onChange={(e) => setRequestData({ email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your email address"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full btn-secondary py-2"
              >
                Cancel
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleConfirmSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                Reset Code
              </label>
              <input
                type="text"
                id="token"
                value={confirmData.token}
                onChange={(e) => setConfirmData({ ...confirmData, token: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter the 6-digit code"
                required
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Check your email for the reset code. It may take a few minutes to arrive.
              </p>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={confirmData.newPassword}
                onChange={(e) => setConfirmData({ ...confirmData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your new password"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Confirm your new password"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isLoading}
                className="text-sm text-primary-600 hover:text-primary-500 disabled:opacity-50"
              >
                Resend code
              </button>
              
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-sm text-gray-600 hover:text-gray-500"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};