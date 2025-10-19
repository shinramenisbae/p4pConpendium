import { useNavigate } from 'react-router-dom';
import './App.css';

function Ending() {
  const navigate = useNavigate();

  const handleReturnHome = () => {
    navigate('/home');
  };

  return (
    <div className="landing-page">
      <div className="home-container">
        <div className="welcome-section" style={{ textAlign: 'center' }}>
          <h1>Thank You for Participating!</h1>
          <p>Your responses have been recorded.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: 24 }}>
          <button className="start-button" onClick={handleReturnHome}>
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Ending;
