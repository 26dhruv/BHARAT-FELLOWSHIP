import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { apiClient } from '../utils/api';
import { MapPin, Loader2 } from 'lucide-react';

/**
 * GeoDetect Component
 * Uses browser geolocation API to detect user's district
 * Now manual-only (triggered via ref)
 */
const GeoDetect = forwardRef(({ onDistrictDetected, onError, skipAutoDetect = true }, ref) => {
  const [status, setStatus] = useState('idle'); // idle, detecting, success, error
  const [error, setError] = useState(null);
  const [helpNeeded, setHelpNeeded] = useState(false);
  const hasDetected = useRef(false); // Track if we've already tried once

  // Expose detectLocation method via ref for manual triggering
  useImperativeHandle(ref, () => ({
    detectLocation: (force = false) => {
      detectLocationInternal(force);
    }
  }));

  // No auto-detection on mount - only manual via ref
  useEffect(() => {
    // Auto-detection is disabled - component is hidden and only triggered manually
  }, []);

  const detectLocationInternal = (force = false) => {
    if (!navigator.geolocation) {
      const err = 'Geolocation is not supported by your browser';
      setError(err);
      setStatus('error');
      if (onError) onError(err);
      hasDetected.current = true;
      return;
    }

    // Prevent auto-detection if we've already tried once (unless forced)
    if (hasDetected.current && !force) {
      return;
    }

    setStatus('detecting');
    hasDetected.current = true; // Mark as detected to prevent multiple auto-detections

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Call backend to find district
          const response = await apiClient.getDistrictFromGeo(latitude, longitude);
          
          if (response.data.success) {
            const { state, district } = response.data.data;
            
            // Verify district exists in database before navigating
            try {
              const verifyResponse = await apiClient.getDistrictCurrent(state, district);
              if (verifyResponse.data.success) {
                // District exists, proceed with navigation
                setStatus('success');
                if (onDistrictDetected) {
                  onDistrictDetected({ state, district, lat: latitude, lon: longitude, verified: true });
                }
              } else {
                // District found by geocoding but not in database
                throw new Error('District found but not in database');
              }
            } catch (verifyError) {
              // District not in database - show search instead
              if (verifyError.response?.status === 404) {
                setStatus('error');
                setError(`District "${district}" found but not available in database. Please use search to find the correct district.`);
                if (onError) {
                  onError(`District "${district}" in "${state}" not found in database. Please search for it manually.`);
                }
                // District not found - user can use search feature
              } else {
                throw verifyError;
              }
            }
          } else {
            throw new Error('District not found for your location');
          }
        } catch (error) {
          let err = 'Failed to detect district';
          let showHelp = false;
          let showManualOption = true; // Always show manual option on error
          
          if (error.isNetworkError) {
            err = error.networkMessage || 'Cannot connect to server. Please ensure the backend is running on http://localhost:3000';
            showHelp = true;
          } else if (error.response) {
            const responseData = error.response.data;
            err = responseData?.error || error.message;
            
            // Check if it's a GeoJSON not loaded error (503)
            if (error.response.status === 503) {
              err = 'Geospatial lookup is not available. GeoJSON file needs to be configured.';
              showHelp = true;
            }
            
            // Check if district not found (404)
            if (error.response.status === 404) {
              err = 'District not found for your location. Please enter it manually.';
              showManualOption = true;
            }
            
            // Add helpful message if available
            if (responseData?.message) {
              err += '. ' + responseData.message;
            }
            
            // Add suggestions if available
            if (responseData?.suggestions && responseData.suggestions.length > 0) {
              err += ' ' + responseData.suggestions[0];
            }
          } else if (error.request) {
            err = 'Network error: Backend server may not be running. Please start the server and try again.';
            showHelp = true;
          } else {
            err = error.message || 'Unknown error occurred';
          }
          
          setError(err);
          setStatus('error');
          if (onError) onError(err);
          
          // Store help flag for UI
          setHelpNeeded(showHelp);
          
          // District not found - user can use search feature on landing page
        }
      },
      (geoError) => {
        let err = 'Location access denied or unavailable';
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            err = 'Location permission denied. Please enable location access.';
            break;
          case geoError.POSITION_UNAVAILABLE:
            err = 'Location information unavailable.';
            break;
          case geoError.TIMEOUT:
            err = 'Location request timed out.';
            break;
        }
        setError(err);
        setStatus('error');
        if (onError) onError(err);
        
        // Geolocation error - user can use search feature
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  };

  // Hide component UI - it's only used for functionality via ref
  // Status messages will be handled by parent component
  if (status === 'idle') {
    return null;
  }

  // Only show error/success states if explicitly needed for debugging
  // For production, parent handles UI feedback
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      {status === 'detecting' && (
        <div className="flex items-center gap-2 text-blue-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Detecting your location...</span>
        </div>
      )}
      
      {status === 'success' && (
        <div className="flex items-center gap-2 text-green-700">
          <MapPin className="w-5 h-5" />
          <span>Location detected successfully!</span>
        </div>
      )}
      
      {status === 'error' && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-5 mb-6 shadow-lg">
          <div className="flex items-start gap-3 text-red-700">
            <div className="p-2 bg-red-100 rounded-full">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg mb-2">Location Detection Unavailable</p>
              <p className="text-sm mb-3 text-red-600">{error}</p>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-xl text-sm text-yellow-800">
                {error.includes('GeoJSON') || error.includes('geospatial') || error.includes('not found') || error.includes('District not found') ? (
                  <>
                    <p className="font-semibold mb-2">💡 Don't worry!</p>
                    <p className="mb-2">You can still access district data by using the search box below.</p>
                  </>
                ) : helpNeeded || error.includes('server') || error.includes('backend') ? (
                  <>
                    <p className="font-medium mb-1">Backend server not running?</p>
                    <p className="mb-2">Start it with: <code className="bg-yellow-100 px-1 rounded">cd server && npm run dev</code></p>
                    <p className="text-xs text-gray-600 mt-2">You can use the search feature below to find districts.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold mb-2">💡 Need help?</p>
                    <p className="mb-2">Use the search box below to find your district.</p>
                  </>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => detectLocation(true)}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg touch-target transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

GeoDetect.displayName = 'GeoDetect';

export default GeoDetect;

