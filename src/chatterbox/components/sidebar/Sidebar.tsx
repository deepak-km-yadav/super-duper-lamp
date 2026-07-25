import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import PersonalityCard from './PersonalityCard';
import { FiSearch, FiX } from 'react-icons/fi';
import Button from '../common/Button';

const Sidebar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    personalities,
    conversations,
    activePersonalityId,
    setActivePersonality,
    isSidebarOpen,
    toggleSidebar,
  } = useChatStore();

  const filteredPersonalities = personalities.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.personality.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedPersonalities = filteredPersonalities.filter((p) => p.isPinned);
  const favoritePersonalities = filteredPersonalities.filter((p) => p.isFavorite && !p.isPinned);
  const otherPersonalities = filteredPersonalities.filter((p) => !p.isFavorite && !p.isPinned);

  const renderPersonalitySection = (title: string, personalitiesList: typeof personalities) => {
    if (personalitiesList.length === 0) return null;

    return (
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
          {title}
        </h3>
        <div className="space-y-1">
          {personalitiesList.map((personality) => (
            <PersonalityCard
              key={personality.id}
              personality={personality}
              conversation={conversations.find((c) => c.personalityId === personality.id)}
              isActive={personality.id === activePersonalityId}
              onClick={() => setActivePersonality(personality.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.aside
          className="w-80 h-full border-r border-white/10 bg-white/5 backdrop-blur-sm flex flex-col"
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white tracking-tight">Chats</h2>
              <Button variant="ghost" size="sm" onClick={toggleSidebar}>
                <FiX />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-10 pr-4 py-2.5 rounded-xl
                  bg-white/5 border border-white/10
                  text-gray-100 placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white/10
                  text-sm transition-all
                "
              />
            </div>
          </div>

          {/* Personalities List */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {renderPersonalitySection('Pinned', pinnedPersonalities)}
            {renderPersonalitySection('Favorites', favoritePersonalities)}
            {renderPersonalitySection('All Personalities', otherPersonalities)}

            {filteredPersonalities.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No personalities found</p>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
