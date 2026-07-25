import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import type { Notification } from '../../types';
import { FiBell, FiX, FiAlertCircle, FiInfo, FiMessageSquare } from 'react-icons/fi';
import Button from '../common/Button';
import Badge from '../common/Badge';

const NotificationItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { markNotificationAsRead } = useChatStore();

  const getIcon = () => {
    switch (notification.type) {
      case 'message':
        return <FiMessageSquare className="w-5 h-5 text-blue-400" />;
      case 'error':
        return <FiAlertCircle className="w-5 h-5 text-red-400" />;
      case 'system':
        return <FiInfo className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <motion.div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all
        ${notification.read ? 'bg-white/5 border-white/10' : 'bg-primary-500/10 border-primary-500/30'}
      `}
      onClick={() => markNotificationAsRead(notification.id)}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-sm text-white">{notification.title}</h4>
            {!notification.read && <Badge variant="primary" size="sm">New</Badge>}
          </div>
          <p className="text-xs text-gray-400 mb-1">{notification.message}</p>
          <span className="text-xs text-gray-500">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const NotificationsPanel: React.FC = () => {
  const {
    notifications,
    isNotificationsPanelOpen,
    toggleNotificationsPanel,
    clearNotifications,
  } = useChatStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AnimatePresence>
      {isNotificationsPanelOpen && (
        <motion.div
          className="w-80 h-full border-l border-white/10 bg-white/5 backdrop-blur-sm flex flex-col"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <Badge variant="primary" size="sm">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleNotificationsPanel}>
                <FiX />
              </Button>
            </div>

            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="w-full"
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            <AnimatePresence>
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </AnimatePresence>

            {notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <FiBell className="w-12 h-12 text-gray-500 mb-3" />
                <p className="text-gray-400 text-sm">No notifications</p>
                <p className="text-gray-500 text-xs mt-1">You're all caught up!</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationsPanel;
