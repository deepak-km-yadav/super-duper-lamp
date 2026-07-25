export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export interface FAQItem {
  id: string;
  title: string;
  videoUrl?: string;
  thumbnail?: string;
}

export interface AIBeing {
  id: string;
  name: string;
  initial: string;
  role: string;
  description: string;
  greeting: string;
  image?: string;
}

export const AI_BEINGS: AIBeing[] = [
  {
    id: 'maverick',
    name: 'Maverick',
    initial: 'M',
    role: 'Co-Founder & CMO',
    description: 'A strategic brand architect for campaigns, positioning, and conversion messaging.',
    greeting: "I’m Maverick. Bring me your offer, audience, or launch goal, and I’ll turn it into a clear marketing plan.",
    image: '/beings/maverick.jpg',
  },
  {
    id: 'niyati',
    name: 'Niyati',
    initial: 'N',
    role: 'Fashion AI Strategist',
    description: 'A style and creator-brand guide for outfits, aesthetics, and content positioning.',
    greeting: "Hey, I’m Niyati. Share your look goal, occasion, and vibe, and I’ll map your style direction.",
    image: '/beings/niyati.png',
  },
  {
    id: 'eagan',
    name: 'Eagan',
    initial: 'G',
    role: 'Legal-Eagle',
    description: 'A legal strategy guide for structured, plain-language decision support.',
    greeting: "I’m Eagan. Tell me the legal scenario and outcome you want, and we’ll structure the next move.",
    image: '/beings/eagan.jpg',
  },
  {
    id: 'niyomi',
    name: 'Niyomi',
    initial: 'Y',
    role: 'Scheduling Assistant',
    description: 'An executive scheduler that turns conversation into confirmed calendar action.',
    greeting: "I’m Niyomi. Share your availability windows and meeting priority, and I’ll propose the best schedule.",
    image: '/beings/niyomi.png',
  },
  {
    id: 'elly',
    name: 'Elly',
    initial: 'E',
    role: 'Dragon AI Guide',
    description: 'A dragon intelligence guide for strategy, structure, and clear action.',
    greeting: "Flame on. I'm Elly, your dragon AI guide. What challenge should we forge into a clear next step?",
    image: '/elly-dragon.jpg',
  },
];
