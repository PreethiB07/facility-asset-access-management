import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PasswordInput from '../components/common/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { isValidEmail } from '../utils/validation';

const DEMO_ACCOUNTS = [
  { role: 'USER', email: 'demo.user@example.com' },
  { role: 'MANAGER', email: 'demo.manager@example.com' },
  { role: 'ADMIN', email: 'demo.admin@example.com' },
] as const;

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !loading) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to sign in. Please check your credentials and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoEmail(demoEmail: string) {
    setEmail(demoEmail);
    setFieldErrors({});
    setError('');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg" aria-hidden="true">
            FA
          </span>
          <div>
            <p className="auth-app-name">Facility Access</p>
            <h1>Sign in</h1>
            <p className="text-muted">Access your facility and asset permissions</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">
              Email <span className="required-indicator">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <PasswordInput
            id="password"
            label="Password"
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>

        {import.meta.env.DEV && (
          <aside className="demo-accounts-hint" aria-label="Development demo accounts">
            <h2>Demo Accounts</h2>
            <p className="text-muted">Development only — see docs/demo-accounts.md for passwords.</p>
            <ul className="demo-account-list">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.role}>
                  <button
                    type="button"
                    className="demo-account-btn"
                    onClick={() => fillDemoEmail(account.email)}
                  >
                    <span className="role-badge role-badge-sm">{account.role}</span>
                    {account.email}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
