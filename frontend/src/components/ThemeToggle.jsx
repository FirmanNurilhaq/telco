import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
        bg-gray-700 hover:bg-gray-600 text-gray-200
        dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
      aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
    >
      {theme === 'dark' ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
    </button>
  );
}
