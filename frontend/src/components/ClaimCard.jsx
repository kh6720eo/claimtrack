const STATUS_OPTIONS = ['submitted', 'in_review', 'approved', 'denied'];

const STATUS_LABELS = {
  submitted: 'Submitted',
  in_review: 'In review',
  approved: 'Approved',
  denied: 'Denied',
};

export default function ClaimCard({ claim, isAdjuster, onStatusChange, onDelete }) {
  return (
    <div className="card claim-card">
      <div className="claim-card-header">
        <h3>{claim.description}</h3>
        <span className={`badge badge-status badge-${claim.status}`}>
          {STATUS_LABELS[claim.status] ?? claim.status}
        </span>
      </div>
      <p className="claim-amount">${Number(claim.amount).toFixed(2)}</p>
      {claim.dateOfLoss && (
        <p className="claim-meta">Date of loss: {new Date(claim.dateOfLoss).toLocaleDateString()}</p>
      )}

      {isAdjuster && (
        <div className="claim-actions">
          <label htmlFor={`status-${claim._id}`}>Update status</label>
          <select
            id={`status-${claim._id}`}
            value={claim.status}
            onChange={(e) => onStatusChange(claim._id, e.target.value)}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-danger" onClick={() => onDelete(claim._id)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
