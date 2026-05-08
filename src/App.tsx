import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Login } from './components/Login';
import { api } from './lib/api';
import { 
  ChevronLeft, 
  ChevronRight, 
  Layers,
  Download,
  Settings,
  X,
  LogOut,
  List,
  Maximize,
  Minimize,
  Info,
  Timer,
  Keyboard,
  HelpCircle,
  FileText,
  Quote,
  Zap,
  Target
} from 'lucide-react';
import { cn } from './lib/utils';
import { toPng } from 'html-to-image';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { TableOfContents } from './components/TableOfContents';
import { CodePlayground } from './components/CodePlayground';
import { InteractiveQuiz } from './components/InteractiveQuiz';
import { InteractiveQA } from './components/InteractiveQA';
import { exportPresentationToPPTX } from './services/exportService';
import { OptimizedImage } from './components/OptimizedImage';
import { CodeBlock } from './components/CodeBlock';
import { PRESENTATION_THEMES } from './constants';
import { authHelpers } from './firebase';
import { Theme, SlideData, PresentationData, QuizQuestion, CustomTheme } from './types';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';

// Rehype plugin to filter out invalid attribute names that cause React 19 to crash
// Specifically targets attributes that start with a digit or contain invalid characters,
// which often happens when HTML with unquoted attributes (like SVGs) is parsed by rehype-raw.
const rehypeFilterInvalidAttributes = () => {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.properties) {
        Object.keys(node.properties).forEach(key => {
          // React attribute names must not start with a digit and should match standard naming conventions
          if (/^[0-9]/.test(key) || key.includes('"')) {
            delete node.properties[key];
          }
        });
      }
    });
  };
};

// --- Components ---

const HelpOverlay = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 overflow-hidden relative"
          onClick={e => e.stopPropagation()}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-black text-slate-900">Aide & Raccourcis</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: '→ / Espace', label: 'Suivant' },
                { key: '←', label: 'Précédent' },
                { key: 'F', label: 'Plein Écran' },
                { key: 'T', label: 'Sommaire' },
                { key: 'H', label: 'Aide (ici)' },
                { key: 'S', label: 'Notes' },
                { key: 'E', label: 'Explication' },
                { key: 'L', label: 'Laser' },
                { key: 'Esc', label: 'Quitter' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold shadow-sm">{item.key}</kbd>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl flex items-start gap-3 mt-4">
              <Info className="w-5 h-5 text-brand-primary mt-0.5" />
              <p className="text-xs text-brand-primary font-medium leading-relaxed">
                Appuyez sur <span className="font-bold">F</span> pour une immersion totale. Utilisez les flèches pour naviguer facilement.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-lg active:scale-95"
          >
            J'ai compris
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '50%' : '-50%',
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '50%' : '-50%',
    opacity: 0,
    scale: 0.95,
  })
};

const BentoCell = memo(({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95, y: 20 }}
    whileInView={{ opacity: 1, scale: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ 
      delay, 
      duration: 0.6, 
      ease: [0.22, 1, 0.36, 1] 
    }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className={cn(
      "relative rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md overflow-hidden group transition-all duration-300",
      className
    )}
  >
    {children}
  </motion.div>
));

const renderSlideContent = (slide: SlideData, index: number, isAdmin: boolean, theme: any) => {
    if (slide.isQA) {
      return <InteractiveQA slideId={slide.id || `temp-${index}`} isAdmin={isAdmin} />;
    }

    if (slide.isQuiz && slide.quizQuestions) {
      return (
        <InteractiveQuiz 
          questions={slide.quizQuestions} 
        />
      );
    }

    if (slide.isPlayground) {
      return (
        <div className="mt-8 w-full h-full max-h-[60vh]">
          <CodePlayground 
            initialCode={slide.initialCode || "// Écrivez votre code ici"} 
            title={slide.title}
            description="Bac à sable interactif"
          />
        </div>
      );
    }

    return (
      <div className={cn(
        "presentation-rich-content prose prose-slate max-w-none",
        theme.isCustom ? "" : (theme.id === 'midnight' ? "prose-invert text-slate-200" : "text-slate-800")
      )} style={theme.isCustom ? { color: theme.text } : {}}>
        <ReactMarkdown
          rehypePlugins={[rehypeRaw, rehypeFilterInvalidAttributes]}
          components={{
            p: ({ children }) => <div className="mb-6 last:mb-0 leading-relaxed">{children}</div>,
            code({ className, children, inline, ...props }: any) {
              return (
                <CodeBlock 
                  inline={inline}
                  code={String(children).replace(/\n$/, '')} 
                />
              );
            }
          }}
        >
          {slide.content}
        </ReactMarkdown>
      </div>
    );
  };

const Slide = ({ slide, index, total, direction, isAdmin, showNotes, showExplanation, theme }: { slide: SlideData; index: number; total: number; direction: number; isAdmin: boolean; showNotes: boolean; showExplanation: boolean; theme: any; key?: React.Key }) => {

  const layout = slide.layoutType || 'standard';

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, { offset, velocity }) => {
        const swipe = Math.abs(offset.x) > 50 && Math.abs(velocity.x) > 500;
        if (swipe) {
          if (offset.x > 0) {
            // This is a bit tricky since Slide doesn't have access to prev/next functions directly
            // I'll need to pass them down or use a context/global event.
            // For now, I'll use a custom event.
            window.dispatchEvent(new CustomEvent('slide-prev'));
          } else {
            window.dispatchEvent(new CustomEvent('slide-next'));
          }
        }
      }}
      transition={{
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.4 }
      }}
      className={cn(
        "relative w-full h-full flex items-center justify-center p-4 sm:p-10 md:p-12 lg:p-20 overflow-hidden transition-all duration-700",
        slide.bgColor ? "" : (theme.id === 'midnight' ? "bg-slate-800/40" : "bg-white/40")
      )}
      style={{ 
        backgroundColor: slide.bgColor || (theme.isCustom ? theme.slideBg : undefined),
        color: theme.isCustom ? theme.text : undefined,
        touchAction: 'none'
      }}
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: theme.id === 'midnight' ? [0.05, 0.1, 0.05] : [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className={cn(
            "absolute top-[-25%] right-[-15%] w-[100%] h-[100%] rounded-full blur-[120px]",
            theme.isCustom ? "" : (theme.id === 'midnight' ? "bg-brand-accent/20" : "bg-brand-primary/10")
          )}
          style={theme.isCustom ? { backgroundColor: `${theme.primary}20` } : {}}
        />
        <motion.div 
          animate={{ 
            scale: [1.3, 1, 1.3],
            rotate: [90, 180, 90],
            opacity: theme.id === 'midnight' ? [0.03, 0.08, 0.03] : [0.1, 0.3, 0.1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className={cn(
            "absolute bottom-[-25%] left-[-15%] w-[100%] h-[100%] rounded-full blur-[120px]",
            theme.isCustom ? "" : (theme.id === 'midnight' ? "bg-brand-primary/20" : "bg-brand-accent/10")
          )}
          style={theme.isCustom ? { backgroundColor: `${theme.secondary}20` } : {}}
        />
        {/* Subtle mesh overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      <div className={cn(
        "relative z-10 w-full max-w-7xl h-full flex flex-col",
        (layout === 'split' || (showExplanation && slide.explanation)) ? "xl:flex-row gap-6 lg:gap-16" : "items-center"
      )} style={theme.isCustom ? { color: theme.text } : {}}>
        {/* Header/Info */}
        <div className={cn(
          "flex-shrink-0 w-full mb-4 sm:mb-6",
          (layout === 'standard' && !slide.image) ? "text-center" : "text-left"
        )}>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn("flex items-center gap-3 mb-2", (layout === 'standard' && !slide.image) ? "justify-center" : "")}
          >
            <div className="h-0.5 w-8 sm:w-16 bg-brand-primary/20 rounded-full" />
            <span className="text-brand-primary/40 font-display font-black tracking-[0.2em] uppercase text-[9px] sm:text-xs">
              Slide {index + 1} / {total}
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className={cn(
              "font-display font-black leading-[1.05] tracking-tight transition-all duration-500 text-balance",
              theme.isCustom ? "" : (theme.id === 'midnight' ? "text-white" : "text-slate-900"),
              layout === 'bento' ? "text-[clamp(1.1rem,3.5vw,2.25rem)] mb-2" : 
              layout === 'split' ? "text-[clamp(1.3rem,4.5vw,3rem)] mb-4" :
              "text-[clamp(1.5rem,5.5vw,4rem)] mb-4 sm:mb-8"
            )}
            style={theme.isCustom ? { color: theme.text } : {}}
          >
            {slide.title}
          </motion.h1>
        </div>

        {/* Content Area Based on Layout */}
        <div className="flex-1 w-full min-h-0 overflow-hidden relative">
          {layout === 'standard' && (
            <div className={cn(
              "flex flex-col xl:flex-row gap-8 lg:gap-16 h-full",
              (slide.image || (showExplanation && slide.explanation)) ? "text-left items-start" : "text-center items-center justify-center"
            )}>
              <div className="flex-[3] w-full overflow-y-auto presentation-slide-scrollbar pr-2 sm:pr-4 max-h-full">
                {renderSlideContent(slide, index, isAdmin, theme)}
              </div>
              {slide.image && !showExplanation && (
                <div className="flex-[2] flex items-center justify-center w-full perspective-1000 mt-8 xl:mt-0 xl:max-w-[45%]">
                  <div className="relative group w-full">
                    <div className="absolute -inset-4 sm:-inset-12 bg-brand-primary/5 rounded-2xl sm:rounded-3xl blur-3xl group-hover:bg-brand-primary/10 transition-all duration-500" />
                    <OptimizedImage 
                      src={slide.image} 
                      alt={slide.title}
                      className="relative w-full h-auto max-h-[60vh] object-contain rounded-2xl sm:rounded-[2.5rem] shadow-2xl border-4 sm:border-8 border-white group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                </div>
              )}

              {/* Side Explanation Panel */}
              <AnimatePresence>
                {showExplanation && slide.explanation && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={cn(
                      "flex-1 flex flex-col h-full backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] border shadow-2xl overflow-hidden mt-4 sm:mt-0",
                      theme.id === 'midnight' ? "bg-slate-900/60 border-slate-700" : "bg-white/60 border-white"
                    )}
                  >
                    <div className={cn(
                      "p-4 sm:p-6 border-b flex items-center gap-3",
                      theme.id === 'midnight' ? "bg-slate-900/40 border-slate-700/40" : "bg-white/30 border-white/40"
                    )}>
                      <div className="p-1 sm:p-1.5 bg-brand-primary/10 rounded-lg">
                        <Info className="w-4 h-4 sm:w-5 h-5 text-brand-primary" />
                      </div>
                      <span className={cn(
                        "text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]",
                        theme.id === 'midnight' ? "text-slate-300" : "text-slate-800"
                      )}>Note additionnelle</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 presentation-slide-scrollbar">
                      <div className={cn(
                        "prose prose-slate max-w-none",
                        theme.id === 'midnight' ? "prose-invert prose-p:text-slate-300" : "prose-p:text-slate-800"
                      )}>
                        <ReactMarkdown 
                          rehypePlugins={[rehypeRaw, rehypeFilterInvalidAttributes]}
                          components={{
                            p: ({ children }) => <div className="mb-6 last:mb-0 text-base leading-relaxed opacity-90">{children}</div>,
                            code({ className, children, inline, ...props }: any) {
                              return (
                                <CodeBlock 
                                  inline={inline}
                                  code={String(children).replace(/\n$/, '')} 
                                />
                              );
                            }
                          }}
                        >
                          {slide.explanation}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {layout === 'split' && (
            <div className="flex flex-col xl:flex-row gap-6 lg:gap-12 h-full">
              <div className="flex-[1.2] overflow-y-auto presentation-slide-scrollbar pr-2 sm:pr-6">
                {renderSlideContent(slide, index, isAdmin, theme)}
              </div>
              <div className="flex-1 h-full min-h-[200px] xl:min-h-[400px]">
                {slide.image ? (
                  <motion.div
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1 }}
                    className="w-full h-full"
                  >
                    <OptimizedImage src={slide.image} className="w-full h-full shadow-2xl border-4 sm:border-8 border-white/40 rounded-2xl sm:rounded-[3rem]" alt="" aspectRatio="auto" />
                  </motion.div>
                ) : isAdmin ? (
                  <div className="w-full h-full bg-white/30 backdrop-blur-md border-2 sm:border-4 border-dashed border-white rounded-2xl sm:rounded-[3rem] flex items-center justify-center p-6 sm:p-12 text-center">
                    <div className="flex flex-col items-center gap-2 sm:gap-4">
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-brand-primary/5 flex items-center justify-center">
                        <Layers className="w-6 h-6 sm:w-8 sm:h-8 text-brand-primary/20" />
                      </div>
                      <span className="text-slate-400 font-bold tracking-wider text-[10px] sm:text-base uppercase">Note Additionnelle</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {layout === 'bento' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 h-full">
              <BentoCell 
                className={cn(
                  "md:col-span-3 backdrop-blur-xl p-1",
                  theme.id === 'midnight' ? "bg-slate-800/80 border-slate-700" : "bg-white/70 border-white"
                )} 
                delay={0.1}
              >
                <div className="h-full overflow-y-auto presentation-slide-scrollbar p-6 sm:p-10">
                  {renderSlideContent(slide, index, isAdmin, theme)}
                </div>
              </BentoCell>
              
              <div className="md:col-span-1 flex flex-col gap-4 sm:gap-6">
                <BentoCell 
                  className={cn(
                    "flex-[2]",
                    theme.id === 'midnight' ? "bg-slate-800/80 border-slate-700" : ""
                  )} 
                  delay={0.2}
                >
                  {slide.image ? (
                    <div className="h-full relative group">
                      <OptimizedImage src={slide.image} className="w-full h-full" alt="" aspectRatio="auto" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end p-8">
                        <span className="text-white text-xs font-black uppercase tracking-widest">Focus Visuel</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full bg-brand-primary/5 flex items-center justify-center">
                      <Layers className="w-12 h-12 text-brand-primary/10" />
                    </div>
                  )}
                </BentoCell>

                <BentoCell 
                  className={cn(
                    "p-4 sm:p-6 flex flex-col justify-center relative overflow-hidden group min-h-0",
                    theme.id === 'midnight' ? "bg-slate-800/80 border-slate-700" : "bg-white/80 border-white"
                  )}
                  delay={0.3}
                >
                  <div className={cn(
                    "absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform duration-700",
                    theme.id === 'midnight' ? "text-brand-accent" : "text-brand-primary"
                  )}>
                    <Quote className="w-16 h-16 sm:w-20 sm:h-20" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <motion.div 
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center",
                          theme.id === 'midnight' ? "bg-brand-accent/20 text-brand-accent" : "bg-brand-accent/20 text-brand-primary"
                        )}
                      >
                        <Quote className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                      </motion.div>
                      <h3 className={cn(
                        "font-display font-black text-[8px] sm:text-[10px] mb-0 uppercase tracking-[0.2em]",
                        theme.id === 'midnight' ? "text-brand-accent" : "text-brand-primary"
                      )}>Points clés</h3>
                    </div>
                    <p className={cn(
                      "text-xs sm:text-base leading-snug sm:leading-relaxed font-bold italic tracking-tight",
                      theme.id === 'midnight' ? "text-slate-200" : "text-slate-800"
                    )}>
                      {slide.keyTakeaway || "L'essentiel est invisible pour les yeux, mais capital pour la compréhension."}
                    </p>
                  </div>
                </BentoCell>
              </div>
            </div>
          )}

          {layout === 'fullImage' && slide.image && (
            <div className="absolute inset-0 rounded-[2rem] sm:rounded-[4rem] overflow-hidden shadow-2xl border-4 sm:border-[16px] border-white/20 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 1.2, filter: 'blur(10px)' }}
                animate={{ scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="w-full h-full"
              >
                <OptimizedImage src={slide.image} className="w-full h-full" alt="" aspectRatio="auto" />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-900/60 backdrop-blur-[1px] flex items-center justify-center p-6 sm:p-20 text-center">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className={cn(
                    "max-w-4xl backdrop-blur-3xl p-10 sm:p-20 rounded-[2.5rem] sm:rounded-[5rem] border shadow-2xl relative overflow-hidden group",
                    theme.id === 'midnight' ? "bg-slate-900/60 border-slate-700/50" : "bg-white/40 border-white/40"
                  )}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary/30 to-transparent" />
                   {renderSlideContent(slide, index, isAdmin, theme)}
                </motion.div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Speaker Notes Overlay (Presenter Mode) */}
      <AnimatePresence>
        {isAdmin && showNotes && slide.speakerNotes && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-4 left-4 right-4 z-50 bg-slate-900/90 backdrop-blur-md text-white p-6 rounded-[2rem] border border-slate-700 shadow-2xl max-h-[150px] overflow-y-auto"
          >
            <div className="flex items-center gap-2 mb-2 text-slate-400">
               <List className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-widest">Notes Présentateur</span>
            </div>
            <p className="text-sm font-sans leading-relaxed text-slate-200">
              {slide.speakerNotes}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTOCOpen, setIsTOCOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<PresentationData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportIndex, setExportIndex] = useState(-1);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isLaserEnabled, setIsLaserEnabled] = useState(false);
  const [laserPosition, setLaserPosition] = useState({ x: 0, y: 0 });
  const [presentationStartTime, setPresentationStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: any;
    if (selectedPresentation && presentationStartTime) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - presentationStartTime) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [selectedPresentation, presentationStartTime]);

  const formatElapsedTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const exportRef = React.useRef<HTMLDivElement>(null);

  const resolveTheme = (): Theme => {
    if (!selectedPresentation?.theme) return PRESENTATION_THEMES[0] as Theme;
    
    if (selectedPresentation.theme.startsWith('custom:')) {
      const customId = selectedPresentation.theme.replace('custom:', '');
      const found = customThemes.find(t => t.id === customId);
      if (found) {
        return {
          id: `custom:${found.id}`,
          name: found.name,
          primary: found.primaryColor,
          secondary: found.secondaryColor,
          accent: found.accentColor,
          bg: found.bgColor,
          slideBg: found.slideBgColor,
          text: found.textColor,
          isCustom: true
        };
      }
    }
    
    return (PRESENTATION_THEMES.find(t => t.id === selectedPresentation.theme) || PRESENTATION_THEMES[0]) as Theme;
  };

  const currentTheme = resolveTheme();

  useEffect(() => {
    const loadThemes = async () => {
      try {
        const themes = await api.themes.getAll();
        setCustomThemes(themes);
      } catch (error) {
        console.error("Error loading themes", error);
      }
    };
    loadThemes();
    
    // Also listen for auth changes to reload if needed, but the themes table is mostly public now
    const unsub = authHelpers.onAuthStateChanged(() => {
      loadThemes();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          const userData = await api.users.get(parsed.id);
          if (userData && userData.id) {
            setUser(parsed);
          } else {
            handleLogout();
          }
        } catch (e) {
          // Silent logout if user not found or other API error
          handleLogout();
        }
      }
      setIsLoading(false);
    };
    checkUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setSelectedPresentation(null);
    setIsAdminOpen(false);
  };

  const loadSlides = async (presentationId: string) => {
    try {
      setIsLoading(true);
      const slidesData = await api.presentations.getSlides(presentationId);
      setSlides(slidesData.map((s: any) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        image: s.image_url,
        bgColor: s.bg_color,
        order: s.slide_order,
        isPlayground: Boolean(s.is_playground),
        initialCode: s.initial_code,
        isQuiz: Boolean(s.is_quiz),
        quizQuestions: s.quiz_questions ? JSON.parse(s.quiz_questions) : null,
        isQA: Boolean(s.is_qa),
        smartArt: s.smart_art ? JSON.parse(s.smart_art) : null,
        layoutType: s.layout_type || 'standard',
        explanation: s.explanation,
        speakerNotes: s.speaker_notes
      })));
    } catch (error) {
      console.error("Error loading slides:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPresentation) {
      setSlides([]);
      setIsLoading(false);
      return;
    }

    loadSlides(selectedPresentation.id);
  }, [selectedPresentation, user]);

  useEffect(() => {
    if (slides.length > 0 && currentSlide >= slides.length) {
      setCurrentSlide(slides.length - 1);
    } else if (slides.length === 0 && currentSlide !== 0) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  const nextSlide = useCallback(() => {
    if (slides.length === 0) return;
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length === 0) return;
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const exportToPPTX = () => {
    if (!selectedPresentation || slides.length === 0) return;
    setIsExporting(true);
    setSnapshots([]);
    setExportIndex(0);
  };

  useEffect(() => {
    if (isExporting && exportIndex >= 0 && exportIndex < slides.length && exportRef.current) {
      const capture = async () => {
        try {
          await new Promise(r => setTimeout(r, 800)); // Un peu plus de temps pour App.tsx
          if (!exportRef.current) return;
          const dataUrl = await toPng(exportRef.current, {
            width: 1280,
            height: 720,
            cacheBust: true,
            skipFonts: true,
          });
          setSnapshots(prev => [...prev, dataUrl]);
          setExportIndex(prev => prev + 1);
        } catch (err) {
          console.error("App Export Capture Error:", err);
          setExportIndex(prev => prev + 1);
        }
      };
      capture();
    } else if (isExporting && exportIndex >= slides.length && selectedPresentation) {
      exportPresentationToPPTX(selectedPresentation, slides, snapshots);
      setIsExporting(false);
      setExportIndex(-1);
    }
  }, [exportIndex, isExporting, slides, selectedPresentation, snapshots.length]);

  useEffect(() => {
    const handleSlideNext = () => nextSlide();
    const handleSlidePrev = () => prevSlide();
    window.addEventListener('slide-next', handleSlideNext);
    window.addEventListener('slide-prev', handleSlidePrev);
    return () => {
      window.removeEventListener('slide-next', handleSlideNext);
      window.removeEventListener('slide-prev', handleSlidePrev);
    };
  }, [nextSlide, prevSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'f') toggleFullscreen();
      if (e.key === 't') setIsTOCOpen(prev => !prev);
      if (e.key === 'h') setShowHelp(prev => !prev);
      if (e.key === 'n') setShowNotes(prev => !prev);
      if (e.key === 'e') setShowExplanation(prev => !prev);
      if (e.key === 'l') setIsLaserEnabled(prev => !prev);
      if (e.key === 'Escape' && selectedPresentation) {
        if (showHelp) {
          setShowHelp(false);
        } else if (isTOCOpen) {
          setIsTOCOpen(false);
        } else {
          setSelectedPresentation(null);
          setIsAdminOpen(false);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isLaserEnabled) {
        setLaserPosition({ x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [nextSlide, prevSlide, selectedPresentation, showHelp, isTOCOpen, toggleFullscreen, isLaserEnabled]);

  return (
    <ErrorBoundary>
      <div className={cn("fixed inset-0 flex flex-col overflow-hidden font-sans transition-colors duration-1000", currentTheme.isCustom ? "" : currentTheme.bg)} style={currentTheme.isCustom ? { backgroundColor: currentTheme.bg } : {}}>
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div 
            className={cn("absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl", currentTheme.isCustom ? "" : currentTheme.primary)} 
            style={currentTheme.isCustom ? { backgroundColor: currentTheme.primary } : {}}
          />
          <div 
            className={cn("absolute top-1/2 -right-24 w-64 h-64 rounded-full blur-3xl", currentTheme.isCustom ? "" : currentTheme.secondary)} 
            style={currentTheme.isCustom ? { backgroundColor: currentTheme.secondary } : {}}
          />
        </div>
        {/* Header / Progress */}
        <div className={cn(
        "relative z-20 w-full px-4 sm:px-6 py-2 sm:py-4 flex items-center justify-between backdrop-blur-md border-b",
        currentTheme.id === 'midnight' ? "bg-slate-900/60 border-slate-800" : "bg-white/40 border-slate-100"
      )}>
          <div 
            className="flex items-center gap-2 sm:gap-4 cursor-pointer group shrink-0" 
            onClick={() => { setSelectedPresentation(null); setIsAdminOpen(false); }}
          >
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center group-hover:bg-brand-accent transition-all shadow-lg active:scale-95">
              <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className={cn("max-w-[100px] sm:max-w-none", currentTheme.id === 'midnight' ? "text-slate-100" : "text-slate-900")}>
              <h2 className={cn(
                "font-display font-bold text-xs sm:text-lg tracking-tight transition-colors leading-none mb-0.5 sm:mb-1 truncate",
                selectedPresentation ? (currentTheme.id === 'midnight' ? "text-white" : "text-slate-900") : "text-slate-900"
              )}>
                {selectedPresentation ? selectedPresentation.title : "Plateforme Pédagogique"}
              </h2>
              <div className="flex items-center gap-1">
                <div className="w-0.5 h-0.5 rounded-full bg-brand-accent animate-pulse" />
                <span className="text-[7px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                  {selectedPresentation ? "Mode Présentation" : "Tableau de Bord"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {selectedPresentation && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg shadow-sm">
                <div className="flex items-center gap-1 px-1 sm:px-2 py-0.5 bg-brand-primary/10 rounded-md border border-brand-primary/20">
                  <Timer className="w-2.5 h-2.5 sm:w-3 h-3 text-brand-primary" />
                  <span className="text-[8px] sm:text-[10px] font-mono font-bold text-brand-primary tabular-nums">
                    {formatElapsedTime(elapsedSeconds)}
                  </span>
                </div>
                <div className="w-px h-3 sm:h-4 bg-slate-200" />
                <button 
                  onClick={() => setIsTOCOpen(true)}
                  className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-900 transition-all font-bold"
                  title="Sommaire (T)"
                >
                  <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="w-px h-3 sm:h-4 bg-slate-200 hidden sm:block" />
                <button 
                  onClick={() => setShowNotes(!showNotes)}
                  className={cn(
                    "p-1.5 rounded-md transition-all hidden sm:block",
                    showNotes ? "bg-brand-primary text-white" : "text-slate-400 hover:text-slate-900"
                  )}
                  title={showNotes ? "Masquer les notes" : "Afficher les notes"}
                >
                  <FileText className="w-4 h-4" />
                </button>
                <div className="w-px h-3 sm:h-4 bg-slate-200" />
                <button 
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className={cn(
                    "p-1 sm:p-1.5 rounded-md transition-all",
                    isAdminOpen ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900"
                  )}
                  title="Paramètres"
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="w-px h-3 sm:h-4 bg-slate-200" />
                <button 
                  onClick={() => { setSelectedPresentation(null); setIsAdminOpen(false); }}
                  className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-0.5 text-red-500 hover:bg-red-50 rounded-md transition-all font-medium text-[9px] sm:text-xs"
                  title="Quitter"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 h-4" />
                  <span className="hidden md:inline">Quitter</span>
                </button>
              </div>
            )}
            
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                  {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 transition-all"
                  title="Déconnexion"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Header / Progress bar */}
        {selectedPresentation && slides.length > 0 && (
          <div className="fixed top-0 left-0 w-full h-[2px] sm:h-1 z-[110] bg-slate-200 overflow-hidden">
            <motion.div 
              className="h-full bg-brand-accent shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>
        )}

        {/* Main Content */}
        <main className="relative flex-1 flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-medium text-sm">Chargement...</p>
            </div>
          ) : !user ? (
            <div className="w-full h-full overflow-y-auto">
              <Login onLogin={setUser} />
            </div>
          ) : !selectedPresentation ? (
            <Dashboard user={user} onSelectPresentation={(pres) => {
              setSelectedPresentation(pres);
              setPresentationStartTime(Date.now());
              setElapsedSeconds(0);
              setCurrentSlide(0);
            }} />
          ) : isAdminOpen ? (
            <div className="w-full h-full overflow-y-auto bg-white/50 backdrop-blur-md">
              <AdminPanel 
                user={user}
                onLogout={handleLogout}
                presentationId={selectedPresentation.id} 
                onUpdatePresentation={(updatedData) => setSelectedPresentation(prev => prev ? ({ ...prev, ...updatedData }) : null)}
              />
            </div>
          ) : (
            <div className="relative w-full h-full">
              <AnimatePresence mode="wait" custom={direction}>
                {slides.length > 0 && slides[currentSlide] ? (
                  <Slide 
                    key={slides[currentSlide].id || currentSlide}
                    slide={slides[currentSlide]} 
                    index={currentSlide} 
                    total={slides.length} 
                    direction={direction}
                    isAdmin={user?.role === 'admin'}
                    showNotes={showNotes}
                    showExplanation={showExplanation}
                    theme={currentTheme}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center p-8 text-center bg-white/40 backdrop-blur-sm">
                    <div className="max-w-md">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Aucune diapositive</h2>
                      <p className="text-slate-500 mb-8 text-sm sm:text-base px-6">Cette présentation est vide. Utilisez le panneau d'administration pour ajouter du contenu.</p>
                      <button 
                        onClick={() => setIsAdminOpen(true)}
                        className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                      >
                        Ouvrir l'administration
                      </button>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>

        {/* Laser Pointer Overlay */}
        <AnimatePresence>
          {isLaserEnabled && (
            <motion.div 
              style={{ left: laserPosition.x, top: laserPosition.y }}
              className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] relative">
                <div className="absolute inset-0 animate-ping bg-red-400 rounded-full opacity-50" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Slide Preview (Expert Tool) */}
        {!isAdminOpen && selectedPresentation && currentSlide < slides.length - 1 && (
          <div className="fixed bottom-24 right-8 z-40 hidden lg:block">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/40 backdrop-blur-xl border border-white/40 p-3 rounded-2xl shadow-2xl w-48 group hover:w-64 transition-all duration-500"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Suivant</p>
              <div 
                className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
                onClick={nextSlide}
              >
                {slides[currentSlide + 1]?.image ? (
                  <OptimizedImage src={slides[currentSlide + 1].image} className="w-full h-full object-cover" alt="" aspectRatio="auto" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50">
                    <Layers className="w-6 h-6 text-slate-200" />
                  </div>
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-900 mt-2 truncate">{slides[currentSlide + 1]?.title}</p>
            </motion.div>
          </div>
        )}

        <TableOfContents 
          isOpen={isTOCOpen}
          onClose={() => setIsTOCOpen(false)}
          slides={slides}
          currentSlide={currentSlide}
          onSelectSlide={(index) => {
            setCurrentSlide(index);
          }}
        />

        <HelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />

        {/* Hidden Export Renderer */}
        {isExporting && exportIndex >= 0 && exportIndex < slides.length && (
          <div className="fixed -top-[4000px] -left-[4000px] pointer-events-none">
            <div 
              ref={exportRef}
              className="w-[1280px] h-[720px] relative flex items-center justify-center p-20 gap-16 overflow-hidden"
              style={{ 
                fontFamily: 'Inter, sans-serif',
                backgroundColor: slides[exportIndex].bgColor || '#F8FAFC'
              }}
            >
              <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-primary/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-secondary/10 blur-[120px]" />
              </div>

              <div className={cn(
                "relative z-10 flex-1 flex flex-col justify-center w-full",
                slides[exportIndex].image || slides[exportIndex].isPlayground ? "text-left" : "text-center items-center"
              )}>
                <span className="text-brand-primary font-display font-semibold tracking-wider uppercase text-lg mb-6">
                  Diapositive {exportIndex + 1} / {slides.length}
                </span>
                
                <h1 className="text-6xl font-display font-bold text-slate-900 mb-10 leading-tight">
                  {slides[exportIndex].title}
                </h1>

                <div className="text-2xl text-slate-700 leading-relaxed presentation-rich-content">
                  {slides[exportIndex].isPlayground ? (
                   <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-2xl w-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400" />
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                      </div>
                      <pre className="text-sm font-mono text-slate-700 leading-relaxed overflow-hidden">
                        <code>{slides[exportIndex].initialCode}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="markdown-body prose prose-slate max-w-none prose-p:text-slate-700">
                      <ReactMarkdown 
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
                        }}
                      >
                        {String(slides[exportIndex].content)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              {slides[exportIndex].image && (
                <div className="flex-1 w-full flex items-center justify-center">
                  <div className="relative w-full max-w-lg shadow-2xl border-8 border-white bg-slate-200 rounded-3xl overflow-hidden">
                    <OptimizedImage 
                      src={slides[exportIndex].image} 
                      alt="" 
                      className="w-full h-full"
                      aspectRatio="auto"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isExporting && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center">
            <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full mx-4">
              <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Exportation PPTX...</h3>
              <p className="text-slate-500 mb-6 font-medium">
                Génération de la vue {exportIndex + 1} / {slides.length}
              </p>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${((exportIndex + 1) / slides.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Controls */}
        {!isAdminOpen && selectedPresentation && (
          <div className="relative z-10 w-full p-2 sm:p-4 sm:px-8 sm:pb-8 sm:pt-4 flex flex-col items-center gap-2 sm:gap-6">
            {/* Interactive Progress Bar */}
            <div className="w-full max-w-5xl group/progress px-2">
              <div className="flex items-center justify-between mb-1 sm:mb-2 px-1">
                <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Progression
                </span>
                <span className={cn("text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full", currentTheme.isCustom ? "" : "text-brand-primary bg-brand-primary/10")} style={currentTheme.isCustom ? { backgroundColor: currentTheme.primary + '22', color: currentTheme.primary } : {}}>
                  {Math.round(((currentSlide + 1) / slides.length) * 100)}%
                </span>
              </div>
              <div className="relative h-1 sm:h-2 w-full flex gap-0.5 sm:gap-1 items-end">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      "group relative flex-1 h-1 sm:h-1.5 rounded-full transition-all duration-300 overflow-visible",
                      i <= currentSlide 
                        ? (currentTheme.isCustom ? "" : "bg-brand-primary h-1.5 sm:h-2 shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.3)]")
                        : "bg-slate-200 hover:bg-slate-300"
                    )}
                    style={currentTheme.isCustom && i <= currentSlide ? { backgroundColor: currentTheme.primary, height: window.innerWidth < 640 ? '6px' : '8px' } : {}}
                    title={`Aller à la diapositive ${i + 1}`}
                  >
                    {/* Tooltip on hover */}
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      Slide {i + 1}
                    </span>
                    
                    {/* Active Indicator Pulse */}
                    {currentSlide === i && (
                      <span className="absolute inset-0 rounded-full bg-brand-primary animate-ping opacity-20" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 relative scale-90 sm:scale-100">
              <button 
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-2 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-full text-slate-500 hover:text-slate-900 hover:bg-white transition-all shadow-sm group"
                title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider hidden sm:inline">
                  {isFullscreen ? "Réduire" : "Plein écran"}
                </span>
              </button>

              {slides[currentSlide]?.explanation && (
                <button 
                  onClick={() => setShowExplanation(!showExplanation)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-2 backdrop-blur-sm border rounded-full transition-all shadow-sm group",
                    showExplanation ? "bg-brand-primary text-white border-brand-primary" : "bg-white/70 border-slate-200 text-slate-500 hover:bg-white hover:text-slate-900"
                  )}
                  title={showExplanation ? "Cacher l'explication" : "Afficher l'explication"}
                >
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider hidden sm:inline">
                    Info
                  </span>
                </button>
              )}

              <button 
                onClick={prevSlide}
                className="p-2.5 sm:p-4 rounded-full glass border border-slate-200 hover:border-brand-primary hover:bg-white transition-all hover:scale-110 active:scale-95 group shadow-sm bg-white/50"
                aria-label="Précédent"
              >
                <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6 text-slate-400 group-hover:text-brand-primary group-hover:-translate-x-0.5 transition-all" />
              </button>
              
              <div className="flex items-center justify-center min-w-[60px] sm:min-w-[80px]">
                <span className="text-xs sm:text-sm font-display font-bold text-slate-900 bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-brand-primary">{currentSlide + 1}</span>
                  <span className="text-slate-300 mx-1 sm:mx-2">/</span>
                  <span className="text-slate-500">{slides.length}</span>
                </span>
              </div>

              <button 
                onClick={() => setIsLaserEnabled(!isLaserEnabled)}
                className={cn(
                  "p-2.5 sm:p-4 rounded-full border transition-all hover:scale-110 active:scale-95 group shadow-sm",
                  isLaserEnabled 
                    ? "bg-red-500 border-red-600 text-white" 
                    : "bg-white/50 border-slate-200 text-slate-400 hover:text-brand-primary"
                )}
                aria-label="Laser Pointer (L)"
                title="Laser Pointer (L)"
              >
                <Zap className={cn("w-4 h-4 sm:w-6 sm:h-6", isLaserEnabled && "animate-pulse")} />
              </button>

              <button 
                onClick={nextSlide}
                className={cn("p-2.5 sm:p-4 rounded-full text-white shadow-xl hover:bg-opacity-90 transition-all hover:scale-110 active:scale-95 group border-2 border-transparent hover:border-white/20", currentTheme.isCustom ? "" : "bg-slate-900 hover:bg-brand-primary")}
                style={currentTheme.isCustom ? { backgroundColor: currentTheme.primary } : {}}
                aria-label="Suivant"
              >
                <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
