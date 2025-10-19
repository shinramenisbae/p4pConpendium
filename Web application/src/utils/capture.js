// Capture a webcam frame as a Blob using ImageCapture.grabFrame when available,
// and fall back to drawing from a provided video element or a temporary one.
export async function captureWebcamBlob({ stream, videoEl = null, type = 'image/jpeg', quality = 0.8 }) {
  try {
    if (!stream) return null;
    const track = stream.getVideoTracks?.()[0];
    if (!track) return null;

    // Prefer ImageCapture for best quality
    if (typeof window !== 'undefined' && 'ImageCapture' in window) {
      try {
        const imageCapture = new window.ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
        try { if (bitmap.close) bitmap.close(); } catch (_) {}
        return blob;
      } catch (_) {
        // fall through to canvas path
      }
    }

    // Fallback: draw current content to canvas from a video element
    let video = videoEl;
    let created = false;
    if (!video) {
      video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      created = true;
      try { await video.play().catch(() => {}); } catch (_) {}
      await new Promise((r) => setTimeout(r, 30));
    }

    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    if (created) {
      try { video.pause(); } catch (_) {}
      try { video.srcObject = null; } catch (_) {}
    }
    return blob;
  } catch (e) {
    console.warn('captureWebcamBlob failed:', e);
    return null;
  }
}


