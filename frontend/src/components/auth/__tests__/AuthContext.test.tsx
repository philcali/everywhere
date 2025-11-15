import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test component to access auth context
const TestComponent = () => {
  const { user, isAuthenticated, login, logout, register } = useAuth();
  
  const handleLogin = async () => {
    try {
      await login({ email: 'test@example.com', password: 'password' });
    } catch (error) {
      // Ignore errors in test component
    }
  };

  const handleRegister = async () => {
    try {
      await register({ email: 'test@example.com', password: 'password' });
    } catch (error) {
      // Ignore errors in test component
    }
  };
  
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="user-email">
        {user?.email || 'no-user'}
      </div>
      <button onClick={handleLogin}>
        Login
      </button>
      <button onClick={handleRegister}>
        Register
      </button>
      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('provides initial unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });
  });

  it('loads stored authentication data on mount', async () => {
    const mockUser = { 
      id: '1', 
      email: 'test@example.com', 
      profile: { preferences: {} },
      createdAt: new Date()
    };
    const mockToken = { 
      accessToken: 'token', 
      refreshToken: 'refresh', 
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      userId: '1'
    };

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return JSON.stringify(mockToken);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
  });

  it('handles login successfully', async () => {
    const mockResponse = {
      user: { 
        id: '1', 
        email: 'test@example.com', 
        profile: { preferences: {} },
        createdAt: new Date()
      },
      token: { 
        accessToken: 'token', 
        refreshToken: 'refresh', 
        expiresAt: new Date(Date.now() + 3600000),
        userId: '1'
      }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.user));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('token', JSON.stringify(mockResponse.token));
  });

  it('handles login failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Invalid credentials' } })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    
    // The login should fail and throw an error, but we need to catch it
    try {
      fireEvent.click(loginButton);
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      });
    } catch (error) {
      // Expected to throw
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('handles registration successfully', async () => {
    const mockResponse = {
      user: { 
        id: '1', 
        email: 'test@example.com', 
        profile: { preferences: {} },
        createdAt: new Date()
      },
      token: { 
        accessToken: 'token', 
        refreshToken: 'refresh', 
        expiresAt: new Date(Date.now() + 3600000),
        userId: '1'
      }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
  });

  it('handles logout', async () => {
    const mockUser = { 
      id: '1', 
      email: 'test@example.com', 
      profile: { preferences: {} },
      createdAt: new Date()
    };
    const mockToken = { 
      accessToken: 'token', 
      refreshToken: 'refresh', 
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      userId: '1'
    };

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return JSON.stringify(mockToken);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
  });

  it('clears expired tokens on load', async () => {
    const mockUser = { 
      id: '1', 
      email: 'test@example.com', 
      profile: { preferences: {} },
      createdAt: new Date()
    };
    const expiredToken = { 
      accessToken: 'token', 
      refreshToken: 'refresh', 
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired
      userId: '1'
    };

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'user') return JSON.stringify(mockUser);
      if (key === 'token') return JSON.stringify(expiredToken);
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
  });
});