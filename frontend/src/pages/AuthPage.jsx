import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles, User, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../services/api';

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, register, setSessionError, sessionError } = useAuth();
  const [role, setRole] = useState('rider');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const isRegister = mode === 'register';
  const title = useMemo(() => {
    if (role === 'driver') {
      return isRegister ? 'Create driver account' : 'Driver login';
    }

    return isRegister ? 'Create rider account' : 'Rider login';
  }, [isRegister, role]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setFormError('');
    setSessionError('');

    try {
      if (isRegister) {
        const payload = role === 'rider' ? form : { email: form.email, password: form.password };
        await register(role, payload);
        setMode('login');
        setForm((current) => ({ ...current, password: '' }));
        return;
      }

      const session = await login(role, {
        email: form.email,
        password: form.password,
      });

      navigate(session.role === 'driver' ? '/driver' : '/rider');
    } catch (error) {
      const message = getApiErrorMessage(error);
      setFormError(message);
      setSessionError(message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;

    const initializeGoogle = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            return;
          }

          setGoogleLoading(true);
          setGoogleError('');
          setFormError('');
          setSessionError('');

          try {
            const session = await loginWithGoogle(response.credential);
            if (!rememberMe) {
              sessionStorage.setItem('swiftridex_google_session', JSON.stringify(session));
            }
            navigate('/rider');
          } catch (error) {
            const message = getApiErrorMessage(error);
            setGoogleError(message);
            setSessionError(message);
          } finally {
            setGoogleLoading(false);
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        text: 'continue_with',
        shape: 'pill',
        size: 'large',
        width: 300,
        theme: 'outline',
      });
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => {
      if (!cancelled) {
        setGoogleError('Unable to load Google sign-in. Please try email login.');
      }
    };

    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [googleClientId, loginWithGoogle, navigate, rememberMe, setSessionError]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl grid-cols-1 md:grid-cols-2">
        <section className="hidden md:flex md:items-center md:pr-10">
          <div className="w-full max-w-xl space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">
              <Sparkles className="h-4 w-4" />
              Premium ride platform
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                SwiftrideX brings riders and drivers into one refined live experience.
              </h1>
              <p className="text-base leading-7 text-slate-300">
                Built for a modern ride-hailing flow with real-time status updates, driver assignment, and a premium dark interface tuned for speed.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                { icon: ShieldCheck, title: 'Trusted auth', text: 'Role-aware login and session handling.' },
                { icon: UsersRound, title: 'Live tracking', text: 'Socket-driven ride state updates.' },
                { icon: Users, title: 'Driver-first', text: 'Status and location controls built in.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-brand-500/10 p-2 ring-1 ring-brand-400/20">
                        <Icon className="h-4 w-4 text-brand-300" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center py-4 md:py-0">
          <Card className="w-full max-w-md p-6 sm:p-7">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="section-label">Authentication</div>
                  <h2 className="mt-2 text-3xl font-bold text-white">{title}</h2>
                </div>
                <div className="rounded-xl bg-brand-500/10 p-2 ring-1 ring-brand-400/20 md:hidden">
                  <Sparkles className="h-4 w-4 text-brand-300" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {['rider', 'driver'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      role === value ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {value === 'rider' ? 'Rider' : 'Driver'}
                  </button>
                ))}
              </div>

              <div className="flex rounded-2xl border border-white/10 bg-slate-950/40 p-1">
                {['login', 'register'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      mode === value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {value === 'login' ? 'Login' : 'Register'}
                  </button>
                ))}
              </div>

              <form className="space-y-4" onSubmit={submit}>
                {isRegister && role === 'rider' ? (
                  <Input label="Full name" icon={User} value={form.fullName} onChange={updateField('fullName')} placeholder="Ava Thompson" />
                ) : null}
                <Input label="Email" icon={Mail} type="email" value={form.email} onChange={updateField('email')} placeholder="you@company.com" />
                <Input label="Password" icon={Lock} type="password" value={form.password} onChange={updateField('password')} placeholder="••••••••" />

                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-brand-500"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    Remember me
                  </label>
                  <button type="button" className="text-sm text-brand-300 transition hover:text-brand-200">
                    Forgot password?
                  </button>
                </div>

                {(formError || sessionError) && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {formError || sessionError}
                  </div>
                )}

                {googleError ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {googleError}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Login to dashboard'}
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="relative py-1">
                  <div className="h-px w-full bg-white/10" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-midnight px-3 text-xs uppercase tracking-[0.24em] text-slate-400">
                    Or
                  </span>
                </div>

                <div className="flex justify-center">
                  {googleClientId ? (
                    <div ref={googleButtonRef} className={`transition ${googleLoading ? 'opacity-60' : ''}`} />
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                      Set VITE_GOOGLE_CLIENT_ID to enable Google login
                    </div>
                  )}
                </div>
              </form>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
