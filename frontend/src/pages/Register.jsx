import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, Mail, Lock } from 'lucide-react';

export const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await register(name, email, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-height-screen flex flex-col justify-center items-center p-6 w-full max-w-md mx-auto" style={{ minHeight: '85vh' }}>
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' }}>
          <Shield className="w-8 h-8 text-neutral-900" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-sans text-white">SafeNova AI</h1>
          <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Jarvis Safety Guard</p>
        </div>
      </div>

      <div className="glass-panel w-full p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white">Create Guardian Account</h2>
          <p className="text-xs text-slate-400">Initialize always-on voice emergency routing and setup your safety details.</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-950/40 border border-red-800 text-red-400 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-lg text-xs font-semibold">
            Guardian profile created successfully! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Full Name</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-500"><User className="w-4 h-4" /></span>
              <input 
                type="text" 
                required
                className="input-field w-full pl-10 text-sm"
                placeholder="Nova Guardian"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Email Address</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-500"><Mail className="w-4 h-4" /></span>
              <input 
                type="email" 
                required
                className="input-field w-full pl-10 text-sm"
                placeholder="guardian@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Master Key Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-500"><Lock className="w-4 h-4" /></span>
              <input 
                type="password" 
                required
                className="input-field w-full pl-10 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || success}
            className="btn-glow-primary w-full mt-2 font-bold py-3.5 cursor-pointer"
          >
            {loading ? 'Initializing Guard...' : 'Deploy System'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-cyan-400 font-bold hover:underline">
            Access Portal
          </Link>
        </div>
      </div>
    </div>
  );
};
