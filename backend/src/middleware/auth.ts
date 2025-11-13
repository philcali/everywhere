import { Request, Response, NextFunction } from 'express';
import { JWTService, TokenPayload } from '../auth/jwt.js';
import { UserModel, User } from '../models/User.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: number;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: User;
  userId: number;
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required',
          suggestions: ['Include Authorization header with Bearer token']
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    const payload = JWTService.verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token',
          suggestions: ['Refresh your access token', 'Login again']
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Fetch user data
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with token not found',
          suggestions: ['Login again']
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Internal authentication error',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    // No token provided, continue without authentication
    next();
    return;
  }

  // Token provided, try to authenticate
  authenticateToken(req, res, next);
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  authenticateToken(req, res, next);
}

// Type guard to check if request is authenticated
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return req.user !== undefined && req.userId !== undefined;
}