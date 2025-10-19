import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudy } from '../context/StudyContext';
import { captureWebcamBlob } from '../utils/capture';

function WebcamOverlay() {
  const {
    webcamStream,
    isWebcamActive,
    showWebcam,
    toggleWebcamOverlay,
    startWebcam,
    stopWebcam,
    webcamDevices,
    selectedWebcamId,
    refreshWebcamDevices,
    selectWebcam,
    webcamError,
    recordVisualPrediction,
    currentSession,
    videoTime,
    isPaused,
    currentVideo,
    participant
  } = useStudy();

  const videoRef = useRef(null);
  const [stats, setStats] = useState({ width: null, height: null, fps: null });
  const [apiHost] = useState(() => (import.meta?.env?.VITE_ACTIVE_API || 'http://localhost:8001'));
  const [lastPrediction, setLastPrediction] = useState(null);
  const [lastSendAt, setLastSendAt] = useState(null);
  const [lastSendError, setLastSendError] = useState(null);
  const [lastVideoSegmentSent, setLastVideoSegmentSent] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (webcamStream) {
      video.srcObject = webcamStream;
      const onLoaded = async () => {
        try { await video.play(); } catch (_) {}
      };
      video.onloadedmetadata = onLoaded;
      if (showWebcam) onLoaded();
    } else {
      video.srcObject = null;
    }
  }, [webcamStream, showWebcam]);

  // Update live stats (resolution, FPS)
  useEffect(() => {
    let raf;
    let lastTime = performance.now();
    let frames = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const fpsNow = Math.round((frames * 1000) / (now - lastTime));
        const track = webcamStream?.getVideoTracks?.()[0];
        const s = track?.getSettings?.() || {};
        setStats({ width: s.width || null, height: s.height || null, fps: s.frameRate ? Math.round(s.frameRate) : fpsNow || null });
        lastTime = now;
        frames = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    if (webcamStream) raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [webcamStream]);

  // Ensure devices are populated
  useEffect(() => { refreshWebcamDevices(); }, [refreshWebcamDevices]);

  // Send one frame now using ImageCapture (with fallback)
  const sendOneFrame = async () => {
    try {
      if (!isWebcamActive || !webcamStream || !videoRef.current) return false;
      const blob = await captureWebcamBlob({ stream: webcamStream, videoEl: videoRef.current, type: 'image/jpeg', quality: 0.92 });
      if (!blob) return false;
      const form = new FormData();
      form.append('image_file', new File([blob], 'frame.jpg', { type: 'image/jpeg' }));
      // Use the user-entered participant ID (name from Home.jsx)
      if (participant?.name) {
        form.append('pid', participant.name);
      } else if (participant?.id) {
        form.append('pid', participant.id);
      }
      if (currentVideo?.id) form.append('video_id', currentVideo.id);
      form.append('video_time_sec', String(Math.floor(videoTime || 0)));
      const res = await fetch(`${apiHost}/predict`, { method: 'POST', body: form });
      if (!res.ok) {
        setLastSendError(`${res.status} ${res.statusText}`);
        return false;
      }
      const json = await res.json();
      setLastSendError(null);
      setLastSendAt(new Date().toISOString());
      if (json?.success) {
        const primary = json.primary || null;
        const prediction = {
          id: `visual_${Date.now()}`,
          at: new Date().toISOString(),
          videoId: currentVideo?.id || null,
          videoTimeSec: Math.floor(videoTime || 0),
          emotion: primary?.emotion || null,
          confidence: primary?.confidence ?? null,
          valence: primary?.valence ?? null,
          arousal: primary?.arousal ?? null,
          faces: json.faces?.length ?? 0
        };
        recordVisualPrediction(prediction);
        setLastPrediction(primary || null);
      }
      return true;
    } catch (e) {
      setLastSendError(String(e?.message || e));
      return false;
    }
  };

  // Reset the sent segment marker when the current video changes
  useEffect(() => {
    setLastVideoSegmentSent(-1);
  }, [currentVideo?.id]);

  // Trigger a capture every 12 video seconds while playing
  useEffect(() => {
    if (!isWebcamActive || !webcamStream || !videoRef.current || !currentSession) return;
    if (isPaused) return;
    const t = Math.floor(videoTime || 0);
    if (t <= 0) return;
    const segmentIndex = Math.floor(t / 12);
    if (segmentIndex <= 0) return; // first send at 12s
    if (segmentIndex !== lastVideoSegmentSent) {
      setLastVideoSegmentSent(segmentIndex);
      // fire and forget; guard against overlapping by using segment gate above
      void sendOneFrame();
    }
  }, [videoTime, isWebcamActive, webcamStream, isPaused, currentSession, lastVideoSegmentSent]);

  const containerStyle = {
    position: 'fixed',
    top: 8,
    left: 8,
    zIndex: 1000
  };

  const buttonStyle = {
    padding: '6px 10px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
  };

  const panelStyle = {
    marginTop: 8,
    width: 300,
    height: 260,
    background: '#111',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #333',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  };

  const videoStyle = {
    width: '100%',
    height: 170,
    objectFit: 'cover',
    transform: 'scaleX(-1)'
  };

  const label = useMemo(() => {
    const current = webcamDevices.find(d => d.deviceId === selectedWebcamId);
    return current?.label || 'Default Camera';
  }, [webcamDevices, selectedWebcamId]);

  const handleStart = async () => {
    try { await startWebcam(selectedWebcamId || undefined); } catch (_) {}
  };

  const statusStyle = { color: isWebcamActive ? '#2ecc71' : '#e74c3c', fontSize: 12 };
  const small = { fontSize: 11, color: '#ccc' };

  return (
    <div style={containerStyle}>
      <button style={buttonStyle} onClick={toggleWebcamOverlay}>
        {showWebcam ? 'Hide Webcam' : 'Show Webcam'}
      </button>
      <div style={{ ...panelStyle, display: showWebcam ? 'block' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#1a1a1a', borderBottom: '1px solid #222' }}>
            <span style={statusStyle}>{isWebcamActive ? 'Live' : 'Offline'}</span>
            <span style={small}>{stats.width && stats.height ? `${stats.width}x${stats.height}` : ''}{stats.fps ? ` @ ${stats.fps}fps` : ''}</span>
          </div>
          <video ref={videoRef} autoPlay muted playsInline style={videoStyle} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 8 }}>
            <select
              value={selectedWebcamId || ''}
              onChange={(e) => selectWebcam(e.target.value || null)}
              style={{ flex: 1, fontSize: 12, padding: '4px 6px', background: '#1a1a1a', color: '#eee', border: '1px solid #333', borderRadius: 6 }}
            >
              <option value="">Default Camera</option>
              {webcamDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera (${d.deviceId.slice(0,6)}...)`}</option>
              ))}
            </select>
            <button onClick={handleStart} style={{ ...buttonStyle, padding: '4px 8px' }}>Start</button>
            <button onClick={stopWebcam} style={{ ...buttonStyle, padding: '4px 8px' }}>Stop</button>
            <button onClick={sendOneFrame} style={{ ...buttonStyle, padding: '4px 8px' }}>Test Send</button>
          </div>
          <div style={{ padding: '0 8px 8px 8px' }}>
            {lastPrediction ? (
              <span style={{
                display: 'inline-block',
                background: '#222',
                color: '#eee',
                border: '1px solid #333',
                borderRadius: 12,
                padding: '4px 8px',
                fontSize: 12,
                marginRight: 8
              }}>
                Last prediction: {String(lastPrediction.emotion || 'n/a')} ({typeof lastPrediction.confidence === 'number' ? `${(lastPrediction.confidence * 100).toFixed(1)}%` : 'n/a'})
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#999' }}>No prediction yet</span>
            )}
            {lastSendAt && (
              <span style={{ fontSize: 12, color: '#777', marginLeft: 8 }}>Last send: {new Date(lastSendAt).toLocaleTimeString()}</span>
            )}
            {lastSendError && (
              <div style={{ color: '#ff7675', fontSize: 12, marginTop: 4 }}>Send error: {lastSendError}</div>
            )}
          </div>
          {webcamError && (
            <div style={{ padding: '0 8px 8px 8px' }}>
              <div style={{ color: '#ff7675', fontSize: 12 }}>{webcamError}</div>
            </div>
          )}
      </div>
    </div>
  );
}

export default WebcamOverlay;





