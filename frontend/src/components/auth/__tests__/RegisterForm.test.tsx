import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterForm } from '../RegisterForm';
import { AuthProvider } from '../AuthContext';

// Mock fetch
global.fetch = vi.fn();

const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form with all required fields', () => {
    render(
      <MockAuthProvider>
        <RegisterForm />
      </MockAuthProvider>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates email format', async () => {
    // Mock fetch to reject so we don't actually try to register
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <MockAuthProvider>
        <RegisterForm />
      </MockAuthProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const termsCheckbox = screen.getByLabelText(/i agree to the/i);
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(termsCheckbox);

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows password strength indicator', async () => {
    render(
      <MockAuthProvider>
        <RegisterForm />
      </MockAuthProvider>
    );

    const passwordInput = screen.getByLabelText(/^password/i);

    fireEvent.change(passwordInput, { target: { value: 'weak' } });

    await waitFor(() => {
      expect(screen.getByText(/weak/i)).toBeInTheDocument();
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });

    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });

    await waitFor(() => {
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });
  });

  it('validates password confirmation', async () => {
    render(
      <MockAuthProvider>
        <RegisterForm />
      </MockAuthProvider>
    );

    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByLabelText(/i agree to the/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('validates display name length', async () => {
    render(
      <MockAuthProvider>
        <RegisterForm />
      </MockAuthProvider>
    );

    const displayNameInput = screen.getByLabelText(/display name/i);
    const termsCheckbox = screen.getByLabelText(/i agree to the/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(displayNameInput, { target: { value: 'A' } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/display name must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockResponse = {
      user: { id: '1', email: 'test@example.com', profile: { preferences: {} } },
      token: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const onSuccess = vi.fn();

    render(
      <MockAuthProvider>
        <RegisterForm onSuccess={onSuccess} />
      </MockAuthProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByLabelText(/i agree to the/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.click(termsCheckbox);

    // Wait for password strength validation
    await waitFor(() => {
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'StrongPass123!',
          displayName: 'Test User'
        })
      });
    });
  });

  it('disables submit button for weak passwords', async () => {
    render(
      <MockAuthProvider>
        <RegisterForm />
      </MockAuthProvider>
    );

    const passwordInput = screen.getByLabelText(/^password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(passwordInput, { target: { value: 'weak' } });

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('calls switch to login callback', () => {
    const onSwitchToLogin = vi.fn();

    render(
      <MockAuthProvider>
        <RegisterForm onSwitchToLogin={onSwitchToLogin} />
      </MockAuthProvider>
    );

    const signInLink = screen.getByText(/sign in/i);
    fireEvent.click(signInLink);

    expect(onSwitchToLogin).toHaveBeenCalled();
  });
});