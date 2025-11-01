import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/api';
import DistrictCard from '../components/DistrictCard';
import Sparkline from '../components/Sparkline';
import LanguageToggle from '../components/LanguageToggle';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  IndianRupee, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft,
  Loader2,
} from 'lucide-react';

/**
 * District Dashboard Page
 * Shows current month metrics, history, and state comparison
 */
const DistrictDashboard = () => {
  const { state, district } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState('en');
  
  const [currentData, setCurrentData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [state, district]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [current, history, compare] = await Promise.allSettled([
        apiClient.getDistrictCurrent(state, district),
        apiClient.getDistrictHistory(state, district, 12),
        apiClient.getStateCompare(state, district),
      ]);

      if (current.status === 'fulfilled' && current.value.data.success) {
        setCurrentData(current.value.data.data);
      }

      if (history.status === 'fulfilled' && history.value.data.success) {
        setHistoryData(history.value.data.data);
      }

      if (compare.status === 'fulfilled' && compare.value.data.success) {
        setCompareData(compare.value.data.data);
      }

      // Check for errors - show detailed error messages
      const errors = [];
      const has404 = current.status === 'rejected' && current.reason?.response?.status === 404;
      const history404 = history.status === 'rejected' && history.reason?.response?.status === 404;
      
      if (current.status === 'rejected') {
        const errorMsg = current.reason?.response?.data?.error || 'Failed to load current month data';
        errors.push(errorMsg);
        console.error('Current data error:', current.reason);
      }
      if (history.status === 'rejected') {
        const errorMsg = history.reason?.response?.data?.error || 'Failed to load history data';
        errors.push(errorMsg);
        console.error('History data error:', history.reason);
      }
      if (compare.status === 'rejected') {
        const errorMsg = compare.reason?.response?.data?.error || 'Failed to load comparison data';
        errors.push(errorMsg);
        console.error('Compare data error:', compare.reason);
      }

      // If district not found (404), show helpful error message
      if (has404 || history404) {
        const decodedDistrict = decodeURIComponent(district);
        const decodedState = decodeURIComponent(state);
        setError(`District "${decodedDistrict}" in "${decodedState}" not found in database. The district name from location detection might not match the database. Please use search to find the correct district name.`);
      } else if (errors.length >= 2 && !currentData && !historyData) {
        // If multiple errors and no data at all
        setError(errors.join('. '));
      } else if (errors.length === 1 && !currentData && !historyData && !compareData) {
        // If single error and no data at all
        setError(errors[0]);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      setError('An error occurred while loading data. The district may not exist in the database.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-700">Loading district data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // If district not found, redirect to landing page with search
    const isDistrictNotFound = error.includes('not found') || error.includes('District');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 border-2 border-red-200">
          <div className="text-center">
            <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
              <ArrowLeft className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">District Not Found</h2>
            <p className="text-red-600 mb-6 text-lg">{error}</p>
            
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6 text-left">
              <p className="font-semibold text-yellow-800 mb-2">💡 What to do:</p>
              <ul className="list-disc list-inside space-y-2 text-yellow-700 text-sm mb-4">
                <li>The district name from location detection might not match exactly with the database</li>
                <li>Try searching for the district name using the search feature</li>
                <li>Check spelling variations (e.g., "Ahmadabad" vs "Ahmadabad")</li>
                <li>Some districts might not have data loaded yet</li>
              </ul>
              <p className="text-xs text-yellow-600 italic">
                Tip: Use the search feature to find districts that exist in the database.
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  // Mark that user is navigating back from dashboard
                  sessionStorage.setItem('cameFromDashboard', 'true');
                  // Navigate to home - this prevents auto-detection from triggering
                  navigate('/', { replace: true });
                }}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 touch-target font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                Go to Search Page
              </button>
              <button
                onClick={loadDashboardData}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 touch-target font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  const metrics = currentData?.metrics || {};
  const history = historyData?.history || [];
  const performanceTag = compareData?.performance_tag || null;

  // Extract sparkline data (person_days_generated for last 12 months)
  const sparklineData = history
    .slice()
    .reverse()
    .map((h) => h.metrics?.person_days_generated || 0);

  // Calculate month-over-month change
  const getMonthChange = () => {
    if (history.length < 2) return null;
    const current = history[0]?.metrics?.person_days_generated || 0;
    const previous = history[1]?.metrics?.person_days_generated || 0;
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return { value: change, isPositive: change > 0 };
  };

  const monthChange = getMonthChange();

  // Text translations
  const translations = {
    en: {
      personDays: 'Person Days Generated',
      personDaysHi: 'व्यक्ति दिवस उत्पन्न',
      worksCompleted: 'Works Completed',
      worksCompletedHi: 'कार्य पूर्ण',
      worksInProgress: 'Works In Progress',
      worksInProgressHi: 'कार्य प्रगति में',
      amountSpent: 'Amount Spent',
      amountSpentHi: 'राशि खर्च',
    },
    hi: {
      personDays: 'व्यक्ति दिवस उत्पन्न',
      personDaysHi: 'Person Days Generated',
      worksCompleted: 'कार्य पूर्ण',
      worksCompletedHi: 'Works Completed',
      worksInProgress: 'कार्य प्रगति में',
      worksInProgressHi: 'Works In Progress',
      amountSpent: 'राशि खर्च',
      amountSpentHi: 'Amount Spent',
    },
  };

  const t = translations[language];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pb-8">
      <LanguageToggle onLanguageChange={setLanguage} />

      {/* Enhanced Header */}
      <div className="bg-white/80 backdrop-blur-lg shadow-lg sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 touch-target mb-3 group transition-colors"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Search</span>
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {district}, {state}
              </h1>
              {currentData && (
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="text-base font-medium">
                    {currentData.month} {currentData.fin_year}
                  </span>
                  {currentData.source && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {currentData.source}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
        {/* Current Month Metrics */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl shadow-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Current Month Performance
              </h2>
              <p className="text-sm text-gray-600 mt-1">Key metrics at a glance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DistrictCard
              icon={Users}
              title={t.personDays}
              titleHi={t.personDaysHi}
              value={metrics.person_days_generated || 0}
              unit="days"
              subtitle={`State avg: ${compareData?.state_average?.person_days_generated || 'N/A'}`}
              performanceTag={performanceTag}
            />

            <DistrictCard
              icon={CheckCircle}
              title={t.worksCompleted}
              titleHi={t.worksCompletedHi}
              value={metrics.works_completed || 0}
              unit="works"
              subtitle={`State avg: ${compareData?.state_average?.works_completed || 'N/A'}`}
            />

            <DistrictCard
              icon={Clock}
              title={t.worksInProgress}
              titleHi={t.worksInProgressHi}
              value={metrics.works_in_progress || 0}
              unit="works"
            />

            <DistrictCard
              icon={IndianRupee}
              title={t.amountSpent}
              titleHi={t.amountSpentHi}
              value={metrics.amount_spent || 0}
              unit="₹"
              subtitle={`State avg: ₹${compareData?.state_average?.amount_spent || 'N/A'}`}
            />
          </div>
        </div>

        {/* State Comparison */}
        {compareData && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  State Comparison
                </h2>
                <p className="text-sm text-gray-600 mt-1">See how your district ranks</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">District Rank</p>
                <p className="text-3xl font-bold text-gray-900">
                  {compareData.ranking?.rank || 'N/A'}
                  <span className="text-lg text-gray-600 ml-2">
                    / {compareData.ranking?.total_districts || 'N/A'}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Performance</p>
                <span
                  className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                    performanceTag === 'Good'
                      ? 'bg-green-100 text-green-800'
                      : performanceTag === 'Poor'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {performanceTag || 'Average'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* History Chart */}
        {history.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl shadow-lg">
                  <span className="text-2xl">📈</span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    12 Month History
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Performance trends over time</p>
                </div>
              </div>
              {monthChange && (
                <div className="flex items-center gap-2">
                  {monthChange.isPositive ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                  <span
                    className={`font-semibold ${
                      monthChange.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {monthChange.isPositive ? '+' : ''}
                    {monthChange.value.toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-600">vs last month</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <Sparkline data={sparklineData} width={300} height={60} color="#10b981" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
              {history.slice(0, 4).map((h, index) => (
                <div key={index}>
                  <p className="font-medium">{h.month}</p>
                  <p className="text-gray-500">{h.fin_year}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistrictDashboard;

