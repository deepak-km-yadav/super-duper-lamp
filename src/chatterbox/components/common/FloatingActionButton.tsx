import React from 'react';
import { motion } from 'framer-motion';
import { FiPlus } from 'react-icons/fi';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  icon = <FiPlus className="w-6 h-6" />,
  className = '',
}) => {
  return (
    <motion.button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 md:bottom-8 md:right-8
        w-14 h-14 md:w-16 md:h-16
        rounded-full
        bg-gradient-to-r from-sky-500 to-blue-600
        text-white
        shadow-lg hover:shadow-xl
        flex items-center justify-center
        z-50
        transition-all
        ${className}
      `}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {icon}
    </motion.button>
  );
};

export default FloatingActionButton;
