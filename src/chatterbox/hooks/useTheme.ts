import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { getThemeClasses } from '../config/themes';

const ALL_THEME_CLASSES = [
  'bg-gradient-to-br', 'from-violet-50', 'via-purple-50', 'to-fuchsia-50', 'text-gray-900',
  'bg-dark-900', 'text-gray-50', 'gradient-bg', 'text-white', 'bg-black',
];

export const useTheme = () => {
  const { theme, setTheme } = useChatStore();

  useEffect(() => {
    // Apply theme only to the chatterbox container, not the whole document
    const container = document.getElementById('chatterbox-root');
    if (!container) return;

    const themeClasses = getThemeClasses(theme);

    // Remove existing theme classes from container
    ALL_THEME_CLASSES.forEach((cls) => container.classList.remove(cls));

    // Apply new theme classes to container
    themeClasses.split(' ').filter(Boolean).forEach((cls) => container.classList.add(cls));
  }, [theme]);

  return {
    theme,
    setTheme,
  };
};
