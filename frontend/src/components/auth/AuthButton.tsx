import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { AuthModal } from './AuthModal';

export const AuthButton: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  if (isAuthenticated && user) {
    return (
      <>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-600">
                {user.profile.displayName ? user.profile.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm font-medium">
              {user.profile.displayName || user.email.split('@')[0]}
            </span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowModal(true);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile Settings
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    logout();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>

        <AuthModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          initialMode="profile"
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setShowModal(true)}
          className="btn-secondary text-sm px-4 py-2"
        >
          Sign In
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary text-sm px-4 py-2"
        >
          Sign Up
        </button>
      </div>

      <AuthModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialMode="login"
      />
    </>
  );
};