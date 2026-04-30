import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Plus, Trash2, Save, X, LogOut, Edit2, ChevronUp, ChevronDown, Database, Settings, AlertTriangle, Wand2, Loader2, Type, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { INITIAL_SLIDES } from '../constants';
import { generateImageForSlide } from '../services/aiService';
import { api } from '../lib/api';

const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean']
  ],
};

const QUILL_FORMATS = [
  'header', 'size', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'script', 'list', 'indent',
  'align', 'blockquote', 'code-block', 'link'
];

interface SlideData {
  id?: string;
  order: number;
  title: string;
  content: string;
  image?: string;
  isPlayground?: boolean;
  initialCode?: string;
}

interface AdminPanelProps {
  user: any;
  onLogout: () => void;
  presentationId?: string;
  onUpdatePresentation?: (data: any) => void;
}

interface PresentationData {
  id: string;
  title: string;
  description?: string;
  course?: string;
  owner_id: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout, presentationId, onUpdatePresentation }) => {
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [isEditingPresentation, setIsEditingPresentation] = useState(false);
  const [presentationForm, setPresentationForm] = useState({ title: '', description: '', course: '' });
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [editingSlide, setEditingSlide] = useState<SlideData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateImage = async () => {
    if (!editingSlide || isGeneratingImage) return;
    
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateImageForSlide(editingSlide.title, editingSlide.content);
      setEditingSlide({ ...editingSlide, image: imageUrl });
    } catch (error) {
      console.error("Failed to generate image", error);
      alert("Erreur lors de la génération de l'image. Veuillez réessayer.");
    } finally {
      setIsGeneratingImage(false);
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
          course: p.course || '' 
        });

        const slidesData = await api.presentations.getSlides(presentationId);
        setSlides(slidesData.map((s: any) => ({
          id: s.id,
          title: s.title,
          content: s.content,
          image: s.image_url,
          order: s.slide_order,
          isPlayground: Boolean(s.is_playground),
          initialCode: s.initial_code
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
        course: presentationForm.course || null
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
          order: editingSlide.order,
          isPlayground: editingSlide.isPlayground,
          initialCode: editingSlide.initialCode
        });
      } else {
        await api.presentations.addSlide(presentationId, {
          id: crypto.randomUUID(),
          title: editingSlide.title,
          content: editingSlide.content,
          imageUrl: editingSlide.image || null,
          order: editingSlide.order,
          isPlayground: editingSlide.isPlayground,
          initialCode: editingSlide.initialCode
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
      {/* Presentation Metadata Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Paramètres de la présentation</h2>
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
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</label>
              <div className="quill-wrapper border border-slate-200 rounded-xl overflow-hidden bg-white">
                <ReactQuill 
                  theme="snow"
                  value={presentationForm.description} 
                  onChange={content => setPresentationForm({ ...presentationForm, description: content })}
                  placeholder="Description de la présentation..."
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                />
              </div>
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
                <div 
                  className="text-sm text-slate-500 presentation-rich-content prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: presentation.description }}
                />
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
        {slides.map((slide, index) => (
          <div key={slide.id} className="card-minimal p-6 flex items-center justify-between group h-24">
            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                <button 
                  onClick={() => moveSlide(index, 'up')} 
                  disabled={index === 0} 
                  className="p-1 text-slate-400 hover:text-brand-accent hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-20"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => moveSlide(index, 'down')} 
                  disabled={index === slides.length - 1} 
                  className="p-1 text-slate-400 hover:text-brand-accent hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-20"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    #{String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-lg font-display font-bold text-slate-900 group-hover:text-brand-accent transition-colors truncate max-w-[300px]">
                    {slide.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setEditingSlide(slide)} 
                className="p-3 text-slate-400 hover:text-brand-accent hover:bg-slate-50 rounded-xl transition-all"
                title="Modifier"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => deleteSlide(slide.id!)} 
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {slides.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 italic text-slate-400">
            Aucune diapositive pour le moment.
          </div>
        )}
      </div>

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
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editingSlide.image || ''} 
                          onChange={e => setEditingSlide({ ...editingSlide, image: e.target.value })}
                          className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all placeholder:text-slate-300"
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
                          <span className="hidden sm:inline">Générer</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900 text-sm">Mode Interactif</label>
                        <div 
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                            editingSlide.isPlayground ? "bg-slate-900" : "bg-slate-200"
                          )}
                          onClick={() => setEditingSlide({ ...editingSlide, isPlayground: !editingSlide.isPlayground })}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                            editingSlide.isPlayground ? "left-7" : "left-1"
                          )} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed italic">
                        Transforme cette diapositive en un environnement d'exécution de code en temps réel.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contenu principal</label>
                    <div className="h-px flex-1 bg-slate-50" />
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
                  ) : (
                    <div className="quill-wrapper border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm ring-brand-accent/5 focus-within:ring-8 transition-all">
                      <ReactQuill 
                        theme="snow"
                        value={editingSlide.content}
                        onChange={(content) => setEditingSlide({ ...editingSlide, content })}
                        modules={QUILL_MODULES}
                        formats={QUILL_FORMATS}
                        className="presentation-quill-editor"
                      />
                    </div>
                  )}
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
    </div>
  );
};
