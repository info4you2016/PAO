import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp, where, writeBatch, getDocs } from 'firebase/firestore';
import { Plus, Trash2, Play, BookOpen, Clock, Layers, X, Sparkles, MessageSquare, Wand2, Download, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { generatePresentationFromText } from '../services/aiService';
import { toPng } from 'html-to-image';
import { exportPresentationToPPTX } from '../services/exportService';

interface PresentationData {
  id: string;
  title: string;
  description?: string;
  course?: string;
  ownerId: string;
  createdAt: any;
}

interface DashboardProps {
  onSelectPresentation: (presentation: PresentationData) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectPresentation }) => {
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
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

  const courses = Array.from(new Set(presentations.map(p => p.course || "Sans cours"))).sort();

  const filteredPresentations = selectedCourse 
    ? presentations.filter(p => (p.course || "Sans cours") === selectedCourse)
    : presentations;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setPresentations([]);
        return;
      }

      setError(null);
      const q = query(
        collection(db, 'presentations'), 
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresentationData));
        setPresentations(data);
      }, (err) => {
        console.error("Firestore error in Dashboard:", err);
        handleFirestoreError(err, OperationType.LIST, 'presentations');
      });

      return () => unsubSnapshot();
    });

    return () => unsubscribe();
  }, []);

  const handleExport = async (presentation: PresentationData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExporting) return;
    
    setIsExporting(presentation.id);
    setExportPresentation(presentation);
    setSnapshots([]);
    try {
      const q = query(
        collection(db, 'presentations', presentation.id, 'slides'), 
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      const slidesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      if (slidesData.length === 0) {
        setIsExporting(null);
        return;
      }

      setExportSlides(slidesData);
      setExportIndex(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'slides');
      setIsExporting(null);
    }
  };

  useEffect(() => {
    if (exportIndex >= 0 && exportIndex < exportSlides.length && exportRef.current && isExporting) {
      // Capture current slide
      const capture = async () => {
        try {
          // Wait for content to render (images, etc)
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
          setExportIndex(prev => prev + 1); // Skip and continue
        }
      };
      capture();
    } else if (exportIndex >= exportSlides.length && exportSlides.length > 0 && exportPresentation) {
      // Finished all slides
      exportPresentationToPPTX(exportPresentation, exportSlides, snapshots);
      setIsExporting(null);
      setExportIndex(-1);
      setExportSlides([]);
      setExportPresentation(null);
    }
  }, [exportIndex, exportSlides, isExporting, exportPresentation, snapshots.length]);

  const createPresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError("Vous devez être connecté pour créer une présentation.");
      return;
    }

    if (!newPresentation.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'presentations'), {
        title: newPresentation.title.trim(),
        description: newPresentation.description.trim(),
        course: newPresentation.course.trim() || null,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setIsCreating(false);
      setNewPresentation({ title: '', description: '', course: '' });
    } catch (err: any) {
      console.error("Error creating presentation:", err);
      setError("Erreur lors de la création : " + (err.message || "Inconnue"));
      handleFirestoreError(err, OperationType.WRITE, 'presentations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError("Vous devez être connecté.");
      return;
    }

    if (!aiPrompt.trim()) {
      setError("Veuillez saisir un sujet.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const generated = await generatePresentationFromText(aiPrompt);
      
      const docRef = await addDoc(collection(db, 'presentations'), {
        title: generated.title,
        description: generated.description,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });

      const batch = writeBatch(db);
      generated.slides.forEach((slide: any, index: number) => {
        const slideRef = doc(collection(db, `presentations/${docRef.id}/slides`));
        batch.set(slideRef, {
          ...slide,
          order: index,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();

      setIsAIGenerating(false);
      setAiPrompt('');
    } catch (err: any) {
      console.error("AI Generation error:", err);
      setError("Erreur IA : " + (err.message || "Échec de la génération"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePresentation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer cette présentation et toutes ses diapositives ?")) return;
    
    try {
      await deleteDoc(doc(db, 'presentations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'presentations');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 w-full h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tableau de Bord</h1>
          <p className="text-slate-500">Gérez vos présentations dynamiques</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setIsAIGenerating(true); setError(null); }}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-5 h-5 text-brand-primary" />
            Générer avec l'IA
          </button>
          <button 
            onClick={() => { setIsCreating(true); setError(null); }}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Présentation
          </button>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-12">
          <button
            onClick={() => setSelectedCourse(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              selectedCourse === null 
                ? "bg-slate-900 text-white shadow-lg" 
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            )}
          >
            Tous les fichiers
          </button>
          {courses.map(course => (
            <button
              key={course}
              onClick={() => setSelectedCourse(course)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedCourse === course
                  ? "bg-white text-brand-primary border-2 border-brand-primary shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
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
            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-brand-primary/5 transition-all cursor-pointer group overflow-hidden flex flex-col h-full"
          >
            <div className="h-40 bg-slate-50 relative flex items-center justify-center overflow-hidden transition-colors duration-500">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b82f6_0%,transparent_70%)]" />
              </div>
              <Layers className="relative z-10 w-16 h-16 text-slate-200 group-hover:text-brand-primary group-hover:scale-110 transition-all duration-500" />
              <div className="absolute bottom-4 left-4">
                <span className="px-2 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-brand-primary rounded-lg uppercase tracking-tight shadow-sm">
                  {p.course || "Sans cours"}
                </span>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <h3 className="text-2xl font-display font-bold text-slate-900 mb-3 group-hover:text-brand-primary transition-colors">{p.title}</h3>
              {p.description ? (
                <div 
                  className="text-slate-500 text-sm mb-6 line-clamp-3 leading-relaxed presentation-rich-content prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: p.description }}
                />
              ) : (
                <p className="text-slate-500 text-sm mb-6 line-clamp-3 leading-relaxed italic">Aucune description fournie.</p>
              )}
              
              <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{p.createdAt?.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) || "Récent"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => handleExport(p, e)}
                    className="p-3 text-slate-300 hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-all"
                    title="Exporter en PPTX"
                    disabled={isExporting === p.id}
                  >
                    {isExporting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={(e) => deletePresentation(p.id, e)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg group-hover:bg-brand-primary transition-colors">
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
                  <div className="quill-wrapper border border-slate-200 rounded-xl overflow-hidden">
                    <ReactQuill 
                      theme="snow"
                      value={newPresentation.description} 
                      onChange={content => setNewPresentation({ ...newPresentation, description: content })}
                      placeholder="De quoi parle cette présentation ?"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <form onSubmit={generateWithAI} className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-primary/10 rounded-lg">
                    <Sparkles className="w-6 h-6 text-brand-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Générer avec l'IA</h3>
                </div>
                <button type="button" onClick={() => { setIsAIGenerating(false); setError(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-slate-400 mt-1" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  Décrivez le sujet de votre présentation. L'IA générera automatiquement les diapositives, le contenu enrichi et des exercices interactifs.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                  <X className="w-4 h-4 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Sujet de la présentation</label>
                  <textarea 
                    required
                    rows={4}
                    disabled={isSubmitting}
                    placeholder="Ex: Les fondamentaux des boucles JavaScript pour débutants..."
                    value={aiPrompt} 
                    onChange={e => setAiPrompt(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none transition-all disabled:opacity-50 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => { setIsAIGenerating(false); setError(null); }} 
                  className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 group"
                >
                  {isSubmitting ? (
                    <>
                      <Wand2 className="w-5 h-5 animate-pulse" />
                      <span>Génération...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 group-hover:animate-spin-slow" />
                      <span>Générer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
              backgroundColor: exportSlides[exportIndex].bgColor || '#F8FAFC'
            }}
          >
            {/* Background Decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-primary/10 blur-[120px]" />
              <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-secondary/10 blur-[120px]" />
            </div>

            <div className={cn(
              "relative z-10 flex-1 flex flex-col justify-center w-full",
              exportSlides[exportIndex].image || exportSlides[exportIndex].isPlayground ? "text-left" : "text-center items-center"
            )}>
              <span className="text-brand-primary font-display font-semibold tracking-wider uppercase text-lg mb-6">
                Diapositive {exportIndex + 1} / {exportSlides.length}
              </span>
              
              <h1 className="text-6xl font-display font-bold text-slate-900 mb-10 leading-tight">
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
                  <div dangerouslySetInnerHTML={{ __html: exportSlides[exportIndex].content }} />
                )}
              </div>
            </div>

            {exportSlides[exportIndex].image && (
              <div className="flex-1 w-full flex items-center justify-center">
                <div className="relative w-full max-w-lg aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-8 border-white bg-slate-200">
                  <img 
                    src={exportSlides[exportIndex].image} 
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
