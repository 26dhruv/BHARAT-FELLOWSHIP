import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GeoDetect from '../components/GeoDetect';
import { apiClient } from '../utils/api';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';

/**
 * Landing Page
 * District selection with geolocation and search
 */
const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if search has been performed
  const [detectedDistrict, setDetectedDistrict] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const geoDetectRef = useRef(null);
  
  // Track if user came from dashboard (via back button or navigation)
  const [cameFromDashboard, setCameFromDashboard] = useState(false);
  
  // Reset state when component mounts (prevents loops from navigation)
  useEffect(() => {
    // Check if we're coming from dashboard (using both referrer and sessionStorage)
    const referrerCheck = document.referrer && document.referrer.includes('/district/');
    const sessionCheck = sessionStorage.getItem('cameFromDashboard') === 'true';
    const isComingFromDashboard = referrerCheck || sessionCheck;
    
    setCameFromDashboard(isComingFromDashboard);
    
    // Clear any stale detection state when returning to landing page
    if (location.pathname === '/') {
      setDetectedDistrict(null);
      setGeoError(null);
      
      // If coming from dashboard, don't auto-detect location again
      if (isComingFromDashboard) {
        // User explicitly navigated back - don't trigger auto-detection
        console.log('User navigated back from dashboard - skipping auto-detection');
        // Clear the session storage flag after using it
        sessionStorage.removeItem('cameFromDashboard');
      } else {
        // Fresh page load or reload - allow auto-detection
        console.log('Fresh page load - auto-detection will run');
      }
    }
  }, [location.pathname]);

  // Clear search results when search query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [searchQuery]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true); // Mark that search has been performed
    setSearchResults([]); // Clear previous results

    try {
      const response = await apiClient.search(searchQuery);
      if (response.data.success) {
        setSearchResults(response.data.data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDistrictSelect = (state, district) => {
    navigate(`/district/${encodeURIComponent(state)}/${encodeURIComponent(district)}`);
  };

  const handleGeoDetected = ({ state, district, verified }) => {
    setIsDetectingLocation(false);
    
    setDetectedDistrict({ state, district });
    
    // Only navigate if district is verified to exist in database
    if (verified) {
      // Auto-navigate after 1.5 seconds
      setTimeout(() => {
        navigate(`/district/${encodeURIComponent(state)}/${encodeURIComponent(district)}`);
      }, 1500);
    } else {
      // District not in database - keep on landing page, show search
      setDetectedDistrict(null); // Clear detection so search is visible
    }
  };

  const handleGeoError = (error) => {
    setGeoError(error);
    setIsDetectingLocation(false);
    // Just show the search - user can search for their district
  };

  const handleDetectLocationClick = () => {
    setIsDetectingLocation(true);
    setGeoError(null);
    // Trigger location detection manually via the GeoDetect component
    if (geoDetectRef.current && geoDetectRef.current.detectLocation) {
      geoDetectRef.current.detectLocation(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 mt-6 md:mt-10">
          <div className="inline-flex items-center justify-center p-5 bg-white rounded-2xl shadow-xl mb-6 transform hover:scale-105 transition-transform">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl">
              <MapPin className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-primary-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4 leading-tight">
            Our Voice, Our Rights
          </h1>
          <p className="text-xl md:text-2xl text-gray-800 font-semibold mb-2">
            View MGNREGA District Performance
          </p>
          <p className="text-base md:text-lg text-gray-600 font-medium">
            मनरेगा जिला प्रदर्शन देखें
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Real-time Data</span>
          </div>
        </div>

        {/* Geolocation Detection - Hidden, only triggered manually */}
        <GeoDetect
          onDistrictDetected={handleGeoDetected}
          onError={handleGeoError}
          skipAutoDetect={true}
          ref={geoDetectRef}
        />

        {detectedDistrict && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-6 mb-6 shadow-xl animate-pulse">
            <div className="flex items-center gap-4 text-green-700">
              <div className="p-3 bg-green-200 rounded-full shadow-lg">
                <MapPin className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-xl mb-1">
                  ✅ Location Detected Successfully!
                </p>
                <p className="text-lg font-semibold mb-1">
                  {detectedDistrict.district}, {detectedDistrict.state}
                </p>
                <p className="text-sm text-green-600 mb-3">Loading dashboard...</p>
                <p className="text-xs text-green-500 italic">
                  If this district isn't found, please use the search below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Search */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 mb-8 border border-gray-100 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-gradient-to-br from-primary-500 via-purple-500 to-indigo-500 rounded-2xl shadow-lg">
              <Search className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Search Your District
              </h2>
              <p className="text-sm text-gray-500 mt-1">Find and explore MGNREGA data for any district</p>
            </div>
          </div>
          
          <form onSubmit={handleSearch} className="mb-6">
            {/* Mobile: Stack vertically, Desktop: Side by side */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input - Takes full width on mobile, flex-1 on desktop */}
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type district name..."
                  className="w-full min-w-[200px] pl-12 pr-4 py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-primary-200 focus:border-primary-500 touch-target transition-all shadow-sm hover:shadow-md"
                />
              </div>
              
              {/* Buttons Container - Flex on desktop, full width stack on mobile */}
              <div className="flex gap-3 sm:flex-shrink-0">
                {/* Location Button */}
                <button
                  type="button"
                  onClick={handleDetectLocationClick}
                  disabled={isDetectingLocation}
                  className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all touch-target disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 min-w-[60px]"
                  title="Detect your location automatically"
                  aria-label="Detect location"
                >
                  {isDetectingLocation ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Navigation className="w-5 h-5" />
                  )}
                </button>
                
                {/* Search Button */}
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-6 sm:px-8 py-4 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-purple-700 disabled:opacity-50 touch-target flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex-shrink-0 min-w-[100px] sm:min-w-[120px]"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="hidden sm:inline">Searching</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
          
          {/* Show error if location detection fails */}
          {geoError && !isDetectingLocation && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <p>{geoError}</p>
            </div>
          )}

          {/* Enhanced Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Found {searchResults.length} {searchResults.length === 1 ? 'District' : 'Districts'}
                </h3>
                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  {searchResults.length} results
                </span>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleDistrictSelect(result.state, result.district)}
                    className="w-full text-left px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-primary-50 hover:to-purple-50 border-2 border-transparent hover:border-primary-300 rounded-xl touch-target transition-all shadow-sm hover:shadow-md transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-lg text-gray-900">{result.district}</p>
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {result.state}
                        </p>
                      </div>
                      <div className="text-primary-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Only show "no results" message after search has been performed */}
          {hasSearched && searchQuery.trim() && searchResults.length === 0 && !isSearching && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-yellow-800 text-center">
                <span className="font-semibold">No districts found.</span> Try a different search term or check spelling.
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-3xl shadow-xl p-8 md:p-10 border-2 border-indigo-100">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
              <span className="text-4xl">📊</span>
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-gray-900 mb-3">
                About This App
              </h3>
              <p className="text-gray-700 mb-4 text-lg leading-relaxed">
                View real-time <span className="font-bold text-primary-700">MGNREGA</span> (Mahatma Gandhi National Rural Employment Guarantee Act) 
                performance data for your district.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-white/60 rounded-xl backdrop-blur-sm">
                  <div className="text-2xl mb-2">🎯</div>
                  <p className="font-semibold text-gray-800">State Comparison</p>
                  <p className="text-sm text-gray-600">Compare with state averages</p>
                </div>
                <div className="p-4 bg-white/60 rounded-xl backdrop-blur-sm">
                  <div className="text-2xl mb-2">📈</div>
                  <p className="font-semibold text-gray-800">Monthly Trends</p>
                  <p className="text-sm text-gray-600">Track performance over time</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 mb-6 text-gray-500 text-sm">
          <p>Built for transparency and accountability in rural employment</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;

