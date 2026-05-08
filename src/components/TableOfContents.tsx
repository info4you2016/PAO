import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

import { Theme, SlideData } from '../types';

interface TableOfContentsProps {
  isOpen: boolean;
  onClose: () => void;
  slides: SlideData[];
  currentSlide: number;
  onSelectSlide: (index: number) => void;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  isOpen,
  onClose,
  slides,
  currentSlide,
  onSelectSlide,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xs sm:max-w-md bg-white shadow-2xl z-[70] flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Sommaire</h3>
                <p className="text-sm text-slate-500">{slides.length} diapositives</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-3">
              {slides.map((slide, index) => {
                const isActive = currentSlide === index;
                const isViewed = index <= currentSlide;

                return (
                  <motion.button
                    key={slide.id || index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      onSelectSlide(index);
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-start gap-4 p-5 rounded-2xl transition-all text-left group",
                      isActive 
                        ? "bg-slate-900 shadow-xl shadow-slate-900/20" 
                        : "hover:bg-slate-50 border-transparent border"
                    )}
                  >
                    <div className={cn(
                      "mt-1.5 flex-shrink-0 transition-colors",
                      isActive ? "text-brand-accent" : (isViewed ? "text-slate-400" : "text-slate-200")
                    )}>
                      {isViewed ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <Circle className="w-5 h-5 flex-shrink-0" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-widest mb-1 font-mono",
                        isActive ? "text-slate-400" : "text-slate-400"
                      )}>
                        Slide {String(index + 1).padStart(2, '0')}
                      </div>
                      <h4 className={cn(
                        "font-display font-bold leading-tight transition-colors truncate",
                        isActive ? "text-white" : "text-slate-700 group-hover:text-slate-900"
                      )}>
                        {slide.title}
                      </h4>
                      <div className="flex gap-2 mt-1">
                        {slide.isQuiz && <span className="text-[8px] font-black uppercase tracking-tighter text-blue-400 px-1.5 py-0.5 rounded-sm bg-blue-400/10 border border-blue-400/20">Quiz</span>}
                        {slide.isPlayground && <span className="text-[8px] font-black uppercase tracking-tighter text-emerald-400 px-1.5 py-0.5 rounded-sm bg-emerald-400/10 border border-emerald-400/20">Code</span>}
                      </div>
                    </div>
                    
                    {isActive && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-2"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                <span>Progression</span>
                <span className="font-mono font-bold text-slate-900">
                  {Math.round(((currentSlide + 1) / slides.length) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-brand-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
