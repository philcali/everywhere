import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { UserPreferences, ChangePasswordRequest } from '../../../../shared/src/types/auth';

interface UserProfileProps {
  onClose?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'password'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile form state
  const [profileData, setProfileData] = useState({
    displayName: user?.profile.displayName || '',
  });

  // Preferences form state
  const [preferencesData, setPreferencesData] = useState<UserPreferences>({
    defaultTravelMode: user?.profile.preferences.defaultTravelMode || 'driving',
    temperatureUnit: user?.profile.preferences.temperatureUnit || 'celsius',
    distanceUnit: user?.profile.preferences.distanceUnit || 'metric',
    autoSaveJourneys: user?.profile.preferences.autoSaveJourneys ?? true,
  });

  // Password form state
  const [passwordData, setPasswordData] = useState<ChangePasswordRequest>({
    currentPassword: '',
    newPassword: '',
  });
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  if (!user) {
    return null;
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateProfile({ displayName: profileData.displayName });
      showMessage('success', 'Profile updated successfully');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateProfile({ preferences: preferencesData });
      showMessage('success', 'Preferences updated successfully');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== confirmNewPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      showMessage('error', 'New password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user}`, // This would need the actual token
        },
        body: JSON.stringify(passwordData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to change password');
      }

      setPasswordData({ currentPassword: '', newPassword: '' });
      setConfirmNewPassword('');
      showMessage('success', 'Password changed successfully');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose?.();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">User Profile</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-md ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4">
          <nav className="flex space-x-8">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'preferences', label: 'Preferences' },
              { id: 'password', label: 'Password' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="px-6 py-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={profileData.displayName}
                  onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <p className="text-sm text-gray-600">
                  Member since: {new Date(user.createdAt).toLocaleDateString()}
                </p>
                {user.lastLoginAt && (
                  <p className="text-sm text-gray-600">
                    Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          )}

          {activeTab === 'preferences' && (
            <form onSubmit={handlePreferencesSubmit} className="space-y-4">
              <div>
                <label htmlFor="defaultTravelMode" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Travel Mode
                </label>
                <select
                  id="defaultTravelMode"
                  value={preferencesData.defaultTravelMode}
                  onChange={(e) => setPreferencesData({ ...preferencesData, defaultTravelMode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="driving">Driving</option>
                  <option value="walking">Walking</option>
                  <option value="cycling">Cycling</option>
                  <option value="flying">Flying</option>
                  <option value="sailing">Sailing</option>
                  <option value="cruise">Cruise</option>
                </select>
              </div>

              <div>
                <label htmlFor="temperatureUnit" className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature Unit
                </label>
                <select
                  id="temperatureUnit"
                  value={preferencesData.temperatureUnit}
                  onChange={(e) => setPreferencesData({ ...preferencesData, temperatureUnit: e.target.value as 'celsius' | 'fahrenheit' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="celsius">Celsius (°C)</option>
                  <option value="fahrenheit">Fahrenheit (°F)</option>
                </select>
              </div>

              <div>
                <label htmlFor="distanceUnit" className="block text-sm font-medium text-gray-700 mb-1">
                  Distance Unit
                </label>
                <select
                  id="distanceUnit"
                  value={preferencesData.distanceUnit}
                  onChange={(e) => setPreferencesData({ ...preferencesData, distanceUnit: e.target.value as 'metric' | 'imperial' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="metric">Metric (km)</option>
                  <option value="imperial">Imperial (miles)</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoSaveJourneys"
                  checked={preferencesData.autoSaveJourneys}
                  onChange={(e) => setPreferencesData({ ...preferencesData, autoSaveJourneys: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoSaveJourneys" className="ml-2 text-sm text-gray-700">
                  Automatically save journeys to travel journal
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update Preferences'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your current password"
                  required
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your new password"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Confirm your new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Sign Out
          </button>
          <p className="text-xs text-gray-500">
            Account ID: {user.id.slice(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  );
};