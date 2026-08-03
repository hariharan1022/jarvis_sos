import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
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
          <h2 className="text-xl font-bold text-white">Welcome back</h2>
          <p className="text-xs text-slate-400">Secure authorization required to sync emergency contacts and voice controls.</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-950/40 border border-red-800 text-red-400 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Email Address</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-500"><Mail className="w-4 h-4" /></span>
              <input 
                type="email" 
                required
                className="input-field w-full pl-10 text-sm"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Access Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-500"><Lock className="w-4 h-4" /></span>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                className="input-field w-full pl-10 pr-10 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-glow-primary w-full mt-2 font-bold py-3.5 cursor-pointer"
          >
            {loading ? 'Authorizing Secure Shell...' : 'Access Dashboard'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          First time protecting your safety?{' '}
          <Link to="/register" className="text-cyan-400 font-bold hover:underline">
            Register Guardian Card
          </Link>
        </div>
      </div>
      
      {/* Short Link to anonymous tracking dashboard */}
      <div className="mt-8 text-center text-xs">
        <Link to="/guardian" className="text-slate-400 hover:text-cyan-400 transition-colors">
          Track Active SOS Incident via Code
        </Link>
      </div>
    </div>
  );
};
