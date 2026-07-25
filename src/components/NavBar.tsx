import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const TABS = [
  { label: 'AI Concierge', path: '/', icon: '✦' },
  { label: 'UCB Chatterbox', path: '/chatterbox', icon: '💬' },
];

const NavBar = () => {
  const location = useLocation();

  return (
    <motion.nav
      className="h-14 flex items-center justify-between px-6 border-b border-white/10 bg-black/60 backdrop-blur-xl z-50 relative"
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <motion.div
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-white text-sm font-bold">D</span>
        </motion.div>
        <span className="text-white font-semibold text-sm tracking-tight hidden sm:block">
          designinc.ai
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link key={tab.path} to={tab.path}>
              <motion.div
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-sky-500/30 to-blue-600/30 border border-sky-500/30"
                    initial={false}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
                <span className="relative z-10">{tab.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Right spacer */}
      <div className="w-24 hidden sm:block" />
    </motion.nav>
  );
};

export default NavBar;
