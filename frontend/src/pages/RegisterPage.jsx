import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password, form.role);
      navigate('/claims');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Name</label>
        <input id="name" value={form.name} onChange={update('name')} required />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={update('email')} required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          minLength={8}
          value={form.password}
          onChange={update('password')}
          required
        />

        <label htmlFor="role">Role</label>
        <select id="role" value={form.role} onChange={update('role')}>
          <option value="employee">Employee</option>
          <option value="adjuster">Adjuster</option>
        </select>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
