import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ChevronRight, HelpCircle, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface InteractiveQuizProps {
  questions: QuizQuestion[];
  onComplete?: (score: number) => void;
}

export const InteractiveQuiz: React.FC<InteractiveQuizProps> = ({ questions, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  const handleOptionSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
  };

  const handleNext = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === questions[currentQuestionIndex].correctAnswer;
    
    if (!showResult) {
      if (isCorrect) setScore(prev => prev + 1);
      setShowResult(true);
    } else {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
        setShowResult(false);
      } else {
        setQuizComplete(true);
        if (onComplete) onComplete(score);
      }
    }
  };

  if (quizComplete) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-6 sm:p-10 md:p-12 bg-white rounded-3xl border border-slate-200 shadow-2xl text-center max-w-2xl mx-auto my-6 sm:my-10"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4 sm:mb-6">
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-brand-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-2">Quiz Terminé !</h2>
        <p className="text-slate-500 mb-4 sm:mb-6 text-sm sm:text-base">Bravo, vous avez fini cette session interactive.</p>
        <div className="text-5xl sm:text-6xl font-display font-bold text-brand-primary mb-6 sm:mb-8">
          {score} / {questions.length}
        </div>
        <button 
          onClick={() => {
            setCurrentQuestionIndex(0);
            setSelectedOption(null);
            setShowResult(false);
            setScore(0);
            setQuizComplete(false);
          }}
          className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          Recommencer le Quiz
        </button>
      </motion.div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="w-full max-w-3xl mx-auto my-4 sm:my-8 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 rounded-lg">
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary" />
          </div>
          <span className="text-[10px] sm:text-sm font-bold text-slate-500 uppercase tracking-widest">Question {currentQuestionIndex + 1} sur {questions.length}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full presentation-slide-scrollbar">
          {questions.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1 sm:h-1.5 w-4 sm:w-6 shrink-0 rounded-full transition-all duration-500",
                i === currentQuestionIndex ? "bg-brand-primary w-8 sm:w-12" : i < currentQuestionIndex ? "bg-slate-300" : "bg-slate-100"
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <h2 className="text-xl sm:text-3xl font-display font-bold text-slate-900 leading-snug">
            {currentQuestion.question}
          </h2>

          <div className="grid gap-2 sm:gap-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedOption === index;
              const isCorrect = index === currentQuestion.correctAnswer;
              
              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  disabled={showResult}
                  className={cn(
                    "flex items-center justify-between p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 text-left transition-all group",
                    !showResult && isSelected ? "border-brand-primary bg-brand-primary/5 shadow-md" : "border-slate-100 bg-white hover:border-slate-200",
                    showResult && isCorrect ? "border-green-500 bg-green-50 shadow-sm ring-4 ring-green-100" : "",
                    showResult && isSelected && !isCorrect ? "border-red-500 bg-red-50 shadow-sm ring-4 ring-red-100" : "",
                    showResult && !isSelected && !isCorrect ? "opacity-50" : ""
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1">
                    <div className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm transition-all",
                      !showResult && isSelected ? "border-brand-primary bg-brand-primary text-white" : "border-slate-200 text-slate-400 group-hover:border-slate-300",
                      showResult && isCorrect ? "border-green-500 bg-green-500 text-white" : "",
                      showResult && isSelected && !isCorrect ? "border-red-500 bg-red-500 text-white" : ""
                    )}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className={cn(
                      "font-medium text-sm sm:text-lg leading-tight",
                      !showResult && isSelected ? "text-brand-primary" : "text-slate-700",
                      showResult && isCorrect ? "text-green-700" : "",
                      showResult && isSelected && !isCorrect ? "text-red-700" : ""
                    )}>
                      {option}
                    </span>
                  </div>
                  
                  {showResult && isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500" />}
                </button>
              );
            })}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleNext}
              disabled={selectedOption === null}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95",
                selectedOption === null ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              <span>{showResult ? (currentQuestionIndex === questions.length - 1 ? "Voir les Résultats" : "Question Suivante") : "Valider la Réponse"}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
