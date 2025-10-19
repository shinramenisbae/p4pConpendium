// Utility to convert a session JSON into a cleaned CSV and trigger download

const toStringOrNull = (value) => {
  if (value === null || value === undefined) return 'null';
  // Preserve numbers as plain strings, booleans as strings
  return String(value);
};

const csvEscape = (value) => {
  const str = toStringOrNull(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

const getVideoNameById = (session, videoId) => {
  if (!videoId) return 'null';
  const v = Array.isArray(session?.videos) ? session.videos.find(x => x.id === videoId) : null;
  if (v?.name) return v.name;
  try {
    const base = videoId.split('/').pop() || videoId;
    const noExt = base.includes('.') ? base.substring(0, base.lastIndexOf('.')) : base;
    return noExt || videoId;
  } catch (_) {
    return String(videoId);
  }
};

const pickSystemDatetime = (items) => {
  // Priority: fused.at > visual.at > passive.at > rating.recordedAt > session.lastUpdated > session.startTime
  const { fused, visual, passive, rating, session } = items || {};
  return fused?.at || visual?.at || passive?.at || rating?.recordedAt || session?.lastUpdated || session?.startTime || 'null';
};

const safeFilename = (name) => {
  return String(name || '')
    .replace(/[^a-zA-Z0-9-_\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'export';
};

export const downloadSessionCsv = ({ session, participantName }) => {
  if (!session) {
    throw new Error('No session provided');
  }

  // Build lookup maps keyed by `${videoId}::${videoTimeSec}` for union alignment
  const keyFor = (videoId, videoTimeSec) => `${videoId || 'null'}::${Number.isFinite(videoTimeSec) ? videoTimeSec : 'null'}`;

  const visualMap = new Map();
  const passiveMap = new Map();
  const fusedMap = new Map();
  const ratingMap = new Map();

  const addToMap = (map, item, k) => {
    if (!k) return;
    // If multiple entries at the exact same time, keep the last one (most recent)
    map.set(k, item);
  };

  (Array.isArray(session.visualPredictions) ? session.visualPredictions : []).forEach(p => {
    const k = keyFor(p.videoId, p.videoTimeSec);
    addToMap(visualMap, p, k);
  });
  (Array.isArray(session.passivePredictions) ? session.passivePredictions : []).forEach(p => {
    const k = keyFor(p.videoId, p.videoTimeSec);
    addToMap(passiveMap, p, k);
  });
  (Array.isArray(session.fusedPredictions) ? session.fusedPredictions : []).forEach(p => {
    const k = keyFor(p.videoId, p.videoTimeSec);
    addToMap(fusedMap, p, k);
  });
  (Array.isArray(session.ratings) ? session.ratings : []).forEach(r => {
    const k = keyFor(r.videoId, r.videoTimeSec);
    addToMap(ratingMap, r, k);
  });

  // Union of keys
  const keySet = new Set([
    ...visualMap.keys(),
    ...passiveMap.keys(),
    ...fusedMap.keys(),
    ...ratingMap.keys()
  ]);

  // Sort keys by videoId then videoTimeSec numeric
  const sortedKeys = Array.from(keySet).sort((a, b) => {
    const [vidA, tA] = a.split('::');
    const [vidB, tB] = b.split('::');
    if (vidA < vidB) return -1;
    if (vidA > vidB) return 1;
    const nA = Number(tA);
    const nB = Number(tB);
    if (Number.isNaN(nA) && Number.isNaN(nB)) return 0;
    if (Number.isNaN(nA)) return -1;
    if (Number.isNaN(nB)) return 1;
    return nA - nB;
  });

  const header = [
    'participant',
    'active_valence', 'active_arousal',
    'passive_valence', 'passive_arousal',
    'fused_valence', 'fused_arousal',
    'user_rating_valence', 'user_rating_arousal', 'user_free_emotion',
    'video_title', 'video_time_sec', 'system_datetime'
  ];

  const rows = [header.map(csvEscape).join(',')];

  sortedKeys.forEach(k => {
    const [videoId, tStr] = k.split('::');
    const visual = visualMap.get(k);
    const passive = passiveMap.get(k);
    const fused = fusedMap.get(k);
    const rating = ratingMap.get(k);

    const videoTitle = getVideoNameById(session, videoId);
    const systemDatetime = pickSystemDatetime({ visual, passive, fused, rating, session });

    const row = [
      participantName || session.participantId || 'null',
      toStringOrNull(visual?.valence),
      toStringOrNull(visual?.arousal),
      toStringOrNull(passive?.valence),
      toStringOrNull(passive?.arousal),
      toStringOrNull(fused?.valence),
      toStringOrNull(fused?.arousal),
      toStringOrNull(rating?.valence),
      toStringOrNull(rating?.arousal),
      toStringOrNull(rating?.freeEmotion),
      videoTitle,
      toStringOrNull(Number(tStr)),
      toStringOrNull(systemDatetime)
    ];

    rows.push(row.map(csvEscape).join(','));
  });

  const csvContent = rows.join('\n');

  const participantPart = safeFilename(participantName || session.participantId || 'participant');
  const sessionStart = safeFilename(session.startTime || new Date().toISOString());
  const filename = `${participantPart}_${sessionStart}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

export default downloadSessionCsv;

// Convenience: accept a JSON object or JSON string in the same format as
// the "Export Current Session JSON" output and trigger CSV download.
// input can be:
// - { session: {...} }
// - sessionObject (with id, participantId, etc.)
// - JSON string of either of the above
// options: { participantName?: string }
export const downloadSessionCsvFromJson = (input, options = {}) => {
  let parsed = input;
  try {
    if (typeof input === 'string') {
      parsed = JSON.parse(input);
    }
  } catch (e) {
    throw new Error('Invalid JSON string provided');
  }

  const session = parsed?.session ? parsed.session : parsed;
  if (!session || typeof session !== 'object') {
    throw new Error('Input does not contain a valid session object');
  }

  const participantName = options.participantName || session.participantId;
  return downloadSessionCsv({ session, participantName });
};

// Convenience: accept a File/Blob containing JSON and trigger CSV download.
// Uses File.text() to read; returns a Promise that resolves after download is triggered.
// options: { participantName?: string }
export const downloadSessionCsvFromFile = async (file, options = {}) => {
  if (!file || typeof file.text !== 'function') {
    throw new Error('A File/Blob with a .text() method is required');
  }
  const text = await file.text();
  return downloadSessionCsvFromJson(text, options);
};


