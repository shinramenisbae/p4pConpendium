import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import YouTube from 'react-youtube';

const YouTubePlayer = forwardRef(({ 
  videoId, 
  onVideoEnd, 
  onVideoPause, 
  onVideoPlay, 
  onTimeUpdate,
  isPaused = false,
  onReady,
  onDuration
}, ref) => {
  const [player, setPlayer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // YouTube player options
  const opts = {
    height: '630',
    width: '1120',
    playerVars: {
      autoplay: 0,
      controls: 1,
      disablekb: 0,
      fs: 1,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
    },
  };

  // Handle player ready event
  const onPlayerReady = (event) => {
    setPlayer(event.target);
    const d = event.target.getDuration?.() || 0;
    setDuration(d);
    if (typeof onDuration === 'function') onDuration(d);
    if (onReady) onReady(event.target);
  };

  // Handle player state changes
  const onPlayerStateChange = (event) => {
    const state = event.data;
    
    // Try to refresh duration when we start playing
    if (event?.target && (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.PAUSED)) {
      const d = event.target.getDuration?.() || duration;
      if (d && d !== duration) {
        setDuration(d);
        if (typeof onDuration === 'function') onDuration(d);
      }
    }

    switch (state) {
      case window.YT.PlayerState.PLAYING:
        setIsPlaying(true);
        if (onVideoPlay) onVideoPlay();
        break;
      case window.YT.PlayerState.PAUSED:
        setIsPlaying(false);
        if (onVideoPause) onVideoPause();
        break;
      case window.YT.PlayerState.ENDED:
        if (onVideoEnd) onVideoEnd();
        break;
      default:
        break;
    }
  };

  // Handle player errors
  const onPlayerError = (error) => {
    console.error('YouTube Player Error:', error);
  };

  // Update current time every second when playing
  useEffect(() => {
    let interval;
    if (isPlaying && player) {
      interval = setInterval(() => {
        const time = player.getCurrentTime();
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, player, onTimeUpdate]);

  // Control player pause/play
  useEffect(() => {
    if (player) {
      if (isPaused) {
        player.pauseVideo();
      } else if (isPlaying) {
        player.playVideo();
      }
    }
  }, [isPaused, player, isPlaying]);

  // Public methods for external control
  const playVideo = () => {
    if (player) {
      player.playVideo();
    }
  };

  const pauseVideo = () => {
    if (player) {
      player.pauseVideo();
    }
  };

  const seekTo = (seconds) => {
    if (player) {
      player.seekTo(seconds, true);
    }
  };

  const getCurrentTime = () => {
    return player ? player.getCurrentTime() : 0;
  };

  const getDuration = () => {
    return player ? (player.getDuration?.() || duration) : duration;
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    playVideo,
    pauseVideo,
    seekTo,
    getCurrentTime,
    getDuration,
    player
  }));

  return (
    <div className="youtube-player-container">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={onPlayerReady}
        onStateChange={onPlayerStateChange}
        onError={onPlayerError}
        className="youtube-player"
      />
      <div className="player-info">
        <div>Current Time: {Math.floor(currentTime)}s</div>
        <div>Duration: {Math.floor(duration)}s</div>
        <div>Status: {isPlaying ? 'Playing' : 'Paused'}</div>
      </div>
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;

