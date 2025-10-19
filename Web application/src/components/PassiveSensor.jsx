import React, { useEffect, useRef } from 'react';
import { useStudy } from '../context/StudyContext';

function PassiveSensor() {
  const { currentSession, currentVideo, videoTime, isPaused, recordPassivePrediction } = useStudy();
  const lastBoundaryRef = useRef(-1);
  const apiHostRef = useRef(import.meta?.env?.VITE_ACTIVE_API || 'http://localhost:8001');

  useEffect(() => {
    // reset per video
    lastBoundaryRef.current = -1;
  }, [currentVideo?.id]);

  useEffect(() => {
    if (!currentSession || !currentVideo) return;
    if (isPaused) return;
    const t = Math.floor(videoTime || 0);
    if (t <= 0) return;
    const boundarySec = Math.floor(t / 12) * 12; // 12s boundaries: 12,24,36,...
    if (boundarySec <= 0) return;
    if (boundarySec === lastBoundaryRef.current) return;

    // gate immediately to avoid duplicate calls in the same second
    lastBoundaryRef.current = boundarySec;

    const send = async () => {
      try {
        const res = await fetch(`${apiHostRef.current}/passive/predict`, { method: 'GET' });
        if (!res.ok) return;
        const json = await res.json();
        const prediction = {
          id: `passive_${Date.now()}`,
          at: new Date().toISOString(),
          videoId: currentVideo?.id || null,
          videoTimeSec: boundarySec,
          valence: typeof json?.valence === 'number' ? json.valence : null,
          arousal: typeof json?.arousal === 'number' ? json.arousal : null,
          source: json?.simulated ? 'simulated' : 'cnn'
        };
        recordPassivePrediction(prediction);
      } catch (_) {
        // swallow errors to avoid UI noise
      }
    };

    send();
  }, [videoTime, isPaused, currentSession, currentVideo, recordPassivePrediction]);

  return null;
}

export default PassiveSensor;
