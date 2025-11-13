# Travel Weather Plotter

A web application that allows users to input source and destination locations and displays weather forecasts along the travel route for the duration of the journey.

## Project Structure

```
travel-weather-plotter/
├── frontend/          # React frontend application
├── backend/           # Express.js backend API
├── shared/            # Shared TypeScript types and utilities
└── package.json       # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Copy environment configuration:
```bash
cp backend/.env.example backend/.env
```

3. Configure API keys in `backend/.env`

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

Or start them individually:
```bash
# Backend (http://localhost:3001)
npm run dev:backend

# Frontend (http://localhost:3000)
npm run dev:frontend
```

### Building

Build all packages:
```bash
npm run build
```

### Testing

Run all tests:
```bash
npm run test
```

## Features

- Route planning with multiple travel modes (driving, walking, cycling, flying, sailing, cruise)
- Weather forecasting along travel routes
- Responsive design for mobile and desktop
- Interactive weather visualization
- Real-time input validation

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/route` - Calculate route and weather (to be implemented)
- `GET /api/geocode` - Location validation and geocoding (to be implemented)