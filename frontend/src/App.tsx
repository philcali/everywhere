import { useState } from 'react';
import { Layout, Container, Grid } from './components/layout';
import { TravelPlannerForm } from './components/input';
import { AuthProvider } from './components/auth';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = (data: any) => {
    console.log('Form submitted with data:', data);
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      alert('Weather forecast would be displayed here!');
    }, 2000);
  };

  const handleDataChange = (data: any) => {
    console.log('Form data changed:', data);
  };

  return (
    <AuthProvider>
      <Layout>
      <Container className="py-8 sm:py-12">
        {!showForm ? (
          <>
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Plan Your Journey with Weather Insights
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
                Get comprehensive weather forecasts along your travel route to make informed decisions 
                about your journey timing and packing.
              </p>
            </div>

            {/* Feature Cards */}
            <Grid cols={{ default: 1, md: 2, lg: 3 }} gap={6} className="mb-12">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Route Planning</h3>
                <p className="text-gray-600">
                  Enter your source and destination to get optimized routes for different travel modes.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Weather Forecasting</h3>
                <p className="text-gray-600">
                  Get detailed weather conditions including temperature, precipitation, and visibility along your route.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Travel Journal</h3>
                <p className="text-gray-600">
                  Save your journeys and weather data to build a personal travel history and insights.
                </p>
              </div>
            </Grid>

            {/* CTA Section */}
            <div className="text-center">
              <button 
                onClick={() => setShowForm(true)}
                className="btn-primary text-lg px-8 py-3"
              >
                Start Planning Your Journey
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Form Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Plan Your Journey</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  ← Back to Home
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:p-8">
                <TravelPlannerForm
                  onSubmit={handleFormSubmit}
                  onDataChange={handleDataChange}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </>
        )}
      </Container>
    </Layout>
    </AuthProvider>
  );
}

export default App;