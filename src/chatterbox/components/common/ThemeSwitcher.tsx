import React from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import type { ThemeType } from '../../types';
import { THEMES } from '../../config/themes';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useChatStore();

  const themeOptions: ThemeType[] = ['light', 'dark', 'gradient', 'liquid-glass'];

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 backdrop-blur-sm">
      {themeOptions.map((themeOption) => (
        <motion.button
          key={themeOption}
          onClick={() => setTheme(themeOption)}
          className={`
            relative px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${
              theme === themeOption
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }
          `}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {theme === themeOption && (
            <motion.div
              layoutId="theme-indicator"
              className="absolute inset-0 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600"
              initial={false}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{THEMES[themeOption].displayName}</span>
        </motion.button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
