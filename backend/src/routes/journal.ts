import { Router, Request, Response } from 'express';
import { 
  JournalService, 
  SaveJourneyRequest, 
  UpdateJourneyRequest, 
  JourneyListQuery 
} from '../services/journalService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/journal
 * Save a new journey to the user's travel journal
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journeyData: SaveJourneyRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (!journeyData.name || !journeyData.route || !journeyData.weatherData || !journeyData.travelConfig) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Name, route, weather data, and travel config are required',
          suggestions: ['Provide all required fields: name, route, weatherData, travelConfig']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const journey = await JournalService.saveJourney(req.userId, journeyData);

    res.status(201).json({
      success: true,
      data: { journey },
      message: 'Journey saved successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    
    if (error.message.includes('required') || error.message.includes('must be')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          suggestions: ['Check the provided data format and requirements']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Save journey error:', error);
    res.status(500).json({
      error: {
        code: 'SAVE_JOURNEY_ERROR',
        message: 'Failed to save journey',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal
 * Retrieve user's journeys with filtering and pagination
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query: JourneyListQuery = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      searchTerm: req.query.searchTerm as string,
      travelMode: req.query.travelMode as string,
      rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      dateRange: req.query.startDate && req.query.endDate ? {
        start: req.query.startDate as string,
        end: req.query.endDate as string
      } : undefined
    };

    const requestId = req.headers['x-request-id'] as string;
    const result = await JournalService.getJourneys(req.userId, query);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Get journeys error:', error);
    
    res.status(500).json({
      error: {
        code: 'GET_JOURNEYS_ERROR',
        message: 'Failed to retrieve journeys',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/stats
 * Get user's journey statistics
 */
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const stats = await JournalService.getUserStats(req.userId);

    res.json({
      success: true,
      data: { stats },
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Get stats error:', error);
    
    res.status(500).json({
      error: {
        code: 'GET_STATS_ERROR',
        message: 'Failed to retrieve journey statistics',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/tags
 * Get all unique tags for the user
 */
router.get('/tags', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const tags = await JournalService.getUserTags(req.userId);

    res.json({
      success: true,
      data: { tags },
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Get tags error:', error);
    
    res.status(500).json({
      error: {
        code: 'GET_TAGS_ERROR',
        message: 'Failed to retrieve tags',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/search
 * Search journeys by text
 */
router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const requestId = req.headers['x-request-id'] as string;

    if (!searchTerm) {
      return res.status(400).json({
        error: {
          code: 'MISSING_SEARCH_TERM',
          message: 'Search term is required',
          suggestions: ['Provide a search term using the "q" query parameter']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const offset = (page - 1) * limit;
    const { journeys, total } = await JournalService.searchJourneys(req.userId, searchTerm, { limit, offset });

    res.json({
      success: true,
      data: {
        journeys,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Search journeys error:', error);
    
    res.status(500).json({
      error: {
        code: 'SEARCH_JOURNEYS_ERROR',
        message: 'Failed to search journeys',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/recent
 * Get recent journeys for the user
 */
router.get('/recent', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const requestId = req.headers['x-request-id'] as string;

    const journeys = await JournalService.getRecentJourneys(req.userId, limit);

    res.json({
      success: true,
      data: { journeys },
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Get recent journeys error:', error);
    
    res.status(500).json({
      error: {
        code: 'GET_RECENT_JOURNEYS_ERROR',
        message: 'Failed to retrieve recent journeys',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/export/all
 * Export all journeys for the user
 */
router.get('/export/all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const exportData = await JournalService.exportAllJourneys(req.userId);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="all-journeys-export.json"`);

    res.json({
      exportedAt: new Date().toISOString(),
      version: '1.0',
      totalJourneys: exportData.length,
      journeys: exportData
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Export all journeys error:', error);
    
    res.status(500).json({
      error: {
        code: 'EXPORT_ALL_JOURNEYS_ERROR',
        message: 'Failed to export journeys',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/:id/export
 * Export a specific journey
 */
router.get('/:id/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journeyId = parseInt(req.params.id);
    const requestId = req.headers['x-request-id'] as string;

    if (isNaN(journeyId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_JOURNEY_ID',
          message: 'Journey ID must be a valid number',
          suggestions: ['Provide a valid numeric journey ID']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const exportData = await JournalService.exportJourney(journeyId, req.userId);

    if (!exportData) {
      return res.status(404).json({
        error: {
          code: 'JOURNEY_NOT_FOUND',
          message: 'Journey not found',
          suggestions: ['Check the journey ID', 'Ensure you have access to this journey']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="journey-${journeyId}-export.json"`);

    res.json(exportData);
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Export journey error:', error);
    
    res.status(500).json({
      error: {
        code: 'EXPORT_JOURNEY_ERROR',
        message: 'Failed to export journey',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * GET /api/journal/:id
 * Retrieve a specific journey by ID
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journeyId = parseInt(req.params.id);
    const requestId = req.headers['x-request-id'] as string;

    if (isNaN(journeyId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_JOURNEY_ID',
          message: 'Journey ID must be a valid number',
          suggestions: ['Provide a valid numeric journey ID']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const journey = await JournalService.getJourney(journeyId, req.userId);

    if (!journey) {
      return res.status(404).json({
        error: {
          code: 'JOURNEY_NOT_FOUND',
          message: 'Journey not found',
          suggestions: ['Check the journey ID', 'Ensure you have access to this journey']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    res.json({
      success: true,
      data: { journey },
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Get journey error:', error);
    
    res.status(500).json({
      error: {
        code: 'GET_JOURNEY_ERROR',
        message: 'Failed to retrieve journey',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * PUT /api/journal/:id
 * Update an existing journey
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journeyId = parseInt(req.params.id);
    const updateData: UpdateJourneyRequest = req.body;
    const requestId = req.headers['x-request-id'] as string;

    if (isNaN(journeyId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_JOURNEY_ID',
          message: 'Journey ID must be a valid number',
          suggestions: ['Provide a valid numeric journey ID']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const journey = await JournalService.updateJourney(journeyId, req.userId, updateData);

    if (!journey) {
      return res.status(404).json({
        error: {
          code: 'JOURNEY_NOT_FOUND',
          message: 'Journey not found',
          suggestions: ['Check the journey ID', 'Ensure you have access to this journey']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    res.json({
      success: true,
      data: { journey },
      message: 'Journey updated successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    
    if (error.message.includes('cannot be empty') || error.message.includes('must be')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          suggestions: ['Check the provided data format and requirements']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    console.error('Update journey error:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_JOURNEY_ERROR',
        message: 'Failed to update journey',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

/**
 * DELETE /api/journal/:id
 * Delete a journey
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journeyId = parseInt(req.params.id);
    const requestId = req.headers['x-request-id'] as string;

    if (isNaN(journeyId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_JOURNEY_ID',
          message: 'Journey ID must be a valid number',
          suggestions: ['Provide a valid numeric journey ID']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const deleted = await JournalService.deleteJourney(journeyId, req.userId);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'JOURNEY_NOT_FOUND',
          message: 'Journey not found',
          suggestions: ['Check the journey ID', 'Ensure you have access to this journey']
        },
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    res.json({
      success: true,
      message: 'Journey deleted successfully',
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] as string;
    console.error('Delete journey error:', error);
    
    res.status(500).json({
      error: {
        code: 'DELETE_JOURNEY_ERROR',
        message: 'Failed to delete journey',
        suggestions: ['Try again later']
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});



export default router;