import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { FiMenu, FiBell, FiZap } from 'react-icons/fi';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ThemeSwitcher from '../common/ThemeSwitcher';
import Avatar from '../common/Avatar';
import UserProfile from '../profile/UserProfile';

const Header: React.FC = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const {
    isSidebarOpen,
    toggleSidebar,
    toggleNotificationsPanel,
    toggleSuggestionsPanel,
    isNotificationsPanelOpen,
    isSuggestionsPanelOpen,
    notifications,
    userProfile,
  } = useChatStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <motion.header
        className="h-14 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shadow-sm flex-shrink-0"
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {!isSidebarOpen && (
            <Button variant="ghost" size="sm" onClick={toggleSidebar}>
              <FiMenu />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <motion.div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-lg">💬</span>
            </motion.div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">UCB Chatterbox</h1>
              <p className="text-xs text-gray-400">Multi-AI conversations</p>
            </div>
          </div>
        </div>

        {/* Center Section - Theme Switcher */}
        <div className="hidden lg:flex">
          <ThemeSwitcher />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSuggestionsPanel}
            className={`rounded-lg ${isSuggestionsPanelOpen ? 'bg-white/10' : ''}`}
          >
            <FiZap className={isSuggestionsPanelOpen ? 'text-sky-400' : ''} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleNotificationsPanel}
            className={`relative rounded-lg ${isNotificationsPanelOpen ? 'bg-white/10' : ''}`}
          >
            <FiBell className={isNotificationsPanelOpen ? 'text-sky-400' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1">
                <Badge variant="danger" size="sm">
                  {unreadCount}
                </Badge>
              </span>
            )}
          </Button>

          <div className="h-6 w-px bg-white/10 mx-2" />

          <motion.button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Avatar src={userProfile.avatar} alt={userProfile.displayName} size="sm" />
            <span className="text-sm font-medium text-gray-100 hidden md:block">
              {userProfile.displayName}
            </span>
          </motion.button>
        </div>
      </motion.header>

      <UserProfile isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};

export default Header;
