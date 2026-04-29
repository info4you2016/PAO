import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { Plus, Trash2, Save, X, LogIn, LogOut, Edit2, ChevronUp, ChevronDown, Database, Settings, AlertTriangle, Wand2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { INITIAL_SLIDES } from '../constants';
import { generateImageForSlide } from '../services/aiService';

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
  presentationId?: string;
  onUpdatePresentation?: (data: Partial<PresentationData>) => void;
}

interface PresentationData {
  id: string;
  title: string;
  description?: string;
  course?: string;
  ownerId: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ presentationId, onUpdatePresentation }) => {
  const [user, setUser] = useState<User | null>(null);
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [isEditingPresentation, setIsEditingPresentation] = useState(false);
  const [presentationForm, setPresentationForm] = useState({ title: '', description: '', course: '' });
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [editingSlide, setEditingSlide] = useState<SlideData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if user is admin
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else if (u.email === "info4you2013@gmail.com") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status", error);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin || !presentationId) return;

    const unsubPres = onSnapshot(doc(db, 'presentations', presentationId), (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as PresentationData;
        setPresentation(data);
        setPresentationForm({ 
          title: data.title, 
          description: data.description || '', 
          course: data.course || '' 
        });
      }
    });

    const q = query(collection(db, 'presentations', presentationId, 'slides'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slidesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlideData));
      setSlides(slidesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'slides');
    });

    return () => {
      unsubscribe();
      unsubPres();
    };
  }, [isAdmin, presentationId]);

  const savePresentationMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentationId) return;

    try {
      await updateDoc(doc(db, 'presentations', presentationId), {
        title: presentationForm.title.trim(),
        description: presentationForm.description.trim(),
        course: presentationForm.course.trim() || null
      });
      setIsEditingPresentation(false);
      if (onUpdatePresentation) {
        onUpdatePresentation({
          title: presentationForm.title.trim(),
          description: presentationForm.description.trim(),
          course: presentationForm.course.trim() || null
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'presentations');
    }
  };

  const login = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Le popup a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setLoginError("Une tentative de connexion est déjà en cours.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("La fenêtre de connexion a été fermée.");
      } else {
        setLoginError("Échec de la connexion. Veuillez réessayer.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => signOut(auth);

  const saveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlide || !presentationId) return;

    try {
      if (editingSlide.id) {
        const { id, ...data } = editingSlide;
        await updateDoc(doc(db, 'presentations', presentationId, 'slides', id), data as any);
      } else {
        await addDoc(collection(db, 'presentations', presentationId, 'slides'), editingSlide);
      }
      setEditingSlide(null);
    } catch (error: any) {
      if (error && typeof error === 'object' && error.message?.includes("exceeds the maximum allowed size")) {
        alert("La diapositive est trop volumineuse (maximum 1 Mo). Cela est souvent dû à une image trop lourde. Essayez de réduire la taille de l'image.");
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'slides');
      }
    }
  };

  const deleteSlide = async (id: string) => {
    if (!window.confirm("Supprimer cette diapositive ?") || !presentationId) return;
    try {
      await deleteDoc(doc(db, 'presentations', presentationId, 'slides', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'slides');
    }
  };

  const moveSlide = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length || !presentationId) return;

    const slide1 = slides[index];
    const slide2 = slides[newIndex];

    try {
      await updateDoc(doc(db, 'presentations', presentationId, 'slides', slide1.id!), { order: slide2.order });
      await updateDoc(doc(db, 'presentations', presentationId, 'slides', slide2.id!), { order: slide1.order });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'slides');
    }
  };

  const seedData = async () => {
    if (!window.confirm("Initialiser la base de données avec les diapositives par défaut ?") || !presentationId) return;
    try {
      for (const s of INITIAL_SLIDES) {
        await addDoc(collection(db, 'presentations', presentationId, 'slides'), s);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'slides');
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100"
        >
          <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Settings className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Administration</h2>
          <p className="text-slate-500 mb-8">Connectez-vous avec votre compte Google pour gérer le contenu de la présentation.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{loginError}</p>
            </div>
          )}
          
          <button 
            onClick={login} 
            disabled={isLoggingIn}
            className={cn(
              "w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold transition-all shadow-sm group",
              isLoggingIn ? "opacity-70 cursor-not-allowed" : "hover:bg-slate-50 hover:border-slate-300"
            )}
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isLoggingIn ? "Connexion en cours..." : "Continuer avec Google"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        Accès refusé. Vous n'êtes pas administrateur.
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
              <div className="quill-wrapper border border-slate-200 rounded-xl overflow-hidden">
                <ReactQuill 
                  theme="snow"
                  value={presentationForm.description} 
                  onChange={content => setPresentationForm({ ...presentationForm, description: content })}
                  placeholder="Description de la présentation..."
                  modules={{
                    toolbar: [
                      ['bold', 'italic', 'underline'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link', 'clean']
                    ],
                  }}
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

      <div className="grid gap-4">
        {slides.map((slide, index) => (
          <div key={slide.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <button onClick={() => moveSlide(index, 'up')} disabled={index === 0} className="p-1 hover:bg-slate-100 rounded disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveSlide(index, 'down')} disabled={index === slides.length - 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{slide.title}</h3>
                <p className="text-xs text-slate-500">Ordre: {slide.order}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditingSlide(slide)} className="p-2 text-slate-400 hover:text-brand-primary transition-all"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => deleteSlide(slide.id!)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {editingSlide && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <form onSubmit={saveSlide} className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{editingSlide.id ? 'Modifier' : 'Ajouter'} une diapositive</h3>
                <button type="button" onClick={() => setEditingSlide(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
                  <input 
                    required
                    type="text" 
                    value={editingSlide.title} 
                    onChange={e => setEditingSlide({ ...editingSlide, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingSlide.image || ''} 
                      onChange={e => setEditingSlide({ ...editingSlide, image: e.target.value })}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none"
                      placeholder="https://..."
                    />
                    <button
                      type="button"
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage || !editingSlide.title}
                      className={cn(
                        "px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-all",
                        isGeneratingImage 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
                      )}
                      title="Générer une image avec l'IA"
                    >
                      {isGeneratingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Wand2 className="w-5 h-5" />
                      )}
                      <span className="hidden sm:inline">IA</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <input 
                    type="checkbox" 
                    id="isPlayground"
                    checked={editingSlide.isPlayground || false} 
                    onChange={e => setEditingSlide({ ...editingSlide, isPlayground: e.target.checked })}
                    className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
                  />
                  <label htmlFor="isPlayground" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Activer le Mode Playground (Code Interactif)
                  </label>
                </div>

                {editingSlide.isPlayground ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code Initial (JavaScript)</label>
                    <textarea 
                      rows={6}
                      value={editingSlide.initialCode || ''} 
                      onChange={e => setEditingSlide({ ...editingSlide, initialCode: e.target.value })}
                      placeholder="// Écrivez votre boucle ici..."
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contenu de la diapositive</label>
                    <div className="quill-wrapper">
                      <ReactQuill 
                        theme="snow"
                        value={editingSlide.content}
                        onChange={(content) => setEditingSlide({ ...editingSlide, content })}
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'color': [] }, { 'background': [] }],
                            ['link', 'code-block'],
                            ['clean']
                          ],
                        }}
                        className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setEditingSlide(null)} className="px-6 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all">
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
