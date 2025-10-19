import React, { useEffect, useRef } from 'react';
import { useStudy } from '../context/StudyContext';

function FusionSensor() {
  const { currentSession, currentVideo, videoTime, isPaused, visualPredictions, passivePredictions, recordFusedPrediction } = useStudy();
  const lastBoundaryRef = useRef(-1);
  const apiHostRef = useRef(import.meta?.env?.VITE_ACTIVE_API || 'http://localhost:8001');
  const sendingBoundaryRef = useRef(null);

  useEffect(() => {
    lastBoundaryRef.current = -1;
  }, [currentVideo?.id]);

  useEffect(() => {
    if (!currentSession || !currentVideo) return;
    if (isPaused) return;
    const t = Math.floor(videoTime || 0);
    if (t <= 0) return;
    const boundarySec = Math.floor(t / 12) * 12; // 12,24,36,...
    if (boundarySec <= 0) return;
    if (boundarySec === lastBoundaryRef.current) return;
    if (sendingBoundaryRef.current === boundarySec) return;

    const send = async () => {
      try {
        sendingBoundaryRef.current = boundarySec;

        // wait up to ~900ms for exact-at-boundary visual/passive to arrive
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        let attempts = 0;

        // Smart pick: prefer exact boundary match, else closest <= boundary, else closest > boundary within +2s
        const pickAtBoundary = (list) => {
          if (!Array.isArray(list)) return null;
          const sameVideo = list.filter(p => (p?.videoId === currentVideo?.id) && typeof p?.videoTimeSec === 'number');
          if (!sameVideo.length) return null;
          const exact = [...sameVideo].reverse().find(p => p.videoTimeSec === boundarySec);
          if (exact) return exact;
          const before = [...sameVideo].filter(p => p.videoTimeSec <= boundarySec);
          if (before.length) {
            return before.reduce((a, b) => (a.videoTimeSec > b.videoTimeSec ? a : b));
          }
          const after = [...sameVideo].filter(p => p.videoTimeSec > boundarySec && p.videoTimeSec <= boundarySec + 2);
          if (after.length) {
            return after.reduce((a, b) => (a.videoTimeSec < b.videoTimeSec ? a : b));
          }
          return null;
        };

        let latestVisual = null;
        let latestPassive = null;
        while (attempts < 20) { // 20 * 150ms ≈ 3000ms max wait
          latestVisual = pickAtBoundary(visualPredictions);
          latestPassive = pickAtBoundary(passivePredictions);
          const hasExactVisual = latestVisual && latestVisual.videoTimeSec === boundarySec;
          const hasAny = !!latestVisual || !!latestPassive;
          if (hasExactVisual || (hasAny && attempts >= 10)) { // give at least ~1500ms to try for exact visual
            break;
          }
          attempts += 1;
          await sleep(150);
        }
        if (!latestVisual && !latestPassive) {
          sendingBoundaryRef.current = null;
          return;
        }

        const payload = {
          visual: latestVisual ? {
            valence: typeof latestVisual?.valence === 'number' ? latestVisual.valence : 0,
            arousal: typeof latestVisual?.arousal === 'number' ? latestVisual.arousal : 0,
            confidence: typeof latestVisual?.confidence === 'number' ? Math.max(0, Math.min(1, latestVisual.confidence)) : 0
          } : null,
          passive: latestPassive ? {
            valence: typeof latestPassive?.valence === 'number' ? latestPassive.valence : 0,
            arousal: typeof latestPassive?.arousal === 'number' ? latestPassive.arousal : 0
          } : null,
          videoId: currentVideo?.id || null,
          videoTimeSec: boundarySec
        };

        const res = await fetch(`${apiHostRef.current}/fusion/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) return;
        const json = await res.json();
        const fused = {
          id: `fused_${Date.now()}`,
          at: new Date().toISOString(),
          videoId: currentVideo?.id || null,
          videoTimeSec: boundarySec,
          valence: typeof json?.valence === 'number' ? json.valence : null,
          arousal: typeof json?.arousal === 'number' ? json.arousal : null,
          discreteEmotion: json?.discrete_emotion || null,
          fusionConfidence: typeof json?.fusion_confidence === 'number' ? json.fusion_confidence : null,
          strategy: json?.strategy || 'rule_based'
        };
        recordFusedPrediction(fused);
        lastBoundaryRef.current = boundarySec;
        sendingBoundaryRef.current = null;
      } catch (_) {}
    };

    send();
  }, [videoTime, isPaused, currentSession, currentVideo, visualPredictions, passivePredictions, recordFusedPrediction]);

  return null;
}

export default FusionSensor;
