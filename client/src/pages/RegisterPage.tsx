import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PasswordInput from '../components/common/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import {
  isValidEmail,
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from '../utils/validation';

export default function RegisterPage() {
  const { register, isAuthenticated, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      errors.password = passwordError;
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Registration successful</h1>
          <p className="text-muted">Your account has been created. Please sign in to continue.</p>
          <Link to="/login" className="btn btn-primary btn-block">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg" aria-hidden="true">
            FA
          </span>
          <div>
            <h1>Create account</h1>
            <p className="text-muted">Register as a standard user account</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name">
              Name <span className="required-indicator">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>

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
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <PasswordInput
            id="password"
            label="Password"
            required
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            hint={PASSWORD_REQUIREMENTS}
          />

          <PasswordInput
            id="confirmPassword"
            label="Confirm password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
          />

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
