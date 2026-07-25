import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import Header from './Header';
import Sidebar from '../sidebar/Sidebar';
import ChatWindow from '../chat/ChatWindow';
import NotificationsPanel from './NotificationsPanel';
import SuggestionsPanel from './SuggestionsPanel';

const MainLayout: React.FC = () => {
  useTheme();

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <Header />

      <motion.div
        className="flex-1 flex overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Sidebar />

        <main className="flex-1 flex overflow-hidden">
          <ChatWindow />
        </main>

        <SuggestionsPanel />
        <NotificationsPanel />
      </motion.div>
    </div>
  );
};

export default MainLayout;
