import React, { useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { Mail, Lock, Loader2, AlertCircle, User } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (isRegistering && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setIsLoading(false);
      return;
    }

    try {
      let user;
      if (isRegistering) {
        user = await api.auth.register({ name, email, password });
      } else {
        user = await api.auth.login({ email, password });
      }
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-bold text-slate-900 mb-2 tracking-tight">
            {isRegistering ? "Rejoignez-nous" : "Bienvenue"}
          </h1>
          <p className="text-slate-500 font-medium">
            Plateforme pédagogique interactive
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                  placeholder="Votre nom complet"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mot de passe {isRegistering && ""}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Répéter le mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? "S'inscrire" : "Se connecter")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-all"
          >
            {isRegistering ? "Vous avez déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
