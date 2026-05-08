import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Play, BookOpen, Clock, Layers, X, Sparkles, MessageSquare, Wand2, Download, Loader2, AlertCircle, Settings, ChevronRight, Check, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { generatePresentationFromText } from '../services/aiService';
import { toPng } from 'html-to-image';
import { exportPresentationToPPTX } from '../services/exportService';
import { api } from '../lib/api';
import { PRESENTATION_THEMES } from '../constants';
import { authHelpers } from '../firebase';
import { Theme, PresentationData, CustomTheme } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { CodeBlock } from './CodeBlock';
import { MarkdownEditor } from './MarkdownEditor';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';

// Rehype plugin to filter out invalid attribute names that cause React 19 to crash
const rehypeFilterInvalidAttributes = () => {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.properties) {
        Object.keys(node.properties).forEach(key => {
          if (/^[0-9]/.test(key) || key.includes('"')) {
            delete node.properties[key];
          }
        });
      }
    });
  };
};

interface DashboardProps {
  user: any;
  onSelectPresentation: (presentation: PresentationData) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onSelectPresentation }) => {
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportSlides, setExportSlides] = useState<any[]>([]);
  const [exportIndex, setExportIndex] = useState(-1);
  const [exportPresentation, setExportPresentation] = useState<PresentationData | null>(null);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [newPresentation, setNewPresentation] = useState({ title: '', description: '', course: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSlideCount, setAiSlideCount] = useState(8);
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [aiAudience, setAiAudience] = useState('Général');
  const [aiTone, setAiTone] = useState('Professionnel');
  const [aiArc, setAiArc] = useState('Classique');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  useEffect(() => {
    const loadThemes = async (retries = 3) => {
      try {
        const themes = await api.themes.getAll();
        setCustomThemes(themes);
      } catch (error) {
        if (retries > 0) {
          console.warn(`Retrying themes load... (${retries} retries left)`);
          setTimeout(() => loadThemes(retries - 1), 2000);
        } else {
          console.error("Error loading themes after retries", error);
        }
      }
    };
    loadThemes();
    const unsub = authHelpers.onAuthStateChanged(() => {
      loadThemes();
    });
    return () => unsub();
  }, []);

  const resolveTheme = (themeId?: string): Theme => {
    if (!themeId) return PRESENTATION_THEMES[0] as Theme;
    
    if (themeId.startsWith('custom:')) {
      const customId = themeId.replace('custom:', '');
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
    
    return (PRESENTATION_THEMES.find(t => t.id === themeId) || PRESENTATION_THEMES[0]) as Theme;
  };

  const courses = Array.from(new Set(presentations.map(p => p.course || "Sans cours"))).sort();

  const suggestedTopics = [
    { text: "Introduction à React 19", icon: <Layers className="w-4 h-4" /> },
    { text: "Les bases du Machine Learning", icon: <Sparkles className="w-4 h-4" /> },
    { text: "Histoire de l'Art Moderne", icon: <Wand2 className="w-4 h-4" /> },
    { text: "Management et Leadership", icon: <BookOpen className="w-4 h-4" /> }
  ];

  const stats = [
    { label: "Présentations", value: presentations.length, icon: <Layers className="w-5 h-5" /> },
    { label: "Cours", value: courses.length, icon: <BookOpen className="w-5 h-5" /> },
    { label: "Diapositives", value: presentations.reduce((acc, p) => acc + (p as any).slide_count || 0, 0), icon: <Clock className="w-5 h-5" /> }
  ];

  const filteredPresentations = selectedCourse 
    ? presentations.filter(p => (p.course || "Sans cours") === selectedCourse)
    : presentations;

  const loadPresentations = async (userId: string) => {
    try {
      setIsLoading(true);
      const data = await api.presentations.getAll(userId);
      setPresentations(data || []);
    } catch (err: any) {
      console.error("Error loading presentations:", err);
      setError("Erreur lors du chargement des présentations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPresentations(user.id);
    }
  }, [user]);

  const handleExport = async (presentation: PresentationData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExporting) return;
    
    setIsExporting(presentation.id);
    setExportPresentation(presentation);
    setSnapshots([]);
    try {
      const slidesData = await api.presentations.getSlides(presentation.id);
      
      if (!slidesData || slidesData.length === 0) {
        setIsExporting(null);
        return;
      }

      setExportSlides(slidesData.map((s: any) => ({
        ...s,
        image: s.image_url,
        bgColor: s.bg_color,
        order: s.slide_order,
        isPlayground: Boolean(s.is_playground),
        initialCode: s.initial_code
      })));
      setExportIndex(0);
    } catch (err: any) {
      console.error("Export error:", err);
      setError("Erreur lors de la préparation de l'exportation.");
      setIsExporting(null);
    }
  };

  useEffect(() => {
    if (exportIndex >= 0 && exportIndex < exportSlides.length && exportRef.current && isExporting) {
      const capture = async () => {
        try {
          await new Promise(r => setTimeout(r, 500));
          if (!exportRef.current) return;
          const dataUrl = await toPng(exportRef.current, {
            width: 1280,
            height: 720,
            cacheBust: true,
          });
          setSnapshots(prev => [...prev, dataUrl]);
          setExportIndex(prev => prev + 1);
        } catch (err) {
          console.error("Export capture error:", err);
          setExportIndex(prev => prev + 1);
        }
      };
      capture();
    } else if (exportIndex >= exportSlides.length && exportSlides.length > 0 && exportPresentation) {
      exportPresentationToPPTX(exportPresentation as any, exportSlides, snapshots);
      setIsExporting(null);
      setExportIndex(-1);
      setExportSlides([]);
      setExportPresentation(null);
    }
  }, [exportIndex, exportSlides, isExporting, exportPresentation, snapshots.length]);

  const createPresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newPresentation.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      await api.presentations.create({
        id,
        title: newPresentation.title.trim(),
        description: newPresentation.description.trim(),
        course: newPresentation.course.trim() || null,
        ownerId: user.id
      });
      setIsCreating(false);
      setNewPresentation({ title: '', description: '', course: '' });
      loadPresentations(user.id);
    } catch (err: any) {
      console.error("Error creating presentation:", err);
      setError("Erreur lors de la création.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!aiPrompt.trim()) {
      setError("Veuillez saisir un sujet.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const generated = await generatePresentationFromText(aiPrompt, aiSlideCount, {
        audience: aiAudience,
        tone: aiTone,
        arc: aiArc
      });
      const presentationId = crypto.randomUUID();

      await api.presentations.create({
        id: presentationId,
        title: generated.title,
        description: generated.description,
        ownerId: user.id
      });

      const slides = generated.slides.map((s: any, i: number) => ({
        ...s,
        id: crypto.randomUUID(),
        order: i
      }));

      await api.presentations.batchAddSlides(presentationId, slides);

      setIsAIGenerating(false);
      setAiPrompt('');
      loadPresentations(user.id);
    } catch (err: any) {
      console.error("AI Generation error:", err);
      setError(err.message || "Échec de la génération par l'IA.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePresentation = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      // Reset confirmation after 3 seconds if not clicked
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    if (!user) {
      setError("Vous devez être connecté pour supprimer une présentation.");
      return;
    }

    try {
      setError(null);
      await api.presentations.delete(id);
      setConfirmDeleteId(null);
      await loadPresentations(user.id);
    } catch (err: any) {
      console.error("Delete error client-side:", err);
      setError(`Erreur lors de la suppression : ${err.message || "Erreur inconnue"}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 w-full h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-4 sm:gap-6">
        <div>
          <h1 className="text-[clamp(1.25rem,4vw,2.5rem)] font-display font-black text-slate-900 tracking-tight mb-1 sm:mb-2 leading-none">Vos Formations</h1>
          <p className="text-slate-400 font-medium text-[clamp(0.875rem,2vw,1.125rem)] text-balance">Gérez vos supports pédagogiques interactifs</p>
        </div>
        <div className="flex grid grid-cols-2 sm:flex items-center gap-3">
          <button 
            onClick={() => { setIsAIGenerating(true); setError(null); }}
            className="flex items-center justify-center gap-2 px-3 sm:px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95 group"
          >
            <Sparkles className="w-4 h-4 text-brand-accent group-hover:animate-pulse" />
            <span className="text-xs sm:text-sm">IA</span>
          </button>
          <button 
            onClick={() => { setIsCreating(true); setError(null); }}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-[0_8px_16px_rgba(15,23,42,0.15)] active:scale-95"
          >
            <Plus className="w-4 h-4 sm:w-5 h-5" />
            <span className="text-xs sm:text-sm text-nowrap">Nouveau</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-10 sm:mb-16">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn(
              "p-4 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center gap-3 sm:gap-6 group hover:shadow-xl hover:border-brand-primary/10 transition-all duration-500",
              idx === 2 ? "col-span-2 md:col-span-1" : ""
            )}
          >
            <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-50 text-slate-400 rounded-xl sm:rounded-3xl flex items-center justify-center group-hover:bg-brand-accent/10 group-hover:text-brand-accent transition-all duration-500 shrink-0">
              {React.cloneElement(stat.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5 sm:w-7 sm:h-7" })}
            </div>
            <div>
              <p className="text-lg sm:text-3xl font-black text-slate-900 leading-none mb-1">{stat.value}</p>
              <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {courses.length > 0 && (
        <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 mb-10 sm:mb-14 overflow-x-auto pb-4 sm:pb-0 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setSelectedCourse(null)}
            className={cn(
              "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shrink-0",
              selectedCourse === null 
                ? "bg-slate-900 text-white shadow-lg scale-105" 
                : "bg-white text-slate-400 border border-slate-100 hover:border-slate-200"
            )}
          >
            Tous les fichiers
          </button>
          {courses.map(course => (
            <button
              key={course}
              onClick={() => setSelectedCourse(course)}
              className={cn(
                "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shrink-0",
                selectedCourse === course
                  ? "bg-brand-primary text-white shadow-lg scale-105"
                  : "bg-white text-slate-400 border border-slate-100 hover:border-slate-200"
              )}
            >
              {course}
            </button>
          ))}
        </div>
      )}

      {selectedCourse && (
        <div className="mb-6 flex items-center gap-2">
          <div className="h-px flex-1 bg-slate-100" />
          <span className="text-xs font-display font-bold text-slate-400 uppercase tracking-widest px-4">{selectedCourse}</span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPresentations.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6 }}
            onClick={() => onSelectPresentation(p)}
            className="card-minimal group cursor-pointer overflow-hidden flex flex-col h-full"
          >
            <div className="h-40 bg-slate-50 relative overflow-hidden transition-colors duration-500">
              {p.thumbnail_url ? (
                <OptimizedImage 
                  src={p.thumbnail_url} 
                  alt={p.title}
                  className="w-full h-full"
                  aspectRatio="auto"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-brand-primary/5 text-brand-primary/40 group-hover:bg-brand-primary/10 transition-colors">
                  <Layers className="relative z-10 w-12 h-12 text-slate-300 group-hover:text-brand-accent group-hover:scale-110 transition-all duration-500" />
                </div>
              )}
              <div className="absolute top-4 right-4 z-10 flex gap-1">
                {p.theme && (
                  <div 
                    className={cn(
                      "w-4 h-4 rounded-full border-2 border-white shadow-sm",
                      resolveTheme(p.theme).isCustom ? "" : resolveTheme(p.theme).primary
                    )}
                    style={resolveTheme(p.theme).isCustom ? { backgroundColor: resolveTheme(p.theme).primary } : {}}
                    title={`Thème: ${resolveTheme(p.theme).name}`}
                  />
                )}
              </div>
              <div className="absolute bottom-4 left-4 z-10">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-slate-600 rounded-lg uppercase tracking-wider shadow-sm border border-slate-100">
                  {p.course || "Sans cours"}
                </span>
              </div>
            </div>
            <div className="p-5 sm:p-8 flex-1 flex flex-col">
              <h3 className="text-base sm:text-xl font-display font-bold text-slate-900 mb-1 sm:mb-2 truncate group-hover:text-brand-accent transition-colors">{p.title}</h3>
              {p.description ? (
                <div className="text-slate-500 text-[10px] sm:text-sm mb-3 sm:mb-6 line-clamp-2 leading-relaxed presentation-rich-content prose prose-slate max-w-none">
                  <ReactMarkdown 
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
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
                    {p.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-slate-400 text-xs mb-6 line-clamp-2 italic">Aucune description.</p>
              )}
              
              <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : "Récent"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={(e) => handleExport(p, e)}
                    className="p-2 text-slate-400 hover:text-brand-accent hover:bg-slate-50 rounded-lg transition-all"
                    title="Exporter en PPTX"
                    disabled={isExporting === p.id}
                  >
                    {isExporting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={(e) => deletePresentation(p.id, e)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-bold text-[10px] uppercase tracking-wider",
                      confirmDeleteId === p.id 
                        ? "bg-red-500 text-white shadow-lg animate-pulse" 
                        : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                    )}
                    title={confirmDeleteId === p.id ? "Confirmer la suppression" : "Supprimer"}
                  >
                    {confirmDeleteId === p.id ? (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Confirmer ?</span>
                      </>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="ml-2 w-10 h-10 bg-slate-900 group-hover:bg-brand-accent text-white rounded-xl flex items-center justify-center shadow-sm transition-all group-hover:scale-105 active:scale-95">
                    <Play className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {presentations.length === 0 && !isCreating && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucune présentation</h3>
            <p className="text-slate-500 mb-6">Commencez par créer votre première présentation.</p>
            <button 
              onClick={() => { setIsCreating(true); setError(null); }}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Créer maintenant
            </button>
          </div>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <form onSubmit={createPresentation} className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">Nouvelle Présentation</h3>
                <button type="button" onClick={() => { setIsCreating(false); setError(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                  <X className="w-4 h-4 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Titre</label>
                  <input 
                    required
                    type="text" 
                    disabled={isSubmitting}
                    placeholder="Ex: Ma Super Présentation"
                    value={newPresentation.title} 
                    onChange={e => setNewPresentation({ ...newPresentation, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Cours / Catégorie</label>
                  <input 
                    type="text" 
                    disabled={isSubmitting}
                    placeholder="Ex: Programmation 101"
                    value={newPresentation.course} 
                    onChange={e => setNewPresentation({ ...newPresentation, course: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <MarkdownEditor 
                    value={newPresentation.description}
                    onChange={value => setNewPresentation({ ...newPresentation, description: value })}
                    placeholder="De quoi parle cette présentation ?"
                    rows={4}
                    label="new-presentation-description"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => { setIsCreating(false); setError(null); }} 
                  className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Création...</span>
                    </>
                  ) : (
                    "Créer"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isAIGenerating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-white/20"
          >
            <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 bg-brand-primary/10 rounded-xl">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                    {generationStep === 1 ? "Sujet de formation" : generationStep === 2 ? "Style & Impact" : "Prêt à créer"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {[1, 2, 3].map(step => (
                      <div 
                        key={step} 
                        className={cn(
                          "h-1 rounded-full transition-all duration-500",
                          step === generationStep ? "w-6 bg-brand-primary" : "w-2 bg-slate-100"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsAIGenerating(false); setGenerationStep(1); setError(null); }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 scrollbar-hide">
              <AnimatePresence mode="wait">
                {generationStep === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="p-4 sm:p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-3 sm:gap-4">
                      <MessageSquare className="w-5 h-5 text-slate-300 mt-1 shrink-0" />
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                        Décrivez votre sujet de formation. Notre IA structurera le contenu et sélectionnera les visuels les plus pertinents.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Sujet de la formation</label>
                      <textarea 
                        required
                        rows={3}
                        disabled={isSubmitting}
                        placeholder="Ex: Les meilleures pratiques de cybersécurité pour le télétravail..."
                        value={aiPrompt} 
                        onChange={e => setAiPrompt(e.target.value)}
                        className="w-full px-4 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary focus:bg-white outline-none transition-all disabled:opacity-50 resize-none text-sm sm:text-base font-medium"
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block opacity-60">Sujets suggérés :</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {suggestedTopics.map((topic, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAiPrompt(topic.text)}
                            className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95 text-left group"
                          >
                            <span className="shrink-0 p-1.5 bg-white rounded-lg group-hover:bg-white/10 transition-colors">{topic.icon}</span>
                            <span className="truncate">{topic.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {generationStep === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Public Cible</label>
                        <div className="space-y-2">
                          {['Général', 'Débutants', 'Experts / PRO', 'Décideurs'].map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setAiAudience(option)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                                aiAudience === option ? "bg-brand-primary/10 border-brand-primary text-brand-primary" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                              )}
                            >
                              {option}
                              {aiAudience === option && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ton & Mood</label>
                        <div className="space-y-2">
                          {['Professionnel', 'Inspirant', 'Direct / Minimal', 'Pédagogique'].map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setAiTone(option)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                                aiTone === option ? "bg-brand-accent/10 border-brand-accent text-brand-accent" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                              )}
                            >
                              {option}
                              {aiTone === option && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Narration (Arc)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['Classique', 'Storytelling', 'Pitch', 'Technique'].map(arc => (
                          <button
                            key={arc}
                            type="button"
                            onClick={() => setAiArc(arc)}
                            className={cn(
                              "py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all border",
                              aiArc === arc ? "bg-slate-900 text-white border-slate-900 shadow-md scale-105" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {arc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {generationStep === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="text-center py-6">
                      <div className="w-20 h-20 bg-brand-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 relative">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          <Zap className="w-10 h-10 text-brand-primary fill-brand-primary/20" />
                        </motion.div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-brand-accent rounded-full border-4 border-white flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <h4 className="text-2xl font-black text-slate-900 mb-2 leading-tight">Configuration validée</h4>
                      <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">Votre formation est configurée pour un public {aiAudience.toLowerCase()} avec un ton {aiTone.toLowerCase()}.</p>
                    </div>

                    <div className="p-6 sm:p-8 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Nombre de diapositives</label>
                          <span className="text-2xl font-black text-brand-accent leading-none">{aiSlideCount}</span>
                        </div>
                        <input 
                          type="range"
                          min="3"
                          max="15"
                          value={aiSlideCount}
                          onChange={e => setAiSlideCount(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-accent mb-6"
                        />
                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                          <Layers className="w-4 h-4 text-brand-accent" />
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Arc {aiArc} activé</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="mt-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[11px] font-bold flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100 shrink-0">
              <div className="flex gap-3">
                {generationStep > 1 ? (
                  <button 
                    type="button"
                    onClick={() => setGenerationStep(prev => prev - 1)}
                    className="flex-1 py-4 rounded-2xl border border-slate-200 font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-white transition-all active:scale-95"
                  >
                    Retour
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => { setIsAIGenerating(false); setGenerationStep(1); setError(null); }} 
                    className="flex-1 py-4 rounded-2xl border border-slate-200 font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-white transition-all active:scale-95"
                  >
                    Annuler
                  </button>
                )}

                {generationStep < 3 ? (
                  <button 
                    type="button"
                    disabled={!aiPrompt}
                    onClick={() => setGenerationStep(prev => prev + 1)}
                    className="flex-[1.5] py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 group"
                  >
                    Suivant <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={generateWithAI}
                    disabled={isSubmitting}
                    className="flex-[1.5] py-4 bg-brand-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] hover:bg-brand-primary/90 transition-all shadow-[0_10px_30px_rgba(37,99,235,0.2)] flex items-center justify-center gap-3 disabled:opacity-70 active:scale-95 group"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Progression...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span>Créer la formation</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Hidden Export Renderer */}
      {isExporting && exportIndex >= 0 && exportIndex < exportSlides.length && (
        <div className="fixed -top-[3000px] -left-[3000px] pointer-events-none">
          <div 
            ref={exportRef}
            className="w-[1280px] h-[720px] relative flex items-center justify-center p-20 gap-16 overflow-hidden"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              backgroundColor: exportSlides[exportIndex].bgColor || (resolveTheme(exportPresentation?.theme).isCustom ? resolveTheme(exportPresentation.theme).slideBg : '#F8FAFC'),
              color: resolveTheme(exportPresentation?.theme).isCustom ? resolveTheme(exportPresentation.theme).text : undefined
            }}
          >
            {/* Background Decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              <div 
                className={cn("absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]", resolveTheme(exportPresentation?.theme).isCustom ? "" : resolveTheme(exportPresentation?.theme).primary)} 
                style={resolveTheme(exportPresentation?.theme).isCustom ? { backgroundColor: resolveTheme(exportPresentation?.theme).primary } : {}}
              />
              <div 
                className={cn("absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]", resolveTheme(exportPresentation?.theme).isCustom ? "" : resolveTheme(exportPresentation?.theme).secondary)} 
                style={resolveTheme(exportPresentation?.theme).isCustom ? { backgroundColor: resolveTheme(exportPresentation?.theme).secondary } : {}}
              />
            </div>

            <div className={cn(
              "relative z-10 flex-1 flex flex-col justify-center w-full",
              exportSlides[exportIndex].image || exportSlides[exportIndex].isPlayground ? "text-left" : "text-center items-center"
            )}>
              <span className="font-display font-semibold tracking-wider uppercase text-lg mb-6" style={resolveTheme(exportPresentation?.theme).isCustom ? { color: resolveTheme(exportPresentation.theme).primary } : { color: 'var(--brand-primary)' }}>
                Diapositive {exportIndex + 1} / {exportSlides.length}
              </span>
              
              <h1 className="text-6xl font-display font-bold mb-10 leading-tight" style={resolveTheme(exportPresentation?.theme).isCustom ? { color: resolveTheme(exportPresentation.theme).text } : { color: '#0F172A' }}>
                {exportSlides[exportIndex].title}
              </h1>

              <div className="text-2xl text-slate-700 leading-relaxed presentation-rich-content">
                {exportSlides[exportIndex].isPlayground ? (
                   <div className="p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl w-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                    </div>
                    <pre className="text-sm font-mono text-blue-300 leading-relaxed overflow-hidden">
                      <code>{exportSlides[exportIndex].initialCode}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-slate max-w-none">
                    <ReactMarkdown 
                      rehypePlugins={[rehypeRaw, rehypeFilterInvalidAttributes]}
                      components={{
                        p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
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
                      {exportSlides[exportIndex].content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>

            {exportSlides[exportIndex].image && (
              <div className="flex-1 w-full flex items-center justify-center">
                <div className="relative w-full max-w-lg shadow-2xl border-8 border-white bg-slate-200 rounded-3xl overflow-hidden">
                  <OptimizedImage 
                    src={exportSlides[exportIndex].image} 
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
            <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Exportation en cours...</h3>
            <p className="text-slate-500 mb-6">
              Génération de la diapositive {exportIndex + 1} sur {exportSlides.length}
            </p>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-brand-primary"
                initial={{ width: 0 }}
                animate={{ width: `${((exportIndex + 1) / exportSlides.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
