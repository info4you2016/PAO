import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'motion/react';
import { Plus, Trash2, Save, X, LogOut, Edit2, ChevronUp, ChevronDown, Database, Settings, AlertTriangle, Wand2, Loader2, Type, Layers, Code, MessageSquare, HelpCircle, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { INITIAL_SLIDES, PRESENTATION_THEMES } from '../constants';
import { generateImageForSlide, generateSlideContent, generateQuizQuestions, generateSpeakerNotes } from '../services/aiService';
import { generateSlideExplanation } from '../services/aiService';
import { api } from '../lib/api';
import { CustomTheme, SlideData, QuizQuestion, PresentationData } from '../types';
import { authHelpers } from '../firebase';
import { LayoutGrid, AppWindow, Columns, Image as ImageIcon, Palette, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';
import { CodeBlock } from './CodeBlock';
import { MarkdownEditor } from './MarkdownEditor';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface AdminPanelProps {
  user: any;
  onLogout: () => void;
  presentationId?: string;
  onUpdatePresentation?: (data: any) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout, presentationId, onUpdatePresentation }) => {
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [isEditingPresentation, setIsEditingPresentation] = useState(false);
  const [presentationForm, setPresentationForm] = useState({ title: '', description: '', course: '', theme: 'default' });
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [editingSlide, setEditingSlide] = useState<SlideData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [themeForm, setThemeForm] = useState<Omit<CustomTheme, 'id' | 'createdBy' | 'createdAt' | 'isPublic' | 'fontFamily'>>({
    name: 'Nouveau Thème',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    accentColor: '#3b82f6',
    bgColor: '#f8fafc',
    slideBgColor: '#ffffff',
    textColor: '#0f172a',
    description: ''
  });
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  useEffect(() => {
    const unsub = authHelpers.onAuthStateChanged((u) => {
      setFirebaseUser(u);
      setIsFirebaseLoading(false);
    });
    return () => unsub();
  }, []);

  const [activeTab, setActiveTab] = useState<'content' | 'themes'>('content');
  const [error, setError] = useState<string | null>(null);

  const loadCustomThemes = async (retries = 3) => {
    try {
      const themes = await api.themes.getAll();
      setCustomThemes(themes);
    } catch (error) {
      if (retries > 0) {
        console.warn(`Retrying custom themes load... (${retries} retries left)`);
        setTimeout(() => loadCustomThemes(retries - 1), 2000);
      } else {
        console.error("Error fetching themes:", error);
      }
    }
  };

  useEffect(() => {
    loadCustomThemes();
  }, []);

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const themeData = {
        ...themeForm,
        fontFamily: 'Inter',
        isPublic: true,
        createdBy: user.id
      };

      await api.themes.create(themeData);
      setIsCreatingTheme(false);
      setThemeForm({
        name: 'Nouveau Thème',
        primaryColor: '#3b82f6',
        secondaryColor: '#60a5fa',
        accentColor: '#3b82f6',
        bgColor: '#f8fafc',
        slideBgColor: '#ffffff',
        textColor: '#0f172a',
        description: ''
      });
      loadCustomThemes();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la création du thème.");
    }
  };

  const deleteTheme = async (id: string) => {
    if (!window.confirm("Supprimer ce thème ?")) return;
    try {
      await api.themes.delete(id);
      loadCustomThemes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateImage = async () => {
    if (!editingSlide || isGeneratingImage) return;
    
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateImageForSlide(editingSlide.title, editingSlide.content);
      setEditingSlide({ ...editingSlide, image: imageUrl });
    } catch (err: any) {
      console.error("Failed to generate image", err);
      setError(err.message || "Erreur lors de la génération de l'image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!editingSlide || !presentation || isGeneratingContent) return;
    setIsGeneratingContent(true);
    try {
      const content = await generateSlideContent(presentation.title, editingSlide.title);
      setEditingSlide({ ...editingSlide, content });
    } catch (err: any) {
      console.error("Content gen error", err);
      setError(err.message || "Erreur lors de la génération du contenu.");
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!editingSlide || !presentation || isGeneratingContent) return;
    setIsGeneratingContent(true);
    try {
      const questions = await generateQuizQuestions(editingSlide.title || presentation.title);
      setEditingSlide({ ...editingSlide, isQuiz: true, quizQuestions: questions });
    } catch (error) {
      console.error("Quiz gen error", error);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleGenerateNotes = async () => {
    if (!editingSlide || isGeneratingNotes) return;
    setIsGeneratingNotes(true);
    try {
      const notes = await generateSpeakerNotes(editingSlide.title, editingSlide.content);
      setEditingSlide({ ...editingSlide, speakerNotes: notes });
    } catch (error) {
      console.error("Notes gen error", error);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleGenerateExplanation = async () => {
    if (!editingSlide || isGeneratingExplanation) return;
    setIsGeneratingExplanation(true);
    try {
      const explanation = await generateSlideExplanation(editingSlide.title, editingSlide.content);
      setEditingSlide({ ...editingSlide, explanation });
    } catch (err: any) {
      console.error("Explanation gen error", err);
      setError(err.message || "Erreur lors de la génération de l'explication.");
    } finally {
      setIsGeneratingExplanation(false);
    }
  };

  const checkAdminStatus = async (u: any) => {
    try {
      setIsCheckingAdmin(true);
      const userData = await api.users.get(u.id);
      if (u.email === "info4you2013@gmail.com" || userData?.role === 'admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error checking admin status", error);
      if (u.email === "info4you2013@gmail.com") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } finally {
      setIsCheckingAdmin(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkAdminStatus(user);
    } else {
      setIsAdmin(false);
      setIsCheckingAdmin(false);
    }
  }, [user]);

  const loadPresentationData = async () => {
    if (!presentationId) return;
    try {
      const p = await api.presentations.getOne(presentationId);
      if (p) {
        setPresentation(p);
        setPresentationForm({ 
          title: p.title, 
          description: p.description || '', 
          course: p.course || '',
          theme: p.theme || 'default'
        });

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
          speakerNotes: s.speaker_notes,
          explanation: s.explanation,
          layoutType: s.layout_type
        })));
      }
    } catch (error) {
      console.error("Error loading presentation data", error);
    }
  };

  useEffect(() => {
    if (isAdmin && presentationId) {
      loadPresentationData();
    }
  }, [isAdmin, presentationId]);

  const savePresentationMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentationId) return;

    try {
      await api.presentations.update(presentationId, {
        title: presentationForm.title,
        description: presentationForm.description,
        course: presentationForm.course || null,
        theme: presentationForm.theme
      });
      setIsEditingPresentation(false);
      loadPresentationData();
    } catch (error) {
      console.error(error);
    }
  };

  const logout = onLogout;

  const saveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlide || !presentationId) return;

    try {
      if (editingSlide.id) {
        await api.slides.update(editingSlide.id, {
          title: editingSlide.title,
          content: editingSlide.content,
          imageUrl: editingSlide.image || null,
          bgColor: editingSlide.bgColor || '#F8FAFC',
          order: editingSlide.order,
          isPlayground: editingSlide.isPlayground,
          initialCode: editingSlide.initialCode,
          isQuiz: editingSlide.isQuiz,
          quizQuestions: editingSlide.quizQuestions,
          isQA: editingSlide.isQA,
          speakerNotes: editingSlide.speakerNotes,
          explanation: editingSlide.explanation,
          layoutType: editingSlide.layoutType || 'standard'
        });
      } else {
        await api.presentations.addSlide(presentationId, {
          id: crypto.randomUUID(),
          title: editingSlide.title,
          content: editingSlide.content,
          imageUrl: editingSlide.image || null,
          bgColor: editingSlide.bgColor || '#F8FAFC',
          order: editingSlide.order,
          isPlayground: editingSlide.isPlayground,
          initialCode: editingSlide.initialCode,
          isQuiz: editingSlide.isQuiz,
          quizQuestions: editingSlide.quizQuestions,
          isQA: editingSlide.isQA,
          speakerNotes: editingSlide.speakerNotes,
          explanation: editingSlide.explanation,
          layoutType: editingSlide.layoutType || 'standard'
        });
      }
      setEditingSlide(null);
      loadPresentationData();
    } catch (error: any) {
      console.error(error);
      alert("Erreur lors de l'enregistrement.");
    }
  };

  const deleteSlide = async (id: string) => {
    if (!window.confirm("Supprimer cette diapositive ?") || !presentationId) return;
    try {
      await api.slides.delete(id);
      loadPresentationData();
    } catch (error) {
      console.error(error);
    }
  };

  const moveSlide = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length || !presentationId) return;

    const s1 = slides[index];
    const s2 = slides[newIndex];

    try {
      await api.slides.update(s1.id!, { ...s1, order: s2.order });
      await api.slides.update(s2.id!, { ...s2, order: s1.order });
      loadPresentationData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleReorder = async (newSlides: SlideData[]) => {
    // Optimistic update
    setSlides(newSlides);
    
    // Prepare batch update for server
    const orders = newSlides.map((slide, index) => ({
      id: slide.id!,
      order: index
    }));

    try {
      await api.slides.reorder(orders);
    } catch (error) {
      console.error("Failed to reorder slides", error);
      // Revert on failure
      loadPresentationData();
    }
  };

  const seedData = async () => {
    if (!window.confirm("Initialiser ?") || !presentationId) return;
    try {
      const slidesToSeed = INITIAL_SLIDES.map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        order: i
      }));
      await api.presentations.batchAddSlides(presentationId, slidesToSeed);
      loadPresentationData();
    } catch (error) {
      console.error(error);
    }
  };

  if (isCheckingAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-red-100"
        >
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Accès restreint</h2>
          <p className="text-slate-500 mb-8">
            Désolé, votre compte (<b>{user.email}</b>) n'a pas les droits d'administration nécessaires.
          </p>
          <button 
            onClick={logout}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Se déconnecter
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      {/* Admin Tabs */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit mx-auto">
        <button 
          onClick={() => setActiveTab('content')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
            activeTab === 'content' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          Contenu
        </button>
        <button 
          onClick={() => setActiveTab('themes')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
            activeTab === 'themes' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <Palette className="w-4 h-4" />
          Thèmes
        </button>
      </div>
      
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-3xl flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm font-bold">{error}</span>
          </div>
          <button 
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {activeTab === 'content' ? (
        <>
          {/* Presentation Metadata Section */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">Paramètres de la présentation</h2>
            <p className="text-slate-500">Gérez les informations générales</p>
          </div>
          {!isEditingPresentation && (
            <button 
              onClick={() => setIsEditingPresentation(true)}
              className="flex items-center gap-2 px-4 py-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all font-bold"
            >
              <Edit2 className="w-4 h-4" />
              Modifier
            </button>
          )}
        </div>

        {isEditingPresentation ? (
          <form onSubmit={savePresentationMeta} className="space-y-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titre</label>
                <input 
                  required
                  type="text" 
                  value={presentationForm.title} 
                  onChange={e => setPresentationForm({ ...presentationForm, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cours / Catégorie</label>
                <input 
                  type="text" 
                  placeholder="Ex: Programmation 101"
                  value={presentationForm.course} 
                  onChange={e => setPresentationForm({ ...presentationForm, course: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Thème Visuel</label>
                {!firebaseUser ? (
                  <button 
                    type="button"
                    onClick={() => authHelpers.signInAnonymously()}
                    className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold hover:bg-slate-200"
                  >
                    Connecter pour créer des thèmes
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setIsCreatingTheme(true)}
                    className="flex items-center gap-1 text-[10px] bg-brand-primary/10 px-2 py-1 rounded text-brand-primary font-bold hover:bg-brand-primary/20"
                  >
                    <Plus className="w-3 h-3" />
                    Nouveau Thème Custom
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Built-in Themes */}
                {PRESENTATION_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setPresentationForm({ ...presentationForm, theme: theme.id })}
                    className={cn(
                      "group flex flex-col items-center p-3 rounded-2xl border transition-all text-left",
                      presentationForm.theme === theme.id
                        ? "bg-brand-primary/5 border-brand-primary shadow-sm"
                        : "bg-slate-50 border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="w-full aspect-video rounded-lg mb-2 relative overflow-hidden flex items-center justify-center">
                      <div className={cn("absolute inset-0", theme.bg)} />
                      <div className={cn("w-12 h-8 rounded shadow-sm border border-white/20", theme.primary)} />
                      <div className={cn("absolute bottom-1 right-1 w-4 h-4 rounded-full border border-white/20", theme.secondary)} />
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider block truncate",
                        presentationForm.theme === theme.id ? "text-brand-primary" : "text-slate-500"
                      )}>
                        {theme.name}
                      </span>
                    </div>
                  </button>
                ))}

                {/* Custom Themes from Firebase */}
                {customThemes.map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => setPresentationForm({ ...presentationForm, theme: `custom:${theme.id}` })}
                    className={cn(
                      "group flex flex-col items-center p-3 rounded-2xl border transition-all text-left relative cursor-pointer",
                      presentationForm.theme === `custom:${theme.id}`
                        ? "bg-brand-primary/5 border-brand-primary shadow-sm"
                        : "bg-slate-50 border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteTheme(theme.id); }}
                      className="absolute top-1 right-1 w-5 h-5 bg-white/80 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div className="w-full aspect-video rounded-lg mb-2 relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: theme.bgColor }}>
                      <div className="w-12 h-8 rounded shadow-sm border border-white/20" style={{ backgroundColor: theme.primaryColor }} />
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: theme.secondaryColor }} />
                    </div>
                    <div className="flex items-center gap-1 w-full overflow-hidden">
                      <Palette className="w-3 h-3 text-brand-primary flex-shrink-0" />
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider block truncate",
                        presentationForm.theme === `custom:${theme.id}` ? "text-brand-primary" : "text-slate-500"
                      )}>
                        {theme.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description (Markdown)</label>
              <MarkdownEditor 
                value={presentationForm.description}
                onChange={value => setPresentationForm({ ...presentationForm, description: value })}
                placeholder="Décrivez votre présentation..."
                rows={6}
                label="presentation-description"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setIsEditingPresentation(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                Enregistrer les infos
              </button>
            </div>
          </form>
        ) : presentation && (
          <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded text-[10px] font-bold uppercase">
                  {presentation.course || "Aucun cours"}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{presentation.title}</h3>
              </div>
              {presentation.description ? (
                <div className="text-sm text-slate-500 presentation-rich-content prose prose-slate max-w-none">
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
                    {presentation.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Aucune description.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Diapositives</h2>
        <div className="flex items-center gap-4">
          {slides.length === 0 && (
            <button 
              onClick={seedData}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
            >
              <Database className="w-4 h-4" />
              Initialiser
            </button>
          )}
          <button 
            onClick={() => setEditingSlide({ order: slides.length, title: '', content: '', image: '', isPlayground: false, initialCode: '' })}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

      <div className="space-y-4">
        <Reorder.Group axis="y" values={slides} onReorder={handleReorder} className="space-y-4">
          {slides.map((slide, index) => (
            <Reorder.Item 
              key={slide.id} 
              value={slide}
              className="card-minimal p-6 flex items-center justify-between group h-24 cursor-grab active:cursor-grabbing hover:border-brand-primary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="text-slate-300 group-hover:text-brand-primary transition-colors">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:flex flex-col gap-1 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveSlide(index, 'up'); }} 
                      disabled={index === 0} 
                      className="p-1 text-slate-400 hover:text-brand-accent hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-20 pointer-events-auto"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveSlide(index, 'down'); }} 
                      disabled={index === slides.length - 1} 
                      className="p-1 text-slate-400 hover:text-brand-accent hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-20 pointer-events-auto"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-lg font-display font-bold text-slate-900 group-hover:text-brand-accent transition-colors truncate max-w-[200px] md:max-w-[400px]">
                        {slide.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {slide.isQA && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Q&R
                        </span>
                      )}
                      {slide.isQuiz && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          Quiz
                        </span>
                      )}
                      {slide.isPlayground && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Settings className="w-3 h-3" />
                          Interactif
                        </span>
                      )}
                      {slide.image && (
                        <span className="px-2 py-0.5 bg-brand-accent/5 text-brand-accent rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          Média
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingSlide(slide); }} 
                  className="p-3 text-slate-400 hover:text-brand-accent hover:bg-slate-50 rounded-xl transition-all"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id!); }} 
                  className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {slides.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 italic text-slate-400">
            Aucune diapositive pour le moment.
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Gestion des Thèmes Global</h2>
              <p className="text-slate-500">Créez et modifiez les thèmes visuels disponibles</p>
            </div>
            <button 
              onClick={() => setIsCreatingTheme(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-bold"
            >
              <Plus className="w-4 h-4" />
              Créer un Thème
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customThemes.map((theme) => (
              <div key={theme.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group">
                <div className="h-32 relative flex items-center justify-center transition-all group-hover:h-40" style={{ backgroundColor: theme.bgColor }}>
                  <div className="w-24 h-16 rounded-xl shadow-lg border-2 border-white/20" style={{ backgroundColor: theme.primaryColor }} />
                  <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full border-2 border-white/20 shadow-md" style={{ backgroundColor: theme.secondaryColor }} />
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-lg opacity-50" style={{ backgroundColor: theme.accentColor }} />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{theme.name}</h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => deleteTheme(theme.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {theme.description && (
                    <p className="text-xs text-slate-500 mb-4">{theme.description}</p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {['primaryColor', 'secondaryColor', 'bgColor', 'textColor'].map((key) => (
                      <div key={key} className="flex flex-col gap-1 items-center">
                        <div 
                          className="w-full h-8 rounded-lg border border-slate-100 shadow-inner" 
                          style={{ backgroundColor: (theme as any)[key] }} 
                        />
                        <span className="text-[8px] uppercase font-bold text-slate-400">
                          {key.replace('Color', '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingSlide && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100"
          >
            <form onSubmit={saveSlide} className="flex flex-col h-[85vh] md:h-auto max-h-[90vh]">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
                    {editingSlide.id ? 'Modifier la diapositive' : 'Nouvelle diapositive'}
                  </h3>
                  <p className="text-slate-400 text-sm font-medium">Configurez le contenu et les options</p>
                </div>
                <button type="button" onClick={() => setEditingSlide(null)} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Layout Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mise en Page</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'standard', icon: AppWindow, label: 'Standard' },
                      { id: 'bento', icon: LayoutGrid, label: 'Bento' },
                      { id: 'split', icon: Columns, label: 'Séparé' },
                      { id: 'fullImage', icon: ImageIcon, label: 'Plein Écran' }
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setEditingSlide({ ...editingSlide, layoutType: l.id as any })}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                          editingSlide.layoutType === l.id || (!editingSlide.layoutType && l.id === 'standard')
                            ? "bg-brand-primary/5 border-brand-primary text-brand-primary shadow-sm"
                            : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        <l.icon className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titre de la section</label>
                      <input 
                        required
                        type="text" 
                        value={editingSlide.title} 
                        onChange={e => setEditingSlide({ ...editingSlide, title: e.target.value })}
                        className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all placeholder:text-slate-300"
                        placeholder="Ex: Introduction aux Tableaux"
                      />
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Image de couverture (URL)</label>
                      <div 
                        className={cn(
                          "flex flex-col gap-4 p-6 border-2 border-dashed rounded-[2rem] transition-all",
                          isGeneratingImage ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200 hover:border-brand-primary/50"
                        )}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-brand-primary', 'bg-brand-primary/5'); }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-primary', 'bg-brand-primary/5'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-brand-primary', 'bg-brand-primary/5');
                          const file = e.dataTransfer.files[0];
                          if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setEditingSlide({ ...editingSlide, image: event.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      >
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingSlide.image || ''} 
                            onChange={e => setEditingSlide({ ...editingSlide, image: e.target.value })}
                            className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all placeholder:text-slate-300 text-sm"
                            placeholder="https://images.unsplash.com/..."
                          />
                          <button
                            type="button"
                            onClick={handleGenerateImage}
                            disabled={isGeneratingImage || !editingSlide.title}
                            className={cn(
                              "px-5 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-sm",
                              isGeneratingImage 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                            )}
                          >
                            {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center gap-4 text-slate-400 text-xs">
                          <div className="h-px flex-1 bg-slate-100" />
                          <span>OU GLISSER UNE IMAGE ICI</span>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>

                      {editingSlide.image && (
                        <div className="relative h-40 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group/img">
                          <OptimizedImage 
                            src={editingSlide.image} 
                            alt="Aperçu" 
                            className="w-full h-full object-cover"
                            aspectRatio="auto"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <button 
                              type="button"
                              onClick={() => setEditingSlide({ ...editingSlide, image: '' })}
                              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900 text-xs uppercase tracking-widest">Bac à sable</label>
                        <div 
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                            editingSlide.isPlayground ? "bg-brand-primary" : "bg-slate-200"
                          )}
                          onClick={() => setEditingSlide({ ...editingSlide, isPlayground: !editingSlide.isPlayground, isQuiz: false, isQA: false })}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                            editingSlide.isPlayground ? "left-7" : "left-1"
                          )} />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900 text-xs uppercase tracking-widest">Quiz Interactif</label>
                        <div 
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                            editingSlide.isQuiz ? "bg-brand-primary" : "bg-slate-200"
                          )}
                          onClick={() => setEditingSlide({ 
                            ...editingSlide, 
                            isQuiz: !editingSlide.isQuiz, 
                            isPlayground: false, 
                            isQA: false,
                            quizQuestions: editingSlide.quizQuestions || [{ question: '', options: ['', ''], correctAnswer: 0 }] 
                          })}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                            editingSlide.isQuiz ? "left-7" : "left-1"
                          )} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900 text-xs uppercase tracking-widest">Questions & Réponses</label>
                        <div 
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                            editingSlide.isQA ? "bg-brand-primary" : "bg-slate-200"
                          )}
                          onClick={() => setEditingSlide({ ...editingSlide, isQA: !editingSlide.isQA, isPlayground: false, isQuiz: false })}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                            editingSlide.isQA ? "left-7" : "left-1"
                          )} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contenu principal (Markdown)</label>
                    <div className="flex items-center gap-2">
                       <button 
                        type="button"
                        onClick={handleGenerateContent}
                        disabled={isGeneratingContent || !editingSlide.title}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 rounded-xl text-[10px] font-bold transition-all"
                      >
                        {isGeneratingContent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Générer avec IA
                      </button>
                    </div>
                  </div>
                  
                  {editingSlide.isPlayground ? (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                      <textarea 
                        rows={10}
                        value={editingSlide.initialCode || ''} 
                        onChange={e => setEditingSlide({ ...editingSlide, initialCode: e.target.value })}
                        placeholder="// Écrivez votre code initial ici..."
                        className="w-full p-6 bg-slate-50 focus:bg-white transition-colors outline-none font-mono text-sm leading-relaxed"
                      />
                    </div>
                  ) : editingSlide.isQuiz ? (
                    <div className="space-y-6">
                      <div className="flex justify-end">
                        <button 
                          type="button"
                          onClick={handleGenerateQuiz}
                          disabled={isGeneratingContent}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-xl text-[10px] font-bold transition-all"
                        >
                          {isGeneratingContent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Générer Questions
                        </button>
                      </div>
                      <Reorder.Group axis="y" values={editingSlide.quizQuestions || []} onReorder={(newQuestions) => setEditingSlide({ ...editingSlide, quizQuestions: newQuestions })} className="space-y-6">
                        {(editingSlide.quizQuestions || []).map((q, qIndex) => (
                          <Reorder.Item 
                            key={qIndex} 
                            value={q}
                            className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-slate-300" />
                                <h4 className="font-bold text-slate-900">Question {qIndex + 1}</h4>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  const newQuestions = [...(editingSlide.quizQuestions || [])];
                                  newQuestions.splice(qIndex, 1);
                                  setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                                }}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all pointer-events-auto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <input 
                              type="text"
                              value={q.question}
                              onChange={e => {
                                const newQuestions = [...(editingSlide.quizQuestions || [])];
                                newQuestions[qIndex].question = e.target.value;
                                setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                              }}
                              placeholder="Quelle est la question ?"
                              className="w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 focus:border-brand-primary outline-none transition-all pointer-events-auto"
                            />

                            <div className="space-y-2 pointer-events-auto">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Options (Cochez la bonne réponse)</label>
                              {q.options.map((opt, oIndex) => (
                                <div key={oIndex} className="flex gap-2">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newQuestions = [...(editingSlide.quizQuestions || [])];
                                      newQuestions[qIndex].correctAnswer = oIndex;
                                      setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                                    }}
                                    className={cn(
                                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all",
                                      q.correctAnswer === oIndex ? "bg-green-500 text-white shadow-lg" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                    )}
                                  >
                                    {String.fromCharCode(65 + oIndex)}
                                  </button>
                                  <input 
                                    type="text"
                                    value={opt}
                                    onChange={e => {
                                      const newQuestions = [...(editingSlide.quizQuestions || [])];
                                      newQuestions[qIndex].options[oIndex] = e.target.value;
                                      setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                                    }}
                                    className="flex-1 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 outline-none"
                                  />
                                  {q.options.length > 2 && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        const newQuestions = [...(editingSlide.quizQuestions || [])];
                                        newQuestions[qIndex].options.splice(oIndex, 1);
                                        if (q.correctAnswer >= newQuestions[qIndex].options.length) {
                                          newQuestions[qIndex].correctAnswer = 0;
                                        }
                                        setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                                      }}
                                      className="p-2 text-slate-300 hover:text-red-500 transition-all"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button 
                                type="button"
                                onClick={() => {
                                  const newQuestions = [...(editingSlide.quizQuestions || [])];
                                  newQuestions[qIndex].options.push('');
                                  setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                                }}
                                className="text-xs font-bold text-brand-primary hover:underline"
                              >
                                + Ajouter une option
                              </button>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                      <button 
                        type="button"
                        onClick={() => {
                          const newQuestions = [...(editingSlide.quizQuestions || []), { question: '', options: ['', ''], correctAnswer: 0 }];
                          setEditingSlide({ ...editingSlide, quizQuestions: newQuestions });
                        }}
                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Ajouter une Question
                      </button>
                    </div>
                  ) : editingSlide.isQA ? (
                    <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400 space-y-4">
                      <HelpCircle className="w-12 h-12 mx-auto opacity-20" />
                      <div>
                        <p className="font-bold text-slate-600">Le mode Q&R est activé</p>
                        <p className="text-sm">Une interface interactive de questions/réponses sera affichée sur cette diapositive.</p>
                      </div>
                    </div>
                  ) : (
                  <MarkdownEditor 
                    value={editingSlide.content}
                    onChange={value => setEditingSlide({ ...editingSlide, content: value })}
                    placeholder="Contenu de la diapositive (Markdown supporté)..."
                    rows={12}
                    label={`slide-content-${editingSlide.id || 'new'}`}
                  />
                  )}
                </div>

                {/* Speaker Notes */}
                <div className="space-y-3 pt-6 border-t border-slate-50">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Notes du présentateur</label>
                     <button 
                        type="button"
                        onClick={handleGenerateNotes}
                        disabled={isGeneratingNotes || !editingSlide.content}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[10px] font-bold transition-all"
                      >
                        {isGeneratingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Suggérer Notes
                      </button>
                   </div>
                   <MarkdownEditor
                     value={editingSlide.speakerNotes || ''}
                     onChange={value => setEditingSlide({ ...editingSlide, speakerNotes: value })}
                     placeholder="Notes privées pour le présentateur..."
                     rows={4}
                     label={`speaker-notes-${editingSlide.id || 'new'}`}
                   />
                </div>

                {/* Explanation / Side content */}
                <div className="space-y-3 pt-6 border-t border-slate-50">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Explication (Affichée à côté de la diapo)</label>
                     <button 
                        type="button"
                        onClick={handleGenerateExplanation}
                        disabled={isGeneratingExplanation || !editingSlide.content}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-xl text-[10px] font-bold transition-all"
                      >
                        {isGeneratingExplanation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Générer avec l'IA
                      </button>
                   </div>
                   <MarkdownEditor
                     value={editingSlide.explanation || ''}
                     onChange={value => setEditingSlide({ ...editingSlide, explanation: value })}
                     placeholder="Contenu riche affiché à côté de la diapositive..."
                     rows={6}
                     label={`explanation-${editingSlide.id || 'new'}`}
                   />
                </div>
              </div>

              <div className="p-8 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingSlide(null)} className="px-8 py-3 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition-all">
                  Annuler
                </button>
                <button type="submit" className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                  <Save className="w-5 h-5" />
                  <span>Enregistrer la diapositive</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isCreatingTheme && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100"
          >
            <form onSubmit={handleSaveTheme}>
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Nouveau Thème Custom</h3>
                  <p className="text-slate-400 text-sm">Créez votre propre identité visuelle</p>
                </div>
                <button type="button" onClick={() => setIsCreatingTheme(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nom du thème</label>
                    <input 
                      required
                      type="text" 
                      value={themeForm.name} 
                      onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Couleur Primaire</label>
                      <input 
                        type="color" 
                        value={themeForm.primaryColor} 
                        onChange={e => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
                        className="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Couleur Secondaire</label>
                      <input 
                        type="color" 
                        value={themeForm.secondaryColor} 
                        onChange={e => setThemeForm({ ...themeForm, secondaryColor: e.target.value })}
                        className="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fond Application</label>
                      <input 
                        type="color" 
                        value={themeForm.bgColor} 
                        onChange={e => setThemeForm({ ...themeForm, bgColor: e.target.value })}
                        className="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fond Diapositive</label>
                      <input 
                        type="color" 
                        value={themeForm.slideBgColor} 
                        onChange={e => setThemeForm({ ...themeForm, slideBgColor: e.target.value })}
                        className="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Couleur Accent</label>
                      <input 
                        type="color" 
                        value={themeForm.accentColor} 
                        onChange={e => setThemeForm({ ...themeForm, accentColor: e.target.value })}
                        className="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Texte</label>
                      <input 
                        type="color" 
                        value={themeForm.textColor} 
                        onChange={e => setThemeForm({ ...themeForm, textColor: e.target.value })}
                        className="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center gap-6" style={{ backgroundColor: themeForm.bgColor }}>
                   <div className="w-1/2 p-4 rounded-xl shadow-lg flex flex-col gap-2" style={{ backgroundColor: themeForm.slideBgColor }}>
                      <div className="w-1/2 h-2 rounded-full" style={{ backgroundColor: themeForm.primaryColor }} />
                      <div className="w-full h-1 rounded-full opacity-50" style={{ backgroundColor: themeForm.textColor }} />
                      <div className="w-full h-1 rounded-full opacity-50" style={{ backgroundColor: themeForm.textColor }} />
                      <div className="w-3/4 h-1 rounded-full opacity-50" style={{ backgroundColor: themeForm.textColor }} />
                      <div className="flex gap-1 mt-2">
                         <div className="w-4 h-4 rounded-full" style={{ backgroundColor: themeForm.secondaryColor }} />
                         <div className="w-4 h-4 rounded-full" style={{ backgroundColor: themeForm.accentColor }} />
                      </div>
                   </div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest rotate-90">Preview</div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreatingTheme(false)} className="px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition-all">
                  Annuler
                </button>
                <button type="submit" className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  <Save className="w-5 h-5" />
                  <span>Enregistrer Thème</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
