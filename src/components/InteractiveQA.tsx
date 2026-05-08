import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, ThumbsUp, User, Clock, CheckCircle2, Heart, Smile, Zap, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface Interaction {
  id: string;
  type: 'question' | 'reaction';
  text?: string;
  content?: string;
  userName?: string;
  user_name?: string;
  timestamp?: number;
  created_at?: string;
  votes: number;
  is_answered: boolean;
}

interface InteractiveQAProps {
  slideId: string;
  isAdmin?: boolean;
}

const REACTIONS = [
  { emoji: '❤️', icon: Heart, color: 'text-red-500' },
  { emoji: '👏', icon: Sparkles, color: 'text-yellow-500' },
  { emoji: '🔥', icon: Zap, color: 'text-orange-500' },
  { emoji: '😊', icon: Smile, color: 'text-blue-500' }
];

export const InteractiveQA: React.FC<InteractiveQAProps> = ({ slideId, isAdmin }) => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [activeReactions, setActiveReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchInteractions = async () => {
    if (!slideId || slideId.startsWith('temp-')) {
      setIsLoading(false);
      setInteractions([]);
      return;
    }
    
    try {
      const data = await api.qa.get(slideId);
      if (Array.isArray(data)) {
        setInteractions(data);
      } else {
        setInteractions([]);
      }
    } catch (error) {
      console.error(`Error fetching QA for slide ${slideId}:`, error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      setInteractions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInteractions();
    
    // Polling with backoff or slower frequency
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchInteractions();
      }
    }, 5000); 
    
    return () => clearInterval(interval);
  }, [slideId]);

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || slideId.startsWith('temp-')) return;

    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
      
    try {
      await api.qa.post(slideId, {
        id,
        type: 'question',
        content: newQuestion.trim(),
        userName: 'Participant'
      });
      setNewQuestion("");
      fetchInteractions();
    } catch (error) {
      console.error("Error posting question:", error);
    }
  };

  const handleVote = async (id: string) => {
    try {
      await api.qa.vote(id);
      fetchInteractions();
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const handleMarkAsAnswered = async (id: string) => {
    try {
      await api.qa.answer(id);
      fetchInteractions();
    } catch (error) {
      console.error("Error marking as answered:", error);
    }
  };

  const handleReaction = (emoji: string) => {
    const reactionId = Date.now();
    const x = Math.random() * 80 + 10; // Random horizontal position
    setActiveReactions(prev => [...prev, { id: reactionId, emoji, x }]);
    
    // Auto-remove reaction after animation
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 2000);
  };

  const clearHistory = async () => {
    if (!confirm("Effacer tout l'historique de cette diapositive ?")) return;
    try {
      await api.qa.clear(slideId);
      fetchInteractions();
    } catch (error) {
      console.error("Error clearing QA:", error);
    }
  };

  const questions = interactions.filter(i => i.type === 'question');

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Reactions Overlay */}
      <div className="absolute inset-x-0 bottom-32 h-64 pointer-events-none overflow-hidden z-50">
        <AnimatePresence>
          {activeReactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ y: 0, opacity: 0, scale: 0.5 }}
              animate={{ y: -300, opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.5, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute bottom-0 text-3xl sm:text-4xl"
              style={{ left: `${r.x}%` }}
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="w-full bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[60vh] sm:h-[550px] mb-8 relative">
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-brand-primary/10 rounded-xl sm:rounded-2xl">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm sm:text-base font-display font-bold text-slate-900 leading-tight">Questions & Réponses</h3>
              <p className="text-[10px] text-slate-500 font-medium">Posez vos questions !</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button 
                onClick={clearHistory}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Effacer l'historique"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-bold uppercase">
              {questions.length} Questions
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 presentation-slide-scrollbar bg-slate-50/30" ref={scrollRef}>
          <AnimatePresence initial={false}>
            {questions.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "p-4 sm:p-5 border rounded-3xl transition-all flex gap-4 group text-left relative",
                  q.is_answered 
                    ? "bg-slate-50/50 border-slate-100 opacity-60" 
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-brand-primary/20"
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <button 
                    onClick={() => handleVote(q.id)}
                    disabled={q.is_answered}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      q.is_answered ? "text-slate-300" : "hover:bg-brand-primary/10 hover:text-brand-primary text-slate-400"
                    )}
                  >
                    <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <span className="text-xs font-bold text-slate-500">{q.votes}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "font-medium leading-relaxed text-sm sm:text-base",
                      q.is_answered ? "text-slate-400 line-through" : "text-slate-800"
                    )}>
                      {q.content}
                    </p>
                    {isAdmin && !q.is_answered && (
                      <button 
                        onClick={() => handleMarkAsAnswered(q.id)}
                        className="flex-shrink-0 p-2 text-green-500 hover:bg-green-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="Marquer comme répondu"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                    {q.is_answered && (
                      <div className="flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase px-2 py-1 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> Répondu
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {q.user_name}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 
                      {q.created_at ? new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Maintenant'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {!isLoading && questions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4 py-20">
              <MessageSquare className="w-16 h-16" />
              <p className="font-display font-medium text-lg">Soyez le premier à poser une question !</p>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 bg-white border-t border-slate-100">
          <form onSubmit={handleSubmitQuestion} className="relative mb-4">
            <input 
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Votre question..."
              className="w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all shadow-inner text-sm sm:text-base"
            />
            <button 
              type="submit"
              disabled={!newQuestion.trim()}
              className="absolute right-2 top-2 p-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          {/* Reactions Buttons */}
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {REACTIONS.map((r, i) => (
              <button
                key={i}
                onClick={() => handleReaction(r.emoji)}
                className="group flex flex-col items-center gap-1 transition-transform active:scale-90"
              >
                <div className="p-3 bg-slate-50 group-hover:bg-white border border-slate-100 group-hover:border-brand-primary/20 group-hover:shadow-lg rounded-2xl transition-all">
                  <r.icon className={cn("w-6 h-6", r.color)} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  {r.emoji}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
