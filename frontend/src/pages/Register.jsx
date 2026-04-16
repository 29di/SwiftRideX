import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await authService.register({ fullName, email, password });
      const token =
        response?.token ||
        response?.data?.token ||
        response?.accessToken ||
        response?.data?.accessToken;

      if (token) {
        localStorage.setItem('swiftridex_token', token);
        localStorage.setItem('swiftridex_user_email', email);
      }

      setSuccessMessage('Registration successful. Your account is ready.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-4 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />

      <section className="relative w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-800/90 p-8 shadow-2xl shadow-blue-950/30 backdrop-blur">
        <div className="mb-8 space-y-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 shadow-lg shadow-blue-900/35">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <h1 className="bg-gradient-to-r from-blue-500 to-sky-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            SwiftrideX
          </h1>
          <p className="text-sm text-slate-300">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-200">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-400 transition duration-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-400 transition duration-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-400 transition duration-200 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-sky-300 hover:shadow-blue-700/40 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        {successMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-semibold text-sky-300 transition hover:text-sky-200"
          >
            Login
          </button>
        </p>
      </section>
    </main>
  );
}
