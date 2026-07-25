import { motion } from 'framer-motion';
import type { FAQItem } from './types';

interface FAQPanelProps {
  faqs: FAQItem[];
  selectedFAQ: FAQItem | null;
  onSelect: (faq: FAQItem) => void;
}

export const FAQPanel = ({ faqs, selectedFAQ, onSelect }: FAQPanelProps) => {
  if (faqs.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 h-full p-2">
      <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
        FAQs
      </p>
      <div className="flex flex-col gap-1 flex-1">
        {faqs.map((faq, index) => (
          <motion.button
            key={faq.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            onClick={() => onSelect(faq)}
            className={`faq-button text-left ${
              selectedFAQ?.id === faq.id ? 'active' : ''
            }`}
          >
            {/* Radio indicator */}
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all flex items-center justify-center ${
                selectedFAQ?.id === faq.id 
                  ? 'border-primary' 
                  : 'border-muted-foreground/50'
              }`}>
                {selectedFAQ?.id === faq.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary"
                  />
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-foreground/90 leading-tight pt-0.5">
                {faq.title}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
