import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

const MP4Player = forwardRef(
  ({ 
    videoSrc, 
    onVideoEnd, 
    onVideoPause, 
    onVideoPlay, 
    onTimeUpdate, 
    isPaused = false, 
    onReady 
  }, ref) => {
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle video ready event
  const onVideoReady = () => {
    const video = videoRef.current;
    setDuration(video.duration);
    if (onReady) onReady(video);
  };

  // Handle time update event
  const onTimeUpdateHandler = () => {
    const video = videoRef.current;
    const time = video.currentTime;
    setCurrentTime(time);
    if (onTimeUpdate) onTimeUpdate(time);
  };

  // Handle video state changes (play/pause/end)
  const onVideoPlayHandler = () => {
    setIsPlaying(true);
    if (onVideoPlay) onVideoPlay();
  };

  const onVideoPauseHandler = () => {
    setIsPlaying(false);
    if (onVideoPause) onVideoPause();
  };

  const onVideoEndedHandler = () => {
    setIsPlaying(false);
    if (onVideoEnd) onVideoEnd();
  };

  // Control video pause/play based on `isPaused`
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (isPaused) {
        video.pause();
      } else if (isPlaying) {
        video.play();
      }
    }
  }, [isPaused, isPlaying]);

  // Public methods for external control (play, pause, seek, etc.)
  const playVideo = () => {
    const video = videoRef.current;
    if (video) {
      video.play();
    }
  };

  const pauseVideo = () => {
    console.log("mp4 pause");
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
  };

  const seekTo = (seconds) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = seconds;
    }
  };

  const getCurrentTime = () => {
    const video = videoRef.current;
    return video ? video.currentTime : 0;
  };

  const getDuration = () => {
    const video = videoRef.current;
    return video ? video.duration : 0;
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    playVideo,
    pauseVideo,
    seekTo,
    getCurrentTime,
    getDuration
  }));

  return (
    <div className="video-player-container">
      <video
        ref={videoRef}
        src={videoSrc}
        onLoadedMetadata={onVideoReady}
        onPlay={onVideoPlayHandler}
        onPause={onVideoPauseHandler}
        onEnded={onVideoEndedHandler}
        onTimeUpdate={onTimeUpdateHandler}
        controls
        className="video-player"
        width="1120"
        height="630"
      />
      <div className="player-info">
        <div>Current Time: {Math.floor(currentTime)}s</div>
        <div>Duration: {Math.floor(duration)}s</div>
        <div>Status: {isPlaying ? 'Playing' : 'Paused'}</div>
      </div>
    </div>
  );
});

MP4Player.displayName = 'MP4Player';

export default MP4Player;
