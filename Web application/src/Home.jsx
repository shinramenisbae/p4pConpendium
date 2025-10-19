import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useStudy } from './context/StudyContext';
import './App.css';
import videoJson from "./videos/videos.json";
import valenceSAM from './assets/SAMValence.png';
import arousalSAM from './assets/SAMArousal.png';

function Home() {
  const navigate = useNavigate();

  const { setParticipant, startSession, setStudyPhase, startWebcam } = useStudy();
  const [participantId, setParticipantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const videoList = videoJson.sort(() => Math.random() - 0.5);
  const videoList = videoJson;
  console.log('Home component rendering');

  const handleStartStudy = async () => {
    if (!participantId.trim()) {
      alert('Please enter your name to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create participant object
      const participant = {
        id: `participant_${Date.now()}`,
        name: participantId.trim(),
        registrationDate: new Date().toISOString()
      };

      console.log('Creating participant:', participant);

      // Set participant in context
      setParticipant(participant);

      // Start study session
      const session = startSession(participant.id);
      console.log('Started session:', session);

      // Update study phase
      setStudyPhase('video');

      // Start webcam (non-blocking). If permission denied, continue.
      try { await startWebcam(); } catch (e) { console.warn('Webcam start failed:', e); }

      console.log('Navigating to player...');
      // Navigate to player
      navigate("/player", {
            state:{
                links: videoList,
                id: participantId,
        }});
    } catch (error) {
      console.error('Error starting study:', error);
      alert('Error starting study. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleStartStudy();
    }
  };

  return (
    <div className="home-container">
      <div className="welcome-section">
        <h1>Emotion Recognition Study</h1>
        <p>Welcome! This study will help us understand how different videos affect emotional responses.</p>
        <p>You will watch several videos and rate your emotions using the SAM scale.</p>
      </div>

      <div className="registration-form">
        <h2>Participant Registration</h2>
        <div className="input-group">
          <label htmlFor="name">Please enter your given ID:</label>
          <input
            type="text"
            id="name"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your ID"
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>
        
        <button 
          className="start-button"
          onClick={handleStartStudy}
          disabled={isSubmitting || !participantId.trim()}
        >
          {isSubmitting ? 'Starting...' : 'Start Study'}
        </button>
      </div>

      <div className="study-info">
        <h3>What to Expect:</h3>
        <ul>
          <li>You'll watch several videos</li>
          <li>Disclaimer: Videos may be disturbing</li>
          <li>Every minute, videos will pause for emotion ratings</li>
          <li>Use the SAM scale to rate your valence and arousal</li>
          <li>
            <div>The valence scale is how negative or positive the feeling is</div>
            <img src={valenceSAM} alt="Valence SAM Scale" className="egImage"/>
          </li>
          <li>
            <div>The arousal scale is how calm or intense the feeling is</div>
            <img src={arousalSAM} alt="Arousal SAM Scale" className="egImage"/>
          </li>
          <li>The study takes approximately 40 minutes</li>
          <li>You can pause and resume at any time</li>
        </ul>
      </div>
    </div>
  );
}

export default Home;

//what to expect, what they need to do, show sam, assign id instead of name, show countdown towards sam at like 5 seconds so not jumpscare.