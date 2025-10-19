import { useState, useRef, useEffect } from 'react';
import { captureWebcamBlob } from './utils/capture';
import { useStudy } from './context/StudyContext';
import { exportAllData } from './utils/localStorage';
import YouTubePlayer from './components/YouTubePlayer';
import MP4Player from './components/MP4Player';
import SAMPopup from './SAMScale/SAMPopup';
import './App.css';
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';

//temp mp4

import PassiveSensor from './components/PassiveSensor';
import FusionSensor from './components/FusionSensor';

import HVHA1 from "./videos/HVHA1.mp4";
import HVHA2 from "./videos/HVHA2.mp4";
import HVLA1 from "./videos/HVLA1.mp4";
import HVLA2 from "./videos/HVLA2.mp4";
import LVHA1 from "./videos/LVHA1.mp4";
import LVHA2 from "./videos/LVHA2.mp4";
import LVLA1 from "./videos/LVLA1.mp4";
import LVLA2 from "./videos/LVLA2.mp4";

function Player() {
  const studyContext = useStudy();
  const videoSources = {
    'HVHA1': HVHA1,
    'HVHA2': HVHA2,
    'HVLA1': HVLA1,
    'HVLA2': HVLA2,
    'LVHA1': LVHA1,
    'LVHA2': LVHA2,
    'LVLA1': LVLA1,
    'LVLA2': LVLA2,
  };
  // Destructure with default values to prevent null reference errors
  const { 
    participant = null, 
    currentSession = null, 
    currentVideo = null, 
    videoTime = 0, 
    isPaused = false, 
    setCurrentVideo = () => {}, 
    setVideoTime = () => {}, 
    setPaused = () => {},
    setStudyPhase = () => {},
    recordRating = () => {}
  } = studyContext || {};

  const [isSAMOpen, setIsSAMOpen] = useState(false);
  const [showPauseMessage, setShowPauseMessage] = useState(false);
  const [lastRatingTime, setLastRatingTime] = useState(0);
  const lastRatingTimeRef = useRef(0);
  const [debugInfo, setDebugInfo] = useState('');
  const location = useLocation();
  const links = location.state?.links || [];
  const participantId = location.state?.id || [];
  const participantIdInt = parseInt(participantId, 10);
  const [videosWatched, setVideosWatched] = useState(0);
  const [videoIndex, setVideoIndex] = useState(participantIdInt);
  const playerRef = useRef(null);
  const [advanceAfterSAM, setAdvanceAfterSAM] = useState(false);
  const [duration, setDuration] = useState(0);
  const [endStudy, setEndStudy] = useState(false);

useEffect(() => {
    if (!currentVideo && setCurrentVideo) {
      setCurrentVideo(links[videoIndex] || null);
    }
  }, [currentVideo, setCurrentVideo, videoIndex]);

  const navigate = useNavigate();
  // Reset the last 60s checkpoint whenever the video changes
  useEffect(() => {
    setLastRatingTime(0);
  }, [currentVideo?.id]);

  // Handle video time updates
 const handleTimeUpdate = (time) => {
  const currentTime = Math.floor(time || 0);
  setVideoTime(currentTime);

  if (
    currentTime > 0 &&
    currentTime % 60 === 57 &&
    currentTime !== lastRatingTimeRef.current
  ) {
    toast("SAM Assessment opening soon...", { autoClose: 2000 });
    lastRatingTimeRef.current = currentTime; 
    setLastRatingTime(currentTime);   
  }
  else if (
    currentTime > 0 &&
    currentTime % 60 === 0 &&
    currentTime !== lastRatingTimeRef.current
  ) {
    setDebugInfo(`Auto-triggering rating at ${currentTime}s`);
    handlePauseForRating();
    lastRatingTimeRef.current = currentTime;
    setLastRatingTime(currentTime);
  }
};


  // Handle video end → open SAM, advance after rating
  const handleVideoEnd = () => {
    setDebugInfo('Video ended');
    setVideosWatched(videosWatched+1);
    let nextIndex = videoIndex + 1;
    if (nextIndex >= links.length){
      nextIndex = 0;
    }
    setVideoIndex(nextIndex);
    console.log(videoIndex + "video index");
    setCurrentVideo(links[nextIndex]);
    handleLastSam();
     if (videosWatched===links.length-1){
      setAdvanceAfterSAM(true);
      setEndStudy(true);
     }
  };

  const handleLastSam = () => {
      if ((videoTime%60)>15){
      setIsSAMOpen(true);
    }
  };
  // Handle video pause
  const handleVideoPause = () => {
    setDebugInfo('Video paused');
  };

  // Handle video play
  const handleVideoPlay = () => {
    setDebugInfo('Video playing');
    console.log(links.length);
    setShowPauseMessage(false);
  };

  // Pause video for rating
  const handlePauseForRating = () => {
    setDebugInfo('Attempting to pause video for rating');
    
    try {

      // && playerRef.current.player
      if (playerRef.current) {
        //playerRef.current.player.pauseVideo();
        playerRef.current.pauseVideo();
        setPaused(true);
        setShowPauseMessage(true);
        setIsSAMOpen(true);
        setDebugInfo('Video paused, SAM popup opened');
      } else {
        setDebugInfo('Player reference not available');
      }
    } catch (error) {
      setDebugInfo(`Error pausing video: ${error.message}`);
    }
  };

  // Handle SAM rating completion
  const handleSAMComplete = (valenceRating, arousalRating, freeEmotion) => {
    setDebugInfo(`Rating completed: V${valenceRating}, A${arousalRating}, Free Emotion${freeEmotion}`);

    // Persist rating against current session
    try {
      recordRating({
        videoId: currentVideo?.id || '',
        videoTimeSec: Math.floor(videoTime || 0),
        valence: valenceRating,
        arousal: arousalRating,
        freeEmotion: freeEmotion
      });
    } catch (e) {
      console.error('recordRating failed:', e);
    }
    
    setIsSAMOpen(false);
    setShowPauseMessage(false);

    // If rating was triggered at the end of a video, advance to next clip
    if (advanceAfterSAM) {
      if (endStudy){
        navigate('/ending');
      }
      let nextIndex = videoIndex + 1;
      if (nextIndex >= links.length) nextIndex = 0;
      setVideoIndex(nextIndex);
      setCurrentVideo(links[nextIndex] || null);
      setAdvanceAfterSAM(false);
      if (playerRef.current) {
        setTimeout(() => {
          playerRef.current.playVideo();
          setPaused(false);
          setDebugInfo('Next video started after end-of-video rating');
        }, 500);
      }
      return;
    }

    // Resume same video after mid-video rating
    if (playerRef.current) {
      setTimeout(() => {
        playerRef.current.playVideo();
        setPaused(false);
        setDebugInfo('Video resumed after rating');
      }, 500);
    }
  };

  // Handle manual pause/resume
  const handlePauseResume = () => {
    try {
      if (playerRef.current) {
        if (isPaused) {
          //playerRef.current.player.playVideo();
          playerRef.current.playVideo();
          setPaused(false);
          setDebugInfo('Video resumed manually');
        } else {
          //playerRef.current.player.pauseVideo();
          playerRef.current.pauseVideo();
          setPaused(true);
          setDebugInfo('Video paused manually');
        }
      } else {
        setDebugInfo('Player reference not available for manual control');
      }
    } catch (error) {
      setDebugInfo(`Error in manual control: ${error.message}`);
    }
  };

  const handlePrev = () => {
    const prev = videoIndex > 0 ? videoIndex - 1 : 0;
    setVideoIndex(prev);
    setCurrentVideo(links[prev] || null);
  };

  const handleNext = () => {
    const next = videoIndex < links.length - 1 ? videoIndex + 1 : links.length - 1;
    setVideoIndex(next);
    setCurrentVideo(links[next] || null);
  };

  // (Removed manual close handler; popup can only be closed via Submit)

  // Test function to manually open SAM popup
  const testSAMPopup = () => {
    setDebugInfo('Testing SAM popup');
    setIsSAMOpen(true);
    setShowPauseMessage(true);
  };

  // Check if participant exists before rendering
  if (!participant) {
    return (
      <div className="error-container">
        <h2>Error: No participant found</h2>
        <p>Please return to the home page and register.</p>
        <p>Debug: Context available: {studyContext ? 'Yes' : 'No'}</p>
      </div>
    );
  }

  return (
    <div className="player-container">
      <div className="player-header">
        <h2>Emotion Study - Video Player</h2>
        <div className="participant-info">
          <span>Participant: {participant?.name || 'Unknown'}</span>
          <span>Session: {currentSession?.id || 'No Session'}</span>
        </div>
      </div>

      <div className="video-section">
        {currentVideo && (
          currentVideo.type === "youtube" ? (
            <YouTubePlayer
              ref={playerRef}
              videoId={currentVideo.id}
              onVideoEnd={handleVideoEnd}
              onVideoPause={handleVideoPause}
              onVideoPlay={handleVideoPlay}
              onTimeUpdate={handleTimeUpdate}
              isPaused={isPaused}
              onDuration={(d) => setDuration(d || 0)}
            />
          ) : currentVideo.type === "mp4" ? (
              <MP4Player
              ref={playerRef}
              videoSrc={videoSources[currentVideo.name]}
              onVideoEnd={handleVideoEnd}
              onVideoPause={handleVideoPause}
              onVideoPlay={handleVideoPlay}
              onTimeUpdate={handleTimeUpdate}
              isPaused={isPaused}
              onReady={(video) => setDuration((video && video.duration) || 0)}
            />
          ) : null
        )}
        {/* Headless passive and fusion runners */}
        <PassiveSensor />
        <FusionSensor />
      </div>

      <div className="player-controls">
        <button 
          className="control-button"
          onClick={handlePauseResume}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <div className="video-info">
          <span>Current Time: {Math.floor(videoTime || 0)}s</span>
          <span>Video: {currentVideo?.name || currentVideo?.title || 'No Video'}</span>
          <span>Status: {isPaused ? 'Paused' : 'Playing'}</span>
          <span>Clip {videoIndex + 1}/{links.length}</span>
        </div>
      </div>

      {showPauseMessage && (
        <div className="pause-message">
          <h3>Time for Emotion Rating!</h3>
          <p>The video has been paused. Please rate your current emotions using the SAM scale.</p>
        </div>
      )}

      {/* Debug info */}
      <div className="debug-info" style={{ fontSize: '12px', color: '#666', marginTop: '1rem', textAlign: 'left', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
        <h4>Debug Information:</h4>
        <p>• SAM Open: {(isSAMOpen || false).toString()}</p>
        <p>• Paused: {(isPaused || false).toString()}</p>
        <p>• Last Rating Time: {lastRatingTime || 0}s</p>
        <p>• Current Time: {Math.floor(videoTime || 0)}s</p>
        <p>• Player Ref Available: {(playerRef.current !== null).toString()}</p>
        <p>• Player Instance Available: {String(Boolean(playerRef.current && playerRef.current.player))}</p>
        <p>• Participant: {participant ? 'Yes' : 'No'}</p>
        <p>• Participant Name: {participant?.name || 'N/A'}</p>
        <p>• Context Available: {studyContext ? 'Yes' : 'No'}</p>
        <p>• Debug Info: {debugInfo || 'No debug info'}</p>
      </div>

      <SAMPopup 
        open={isSAMOpen} 
        onComplete={handleSAMComplete}
        currentTime={videoTime || 0}
      />
    </div>
  );
}

export default Player;
