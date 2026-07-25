import type { AIPersonality } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Base webhook URL - same for all personalities initially
const BASE_WEBHOOK_URL = 'https://n8n.srv755528.hstgr.cloud/webhook/08359034-061c-45f9-bbe0-45abf21b63fe/chat';

// Avatar URLs using DiceBear API for consistent, unique avatars
const generateAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

// Predefined AI personalities with distinct characteristics
export const AI_PERSONALITIES: AIPersonality[] = [
  {
    id: uuidv4(),
    name: 'Luna',
    avatar: generateAvatar('luna'),
    personality: 'Friendly & Empathetic',
    description: 'A warm and understanding AI companion who loves to help and support you.',
    color: '#8B5CF6',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Atlas',
    avatar: generateAvatar('atlas'),
    personality: 'Logical & Analytical',
    description: 'A systematic thinker who provides data-driven insights and solutions.',
    color: '#3B82F6',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Spark',
    avatar: generateAvatar('spark'),
    personality: 'Creative & Imaginative',
    description: 'An innovative AI that thinks outside the box and loves brainstorming.',
    color: '#F59E0B',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Sage',
    avatar: generateAvatar('sage'),
    personality: 'Wise & Philosophical',
    description: 'A thoughtful mentor who offers deep wisdom and life perspectives.',
    color: '#10B981',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Blitz',
    avatar: generateAvatar('blitz'),
    personality: 'Quick & Efficient',
    description: 'Fast-paced and results-oriented, perfect for quick tasks and answers.',
    color: '#EF4444',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Nova',
    avatar: generateAvatar('nova'),
    personality: 'Curious & Explorative',
    description: 'Always asking questions and exploring new ideas with enthusiasm.',
    color: '#EC4899',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Echo',
    avatar: generateAvatar('echo'),
    personality: 'Sarcastic & Witty',
    description: 'Sharp humor and clever comebacks, but always helpful underneath.',
    color: '#6366F1',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
  {
    id: uuidv4(),
    name: 'Zen',
    avatar: generateAvatar('zen'),
    personality: 'Calm & Mindful',
    description: 'Peaceful and balanced, helps you find clarity and inner peace.',
    color: '#14B8A6',
    webhookUrl: BASE_WEBHOOK_URL,
    isFavorite: false,
    isPinned: false,
  },
];

// Default suggestions for quick start
export const DEFAULT_SUGGESTIONS = [
  { id: '1', text: 'Tell me a joke', category: 'Fun', icon: '😄' },
  { id: '2', text: 'Help me brainstorm ideas', category: 'Creative', icon: '💡' },
  { id: '3', text: 'Explain something complex', category: 'Learn', icon: '🧠' },
  { id: '4', text: 'Give me advice', category: 'Support', icon: '💬' },
  { id: '5', text: 'Analyze this problem', category: 'Logic', icon: '🔍' },
  { id: '6', text: 'What\'s your perspective on...', category: 'Philosophy', icon: '🤔' },
];
