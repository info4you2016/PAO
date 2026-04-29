import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { collection, onSnapshot, query, orderBy, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Code2, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb, 
  BookOpen, 
  Clock, 
  User,
  Layers,
  Star,
  HelpCircle,
  Zap,
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
import { INITIAL_SLIDES } from './constants';
import { Dashboard } from './components/Dashboard';
import { TableOfContents } from './components/TableOfContents';
import { CodePlayground } from './components/CodePlayground';
import { exportPresentationToPPTX } from './services/exportService';

// --- Types ---

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
  ownerId: string;
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
        "relative z-10 flex-1 flex flex-col justify-center w-full max-w-4xl",
        slide.image || slide.isPlayground ? "text-left" : "text-center items-center"
      )}>
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-brand-primary font-display font-semibold tracking-wider uppercase text-xs sm:text-sm mb-2 md:mb-4"
        >
          Diapositive {index + 1} / {total}
        </motion.span>
        
        <motion.h1 
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-4 md:mb-8 leading-tight"
        >
          {slide.title}
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm sm:text-base md:text-lg text-slate-700 leading-relaxed w-full presentation-rich-content"
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
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync user profile
        try {
          const userDoc = doc(db, 'users', u.uid);
          const snap = await getDoc(userDoc);
          if (!snap.exists()) {
            await setDoc(userDoc, {
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              role: 'user',
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error syncing user profile:", error);
        }
      } else {
        setSelectedPresentation(null);
        setIsAdminOpen(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedPresentation) {
      setSlides([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(collection(db, 'presentations', selectedPresentation.id, 'slides'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty && selectedPresentation.ownerId === user?.uid) {
        // We don't auto-seed anymore, let the user do it in admin panel
        setSlides([]);
        setIsLoading(false);
      } else {
        const slidesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlideData));
        setSlides(slidesData);
        setIsLoading(false);
      }
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'slides');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
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
          await new Promise(r => setTimeout(r, 600)); // Un peu plus de temps pour App.tsx
          if (!exportRef.current) return;
          const dataUrl = await toPng(exportRef.current, {
            width: 1280,
            height: 720,
            cacheBust: true,
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
        </div>

        {/* Header / Progress */}
        <div className="relative z-10 w-full p-4 sm:p-6 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group" 
            onClick={() => { setSelectedPresentation(null); setIsAdminOpen(false); }}
            title="Retour au tableau de bord"
          >
            <div className="p-1.5 sm:p-2 bg-slate-900 text-white rounded-lg sm:rounded-xl group-hover:bg-brand-primary transition-colors">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-900 text-sm sm:text-base group-hover:text-brand-primary transition-colors">
                {selectedPresentation ? selectedPresentation.title : "Mes Présentations"}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-widest">
                {selectedPresentation ? "Mode Présentation" : "Tableau de Bord"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {selectedPresentation && (
              <>
                <button 
                  onClick={() => setIsTOCOpen(true)}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-brand-primary hover:border-brand-primary transition-all shadow-sm active:scale-95"
                  title="Sommaire"
                >
                  <List className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className={cn(
                    "p-2 rounded-lg transition-all active:scale-95",
                    isAdminOpen ? "bg-brand-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:text-brand-primary"
                  )}
                  title={isAdminOpen ? "Fermer l'administration" : "Paramètres de la présentation"}
                >
                  {isAdminOpen ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                </button>

                <button 
                  onClick={() => { setSelectedPresentation(null); setIsAdminOpen(false); }}
                  className="p-2 rounded-lg bg-white border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm active:scale-95 group"
                  title="Quitter la présentation"
                >
                  <LogOut className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <button 
                  onClick={exportToPPTX}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-brand-primary hover:border-brand-primary transition-all text-sm font-medium shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>PPTX</span>
                </button>

                <div className="hidden sm:flex h-1.5 w-32 md:w-48 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-brand-primary"
                    initial={{ width: 0 }}
                    animate={{ width: slides.length > 0 ? `${((currentSlide + 1) / slides.length) * 100}%` : 0 }}
                  />
                </div>
                <span className="text-[10px] sm:text-sm font-mono font-bold text-slate-400">
                  {slides.length > 0 ? String(currentSlide + 1).padStart(2, '0') : '00'} / {slides.length}
                </span>
              </>
            )}
            
            {!user && (
              <button 
                onClick={() => setIsAdminOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
              >
                Connexion
              </button>
            )}
            
            {user && !selectedPresentation && (
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-slate-400 hover:text-red-600 transition-all"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
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
              <AdminPanel />
            </div>
          ) : !selectedPresentation ? (
            <Dashboard onSelectPresentation={setSelectedPresentation} />
          ) : isAdminOpen ? (
            <div className="w-full h-full overflow-y-auto bg-white/50 backdrop-blur-md">
              <AdminPanel 
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
                   <div className="p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl w-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400" />
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                      </div>
                      <pre className="text-sm font-mono text-blue-300 leading-relaxed overflow-hidden">
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
