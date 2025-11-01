import { useState } from 'react';
import { Languages } from 'lucide-react';

/**
 * LanguageToggle Component
 * Toggles between English and Hindi
 */
const LanguageToggle = ({ onLanguageChange }) => {
  const [language, setLanguage] = useState('en');

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'hi' : 'en';
    setLanguage(newLang);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-full p-3 touch-target flex items-center gap-2 hover:bg-gray-50 transition-colors"
      aria-label="Toggle language"
    >
      <Languages className="w-5 h-5 text-gray-700" />
      <span className="font-medium text-sm">{language === 'en' ? 'EN' : 'हिं'}</span>
    </button>
  );
};

export default LanguageToggle;

