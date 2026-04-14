import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border
        ${isDark
          ? 'bg-gray-800 border-gray-600 text-yellow-300 hover:bg-gray-700'
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
        }`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-base leading-none">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
