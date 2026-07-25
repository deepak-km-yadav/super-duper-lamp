import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { FiEdit2, FiUser, FiMail, FiSave, FiX } from 'react-icons/fi';
import Button from '../common/Button';
import Avatar from '../common/Avatar';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { userProfile, updateUserProfile } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(userProfile);

  const handleSave = () => {
    updateUserProfile(editedProfile);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedProfile(userProfile);
    setIsEditing(false);
  };

  const handleAvatarChange = () => {
    // For now, generate a new random avatar
    const newSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`;
    setEditedProfile({ ...editedProfile, avatar: newAvatar });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="bg-dark-800 border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-primary-600/20 to-secondary-600/20">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">User Profile</h2>
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    <FiX />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Avatar
                      src={isEditing ? editedProfile.avatar : userProfile.avatar}
                      alt={userProfile.displayName}
                      size="xl"
                    />
                    {isEditing && (
                      <motion.button
                        className="absolute bottom-0 right-0 p-2 rounded-full bg-primary-600 text-white shadow-lg"
                        onClick={handleAvatarChange}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-400">
                    {isEditing ? 'Click icon to change avatar' : 'Your avatar'}
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Display Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <FiUser className="w-4 h-4" />
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={isEditing ? editedProfile.displayName : userProfile.displayName}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, displayName: e.target.value })
                      }
                      disabled={!isEditing}
                      className="
                        w-full px-4 py-2 rounded-lg
                        bg-white/10 border border-white/20
                        text-gray-100 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <FiUser className="w-4 h-4" />
                      Username
                    </label>
                    <input
                      type="text"
                      value={userProfile.username}
                      disabled
                      className="
                        w-full px-4 py-2 rounded-lg
                        bg-white/5 border border-white/10
                        text-gray-400
                        cursor-not-allowed
                      "
                    />
                    <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
                  </div>

                  {/* Email (Optional) */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <FiMail className="w-4 h-4" />
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={isEditing ? editedProfile.email || '' : userProfile.email || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, email: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="your@email.com"
                      className="
                        w-full px-4 py-2 rounded-lg
                        bg-white/10 border border-white/20
                        text-gray-100 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleSave}
                        className="flex-1"
                        icon={<FiSave />}
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={handleCancel}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsEditing(true)}
                      className="w-full"
                      icon={<FiEdit2 />}
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UserProfile;
