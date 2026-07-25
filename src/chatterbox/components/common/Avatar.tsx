import React from 'react';
import { motion } from 'framer-motion';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'typing';
  badge?: React.ReactNode;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  status,
  badge,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    typing: 'bg-yellow-500',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-white/20`}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 300 }}
      />
      {status && (
        <span
          className={`
            absolute bottom-0 right-0 block w-3 h-3 rounded-full border-2 border-white
            ${statusColors[status]}
            ${status === 'typing' ? 'animate-pulse' : ''}
          `}
        />
      )}
      {badge && (
        <span className="absolute -top-1 -right-1">
          {badge}
        </span>
      )}
    </div>
  );
};

export default Avatar;
