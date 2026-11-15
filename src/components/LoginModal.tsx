import React, { useState } from 'react';
import { soundManager } from '../utils/audio';
import { KeyRound, User, Mail, ArrowRight, ShieldCheck, Loader2, X } from 'lucide-react';
import { loginWithFirebaseEmail, registerWithFirebaseEmail } from '../utils/auth';
import { UserAccount } from '../types/casino';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (account: UserAccount) => void;
  canClose?: boolean;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onSuccess,
  canClose = false,
  onClose
}) => {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (tab === 'LOGIN') {
        const result = await loginWithFirebaseEmail(email, password);
        if (result.success && result.account) {
          soundManager.playWin();
          onSuccess(result.account);
        } else {
          soundManager.playLoss();
          setErrorMessage(result.error || 'Falha ao entrar na conta.');
        }
      } else {
        const result = await registerWithFirebaseEmail(username, email, password);
        if (result.success && result.account) {
          soundManager.playWin();
          onSuccess(result.account);
        } else {
          soundManager.playLoss();
          setErrorMessage(result.error || 'Falha ao criar conta.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#280b06] via-[#180503] to-[#0c0201] border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl space-y-4">
        {canClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 p-1.5 rounded-lg text-orange-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Banner */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-600/40 border border-amber-300 mx-auto">
            <span className="text-slate-950 font-cinzel font-black text-2xl">♠</span>
          </div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
            Sapecas Cassino
          </h2>
          <p className="text-xs text-orange-200/80">
            Entre com E-mail e Senha ou crie sua conta para receber <strong>10.000 fichas grátis</strong>!
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#120302] border border-orange-500/20 rounded-xl">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setTab('LOGIN');
              setErrorMessage('');
            }}
            className={`py-1.5 text-xs font-cinzel font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'LOGIN'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-orange-300/80 hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setTab('REGISTER');
              setErrorMessage('');
            }}
            className={`py-1.5 text-xs font-cinzel font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'REGISTER'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-orange-300/80 hover:text-white'
            }`}
          >
            Criar Conta (+10k)
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-red-950/85 border border-red-500/60 text-red-200 text-xs text-center font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'REGISTER' && (
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-orange-300/80 block uppercase tracking-wider">
                Nome de Usuário
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-orange-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: MestreDasCartas"
                  className="w-full pl-9 pr-3 py-2 bg-[#1d0604] border border-orange-500/30 rounded-xl text-xs text-orange-100 placeholder-orange-300/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
                />
              </div>
            </div>
          )}

          <div className="space-y-1 text-left">
            <label className="text-[11px] font-bold text-orange-300/80 block uppercase tracking-wider">
              {tab === 'LOGIN' ? 'E-mail (ou Usuário Local)' : 'E-mail'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-orange-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={tab === 'REGISTER' ? 'email' : 'text'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full pl-9 pr-3 py-2 bg-[#1d0604] border border-orange-500/30 rounded-xl text-xs text-orange-100 placeholder-orange-300/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[11px] font-bold text-orange-300/80 block uppercase tracking-wider">
              Senha
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-orange-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={tab === 'REGISTER' ? 6 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'REGISTER' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                className="w-full pl-9 pr-3 py-2 bg-[#1d0604] border border-orange-500/30 rounded-xl text-xs text-orange-100 placeholder-orange-300/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-slate-950 font-cinzel font-black text-sm shadow-xl shadow-orange-500/30 transition-all cursor-pointer border border-yellow-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Conectando ao Firebase...</span>
              </>
            ) : (
              <>
                <span>{tab === 'LOGIN' ? 'Acessar Cassino ♠' : 'Cadastrar e Ganhar 10.000 Fichas 🪙'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-orange-300/60 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cassino 100% Social · Fichas Fictícias · Sincronizado no Firebase</span>
        </div>
      </div>
    </div>
  );
};
