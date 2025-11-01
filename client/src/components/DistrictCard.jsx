import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * DistrictCard Component
 * Large card displaying a metric with icon, number, and audio playback
 */
const DistrictCard = ({ 
  icon: Icon, 
  title, 
  titleHi, 
  value, 
  unit = '', 
  subtitle, 
  subtitleHi,
  performanceTag = null, // 'Good', 'Average', 'Poor'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Text-to-speech using Web Speech API
  const speak = () => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance();
      utterance.text = `${title}. ${value} ${unit}. ${subtitle || ''}`;
      utterance.lang = 'en-IN';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const stop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  // Performance tag colors
  const tagColors = {
    Good: 'bg-green-100 text-green-800 border-green-300',
    Average: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Poor: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-4 border border-gray-200 touch-target hover:shadow-2xl transition-all transform hover:scale-[1.02]">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-3 bg-gradient-to-br from-primary-100 to-purple-100 rounded-xl">
              <Icon className="w-7 h-7 text-primary-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {titleHi && <p className="text-sm text-gray-600 mt-0.5">{titleHi}</p>}
          </div>
        </div>
        
        {performanceTag && (
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm ${tagColors[performanceTag]}`}>
            {performanceTag}
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-2">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
          {unit && <span className="text-2xl text-gray-600 ml-2 font-semibold">{unit}</span>}
        </p>
        {subtitle && (
          <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
        )}
        {subtitleHi && (
          <p className="text-sm text-gray-500 mt-1">{subtitleHi}</p>
        )}
      </div>

      <button
        onClick={isPlaying ? stop : speak}
        className="flex items-center justify-center gap-2 text-primary-700 hover:text-primary-800 touch-target px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-primary-50 hover:to-purple-50 transition-all font-medium border border-primary-200 hover:border-primary-300 shadow-sm hover:shadow-md"
        aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
      >
        {isPlaying ? (
          <>
            <VolumeX className="w-5 h-5" />
            <span className="text-sm">Stop Audio</span>
          </>
        ) : (
          <>
            <Volume2 className="w-5 h-5" />
            <span className="text-sm">Listen</span>
          </>
        )}
      </button>
    </div>
  );
};

export default DistrictCard;

