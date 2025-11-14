import { Router, Request, Response } from 'express';
import { AuthService, LoginRequest, RegisterRequest, RefreshTokenRequest, PasswordResetRequest, PasswordResetConfirmRequest } from '../services/authService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName }: RegisterRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Email and password are required',
          suggestions: ['Provide both email and password fields']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const result = await AuthService.register({ email, password, displayName });

    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    
    if (error.message.includes('Invalid email format')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL_FORMAT',
          message: error.message,
          suggestions: ['Provide a valid email address (e.g., user@example.com)']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    if (error.message.includes('Password must be')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: error.message,
          suggestions: ['Use at least 8 characters with uppercase, lowercase, and numbers']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: error.message,
          suggestions: ['Use a different email address', 'Try logging in instead']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Failed to register user',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required',
          suggestions: ['Provide both email and password']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const result = await AuthService.login({ email, password });

    res.json({
      success: true,
      data: result,
      message: 'Login successful',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;

    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          suggestions: ['Check your email and password', 'Try password reset if needed']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'LOGIN_ERROR',
        message: 'Failed to authenticate user',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
          suggestions: ['Provide refresh token in request body']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const tokens = await AuthService.refreshTokens({ refreshToken });

    res.json({
      success: true,
      data: { tokens },
      message: 'Tokens refreshed successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;

    if (error.message.includes('Invalid or expired')) {
      return res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: error.message,
          suggestions: ['Login again to get new tokens']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      error: {
        code: 'TOKEN_REFRESH_ERROR',
        message: 'Failed to refresh tokens',
        suggestions: ['Try logging in again']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user by revoking refresh token
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Logout error:', error);
    
    // Even if logout fails, we should return success to the client
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout user from all devices
 */
router.post('/logout-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const revokedCount = await AuthService.logoutAll(req.userId!);

    res.json({
      success: true,
      data: { revokedTokens: revokedCount },
      message: 'Logged out from all devices successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Logout all error:', error);
    
    res.status(500).json({
      error: {
        code: 'LOGOUT_ALL_ERROR',
        message: 'Failed to logout from all devices',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * POST /api/auth/password-reset
 * Request password reset
 */
router.post('/password-reset', async (req: Request, res: Response) => {
  try {
    const { email }: PasswordResetRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email is required',
          suggestions: ['Provide email address']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const result = await AuthService.requestPasswordReset({ email });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;

    if (error.message.includes('Invalid email format')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL_FORMAT',
          message: error.message,
          suggestions: ['Provide a valid email address']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Password reset request error:', error);
    res.status(500).json({
      error: {
        code: 'PASSWORD_RESET_REQUEST_ERROR',
        message: 'Failed to process password reset request',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * POST /api/auth/password-reset/confirm
 * Confirm password reset with token
 */
router.post('/password-reset/confirm', async (req: Request, res: Response) => {
  try {
    const { token, newPassword }: PasswordResetConfirmRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Reset token and new password are required',
          suggestions: ['Provide both reset token and new password']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const result = await AuthService.resetPassword({ token, newPassword });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;

    if (error.message.includes('Invalid or expired reset token')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: error.message,
          suggestions: ['Request a new password reset link']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    if (error.message.includes('Password must be')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: error.message,
          suggestions: ['Use at least 8 characters with uppercase, lowercase, and numbers']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Password reset confirm error:', error);
    res.status(500).json({
      error: {
        code: 'PASSWORD_RESET_CONFIRM_ERROR',
        message: 'Failed to reset password',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;

    res.json({
      success: true,
      data: {
        user: {
          id: req.user!.id,
          email: req.user!.email,
          displayName: req.user!.displayName,
          createdAt: req.user!.createdAt,
          lastLoginAt: req.user!.lastLoginAt,
          preferences: req.user!.preferences
        }
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Get profile error:', error);
    
    res.status(500).json({
      error: {
        code: 'PROFILE_ERROR',
        message: 'Failed to get user profile',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

export default router;