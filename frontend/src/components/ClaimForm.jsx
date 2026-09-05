import { useState } from 'react';

export default function ClaimForm({ onCreate }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dateOfLoss, setDateOfLoss] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onCreate({ description, amount: Number(amount), dateOfLoss: dateOfLoss || undefined });
      setDescription('');
      setAmount('');
      setDateOfLoss('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card claim-form" onSubmit={handleSubmit}>
      <h2>Submit a claim</h2>

      <label htmlFor="description">Description</label>
      <input
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      <label htmlFor="amount">Amount ($)</label>
      <input
        id="amount"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      <label htmlFor="dateOfLoss">Date of loss</label>
      <input
        id="dateOfLoss"
        type="date"
        value={dateOfLoss}
        onChange={(e) => setDateOfLoss(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit claim'}
      </button>
    </form>
  );
}
