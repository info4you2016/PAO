import React, { useState, useEffect, useCallback } from 'react';
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
  List
} from 'lucide-react';
import { cn } from './lib/utils';
import { toPng } from 'html-to-image';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { TableOfContents } from './components/TableOfContents';
import { CodePlayground } from './components/CodePlayground';
import { exportPresentationToPPTX } from './services/exportService';

interface SlideData {
  id?: string;
  order: number;
  title: string;
  content: React.ReactNode | string;
  image?: string;
  bgColor?: string;
  isPlayground?: boolean;
  initialCode?: string;
}

interface PresentationData {
  id: string;
  title: string;
  description?: string;
  course?: string;
  owner_id: string;
}

// --- Components ---

const CodeBlock = ({ code }: { code: string; key?: React.Key }) => (
  <pre className="code-block my-4 max-w-full overflow-x-auto whitespace-pre">
    <code className="block min-w-max">{code}</code>
  </pre>
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

const Slide = ({ slide, index, total, direction }: { slide: SlideData; index: number; total: number; direction: number; key?: React.Key }) => {
  const renderContent = () => {
    if (slide.isPlayground) {
      return (
        <div className="mt-8 w-full">
          <CodePlayground 
            initialCode={slide.initialCode || "// Écrivez votre code ici"} 
            title={slide.title}
            description="Bac à sable interactif"
          />
        </div>
      );
    }

    if (typeof slide.content === 'string') {
      // Simple check for code blocks in string content
      if (slide.content.includes('```')) {
        const parts = slide.content.split('```');
        return parts.map((part, i) => i % 2 === 1 ? <CodeBlock key={i} code={part.trim()} /> : <p key={i} className="mb-4">{part}</p>);
      }
      return <div dangerouslySetInnerHTML={{ __html: slide.content }} />;
    }
    return slide.content;
  };

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.4 }
      }}
      className={cn(
        "relative w-full h-full flex flex-col lg:flex-row items-center justify-center p-4 sm:p-8 md:p-12 lg:p-16 gap-6 md:gap-12 overflow-y-auto transition-colors duration-500",
        slide.bgColor ? "" : "bg-white/40"
      )}
      style={{ backgroundColor: slide.bgColor || undefined }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-secondary/10 blur-[120px]" />
      </div>

      <div className={cn(
        "relative z-10 flex-1 flex flex-col justify-center w-full max-w-5xl transition-all duration-500",
        slide.image || slide.isPlayground ? "text-left" : "text-center items-center"
      )}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3 mb-6 sm:mb-8"
        >
          <div className="h-px w-8 sm:w-12 bg-slate-200" />
          <span className="text-slate-400 font-display font-bold tracking-[0.2em] uppercase text-[10px] sm:text-xs">
            Section {index + 1}
          </span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-slate-900 mb-6 md:mb-10 leading-[1.1] tracking-tight"
        >
          {slide.title}
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg sm:text-xl md:text-2xl text-slate-600 leading-relaxed font-sans font-normal presentation-rich-content w-full"
        >
          {renderContent()}
        </motion.div>
      </div>

      {slide.image && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
          className="flex-1 hidden lg:block w-full perspective-1000"
        >
          <div className="relative group">
            <div className="absolute -inset-4 bg-brand-primary/10 rounded-3xl blur-2xl group-hover:bg-brand-primary/20 transition-all duration-500" />
            <img 
              src={slide.image} 
              alt={slide.title}
              referrerPolicy="no-referrer"
              className="relative rounded-2xl shadow-2xl object-cover aspect-[4/3] w-full border-4 border-white"
            />
          </div>
        </motion.div>
      )}
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
  const exportRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
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
        initialCode: s.initial_code
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden font-sans">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-primary rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-24 w-64 h-64 bg-brand-secondary rounded-full blur-3xl" />
        </div>        {/* Header / Progress */}
        <div className="relative z-20 w-full px-6 py-4 flex items-center justify-between bg-white/40 backdrop-blur-md border-b border-slate-100">
          <div 
            className="flex items-center gap-4 cursor-pointer group" 
            onClick={() => { setSelectedPresentation(null); setIsAdminOpen(false); }}
          >
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center group-hover:bg-brand-accent transition-all shadow-lg shadow-slate-900/10 active:scale-95">
              <Layers className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h2 className="font-display font-bold text-slate-900 text-lg tracking-tight group-hover:text-brand-accent transition-colors leading-none mb-1">
                {selectedPresentation ? selectedPresentation.title : "Plateforme Pédagogique"}
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                  {selectedPresentation ? "Mode Présentation" : "Tableau de Bord"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedPresentation && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                <button 
                  onClick={() => setIsTOCOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 transition-all"
                  title="Sommaire"
                >
                  <List className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <button 
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    isAdminOpen ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900"
                  )}
                  title="Paramètres"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <button 
                  onClick={exportToPPTX}
                  className="p-1.5 text-slate-400 hover:text-slate-900 transition-all"
                  title="Exporter"
                >
                  <Download className="w-4 h-4" />
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

        {/* Main Content */}
        <main className="relative flex-1 flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">Chargement...</p>
            </div>
          ) : !user ? (
            <div className="w-full h-full overflow-y-auto">
              <Login onLogin={setUser} />
            </div>
          ) : !selectedPresentation ? (
            <Dashboard user={user} onSelectPresentation={setSelectedPresentation} />
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
            <AnimatePresence mode="wait" custom={direction}>
              {slides.length > 0 && slides[currentSlide] ? (
                <Slide 
                  key={slides[currentSlide].id || currentSlide}
                  slide={slides[currentSlide]} 
                  index={currentSlide} 
                  total={slides.length} 
                  direction={direction}
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Layers className="w-10 h-10 text-slate-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucune diapositive</h2>
                  <p className="text-slate-500 mb-8">Cette présentation est vide. Utilisez le panneau d'administration pour ajouter du contenu.</p>
                  <button 
                    onClick={() => setIsAdminOpen(true)}
                    className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all"
                  >
                    Ouvrir l'administration
                  </button>
                </div>
              )}
            </AnimatePresence>
          )}
        </main>

        <TableOfContents 
          isOpen={isTOCOpen}
          onClose={() => setIsTOCOpen(false)}
          slides={slides}
          currentSlide={currentSlide}
          onSelectSlide={(index) => {
            setCurrentSlide(index);
          }}
        />

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

                <div className="text-2xl text-slate-700 leading-relaxed">
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
                    <div dangerouslySetInnerHTML={{ __html: String(slides[exportIndex].content) }} />
                  )}
                </div>
              </div>

              {slides[exportIndex].image && (
                <div className="flex-1 w-full flex items-center justify-center">
                  <div className="relative w-full max-w-lg aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-8 border-white bg-slate-200">
                    <img 
                      src={slides[exportIndex].image} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
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
          <div className="relative z-10 w-full p-4 sm:p-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-4 sm:gap-6 order-2 sm:order-1">
              <button 
                onClick={prevSlide}
                className="p-3 sm:p-4 rounded-full glass border border-slate-200 hover:border-brand-primary hover:bg-white transition-all hover:scale-110 active:scale-95 group shadow-sm bg-white/50"
                aria-label="Précédent"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 group-hover:text-brand-primary group-hover:-translate-x-0.5 transition-all" />
              </button>
              
              <div className="flex gap-1.5 sm:gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      "w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300",
                      currentSlide === i ? "bg-brand-primary w-4 sm:w-8" : "bg-slate-300 hover:bg-slate-400"
                    )}
                  />
                ))}
              </div>

              <button 
                onClick={nextSlide}
                className="p-3 sm:p-4 rounded-full bg-slate-900 text-white shadow-xl hover:bg-brand-primary transition-all hover:scale-110 active:scale-95 group border-2 border-transparent hover:border-white/20"
                aria-label="Suivant"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <div className="sm:hidden order-1 w-full flex justify-center">
               <div className="h-1 w-full max-w-[200px] bg-slate-200 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-primary"
                  initial={{ width: 0 }}
                  animate={{ width: slides.length > 0 ? `${((currentSlide + 1) / slides.length) * 100}%` : 0 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
