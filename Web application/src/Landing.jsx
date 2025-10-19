import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function Landing() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleParticipant = () => {
    navigate('/home');
  };

  const handleAdmin = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setUsername('');
    setPassword('');
    setError('');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'p4pvlm' && password === 'p4pvlm') {
      closeModal();
      navigate('/admin');
    } else {
      setError('Invalid credentials.');
    }
  };

  return (
    <div className="landing-page">
      <div className="home-container">
        <div className="welcome-section" style={{ textAlign: 'center' }}>
          <h1>Emotion Recognition Study</h1>
          <p>Please choose how you would like to continue.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: 24 }}>
          <button className="start-button" onClick={handleParticipant}>
            Continue as Participant
          </button>
          <button className="start-button" onClick={handleAdmin}>
            Study Admin
          </button>
        </div>
      </div>

      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div 
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Admin Login</h2>
            <form onSubmit={handleLogin}>
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter username"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
              </div>
              {error && (
                <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="start-button" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="start-button">
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Landing;


