import React, { useState } from 'react';
import { SavedJourney } from '../../types/shared';

interface JourneyExportProps {
  journey: SavedJourney;
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeWeatherData: boolean;
  includeRouteDetails: boolean;
  includeMetadata: boolean;
}

const JourneyExport: React.FC<JourneyExportProps> = ({
  journey,
  isOpen,
  onClose,
  onExport
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    includeWeatherData: true,
    includeRouteDetails: true,
    includeMetadata: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      await onExport(options);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getEstimatedFileSize = () => {
    let baseSize = 1; // KB for basic journey info
    
    if (options.includeWeatherData && journey.weatherData.length > 0) {
      baseSize += journey.weatherData.length * 0.5; // ~0.5KB per weather point
    }
    
    if (options.includeRouteDetails && journey.route.waypoints.length > 0) {
      baseSize += journey.route.waypoints.length * 0.1; // ~0.1KB per waypoint
    }
    
    if (options.includeMetadata) {
      baseSize += 0.5; // ~0.5KB for metadata
    }

    // Adjust for format
    switch (options.format) {
      case 'json':
        baseSize *= 1.2; // JSON formatting overhead
        break;
      case 'csv':
        baseSize *= 0.8; // CSV is more compact
        break;
      case 'pdf':
        baseSize *= 3; // PDF has significant overhead
        break;
    }

    return baseSize < 1 ? '<1' : Math.round(baseSize).toString();
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'json':
        return 'Machine-readable format, ideal for importing into other applications';
      case 'csv':
        return 'Spreadsheet format, good for data analysis and visualization';
      case 'pdf':
        return 'Human-readable document format, perfect for sharing and archiving';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Export Journey</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isExporting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">{journey.name}</h3>
            <p className="text-sm text-gray-600">
              {journey.route.source.name} → {journey.route.destination.name}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="space-y-2">
                {[
                  { value: 'json', label: 'JSON', icon: '📄' },
                  { value: 'csv', label: 'CSV', icon: '📊' },
                  { value: 'pdf', label: 'PDF', icon: '📋' }
                ].map((format) => (
                  <label key={format.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value={format.value}
                      checked={options.format === format.value}
                      onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value as ExportOptions['format'] }))}
                      className="mt-1"
                      disabled={isExporting}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>{format.icon}</span>
                        <span className="font-medium">{format.label}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {getFormatDescription(format.value)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Content Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Include Content
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeWeatherData}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeWeatherData: e.target.checked }))}
                    disabled={isExporting}
                  />
                  <span className="text-sm">Weather Data ({journey.weatherData.length} points)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeRouteDetails}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeRouteDetails: e.target.checked }))}
                    disabled={isExporting}
                  />
                  <span className="text-sm">Route Details ({journey.route.waypoints.length} waypoints)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeMetadata}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                    disabled={isExporting}
                  />
                  <span className="text-sm">Metadata (tags, notes, rating)</span>
                </label>
              </div>
            </div>

            {/* File Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-800">Estimated file size:</span>
                <span className="font-medium text-blue-900">{getEstimatedFileSize()} KB</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-blue-800">File name:</span>
                <span className="font-medium text-blue-900">
                  {journey.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.{options.format}
                </span>
              </div>
            </div>

            {/* Export Preview */}
            {options.format === 'json' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview (JSON structure)
                </label>
                <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 max-h-32 overflow-y-auto">
                  <div>{'{'}</div>
                  <div className="ml-2">"id": "{journey.id}",</div>
                  <div className="ml-2">"name": "{journey.name}",</div>
                  <div className="ml-2">"route": {'{'} ... {'}'},</div>
                  {options.includeWeatherData && (
                    <div className="ml-2">"weatherData": [{'{'} ... {'}'}],</div>
                  )}
                  {options.includeRouteDetails && (
                    <div className="ml-2">"routeDetails": {'{'} ... {'}'},</div>
                  )}
                  {options.includeMetadata && (
                    <div className="ml-2">"metadata": {'{'} ... {'}'},</div>
                  )}
                  <div className="ml-2">...</div>
                  <div>{'}'}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JourneyExport;