import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimsApi } from '../services/api';
import ClaimForm from '../components/ClaimForm';
import ClaimCard from '../components/ClaimCard';

export default function ClaimsPage() {
  const { user, token } = useAuth();
  const isAdjuster = user?.role === 'adjuster';
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadClaims() {
    setLoading(true);
    setError('');
    try {
      const data = await claimsApi.getAll(token);
      setClaims(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(payload) {
    const claim = await claimsApi.create(payload, token);
    setClaims((prev) => [claim, ...prev]);
  }

  async function handleStatusChange(id, status) {
    const updated = await claimsApi.updateStatus(id, status, token);
    setClaims((prev) => prev.map((c) => (c._id === id ? updated : c)));
  }

  async function handleDelete(id) {
    await claimsApi.remove(id, token);
    setClaims((prev) => prev.filter((c) => c._id !== id));
  }

  return (
    <div className="claims-page">
      <h1>{isAdjuster ? 'All claims' : 'My claims'}</h1>

      {!isAdjuster && <ClaimForm onCreate={handleCreate} />}

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading claims...</p>
      ) : claims.length === 0 ? (
        <p>No claims yet.</p>
      ) : (
        <div className="claim-list">
          {claims.map((claim) => (
            <ClaimCard
              key={claim._id}
              claim={claim}
              isAdjuster={isAdjuster}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
