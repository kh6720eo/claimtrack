import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="header">
      <Link to="/" className="brand">
        ClaimTrack
      </Link>
      {isAuthenticated && (
        <div className="header-user">
          <span>
            {user.name} <span className="badge badge-role">{user.role}</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
