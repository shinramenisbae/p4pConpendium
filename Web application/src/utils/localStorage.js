// Local storage utility functions for the emotion study app

const STORAGE_KEYS = {
  PARTICIPANT_DATA: 'emotion_study_participant_data',
  STUDY_CONFIG: 'emotion_study_config',
  VIDEO_LIST: 'emotion_study_video_list',
  SESSION_DATA: 'emotion_study_session_data',
  CURRENT_PARTICIPANT_ID: 'emotion_study_current_participant_id',
  CURRENT_SESSION_ID: 'emotion_study_current_session_id'
};

// Participant data management
export const saveParticipantData = (participantId, data) => {
  try {
    const existingData = getAllParticipantData();
    existingData[participantId] = {
      ...data,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.PARTICIPANT_DATA, JSON.stringify(existingData));
    return true;
  } catch (error) {
    console.error('Error saving participant data:', error);
    return false;
  }
};

export const getParticipantData = (participantId) => {
  try {
    const allData = getAllParticipantData();
    return allData[participantId] || null;
  } catch (error) {
    console.error('Error getting participant data:', error);
    return null;
  }
};

export const getAllParticipantData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_DATA);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting all participant data:', error);
    return {};
  }
};

export const deleteParticipantData = (participantId) => {
  try {
    const allData = getAllParticipantData();
    delete allData[participantId];
    localStorage.setItem(STORAGE_KEYS.PARTICIPANT_DATA, JSON.stringify(allData));
    return true;
  } catch (error) {
    console.error('Error deleting participant data:', error);
    return false;
  }
};

// Study configuration management
export const saveStudyConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEYS.STUDY_CONFIG, JSON.stringify({
      ...config,
      lastUpdated: new Date().toISOString()
    }));
    return true;
  } catch (error) {
    console.error('Error saving study config:', error);
    return false;
  }
};

export const getStudyConfig = () => {
  try {
    const config = localStorage.getItem(STORAGE_KEYS.STUDY_CONFIG);
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Error getting study config:', error);
    return null;
  }
};

// Video list management
export const saveVideoList = (videos) => {
  try {
    localStorage.setItem(STORAGE_KEYS.VIDEO_LIST, JSON.stringify({
      videos,
      lastUpdated: new Date().toISOString()
    }));
    return true;
  } catch (error) {
    console.error('Error saving video list:', error);
    return false;
  }
};

export const getVideoList = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.VIDEO_LIST);
    return data ? JSON.parse(data).videos : [];
  } catch (error) {
    console.error('Error getting video list:', error);
    return [];
  }
};

// Session data management
export const saveSessionData = (sessionId, data) => {
  try {
    const existingData = getAllSessionData();
    existingData[sessionId] = {
      ...data,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(existingData));
    return true;
  } catch (error) {
    console.error('Error saving session data:', error);
    return false;
  }
};

export const getSessionData = (sessionId) => {
  try {
    const allData = getAllSessionData();
    return allData[sessionId] || null;
  } catch (error) {
    console.error('Error getting session data:', error);
    return null;
  }
};

export const getAllSessionData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting all session data:', error);
    return {};
  }
};

// Current IDs helpers (for persistence/restoration)
export const setCurrentParticipantId = (participantId) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_PARTICIPANT_ID, participantId);
  } catch (error) {
    console.error('Error setting current participant id:', error);
  }
};

export const getCurrentParticipantId = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_PARTICIPANT_ID);
  } catch {
    return null;
  }
};

export const setCurrentSessionId = (sessionId) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, sessionId);
  } catch (error) {
    console.error('Error setting current session id:', error);
  }
};

export const getCurrentSessionId = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID);
  } catch {
    return null;
  }
};

export const clearCurrentIds = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PARTICIPANT_ID);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION_ID);
  } catch (error) {
    console.error('Error clearing current ids:', error);
  }
};

// Data export functionality
export const exportAllData = () => {
  try {
    const exportData = {
      participants: getAllParticipantData(),
      sessions: getAllSessionData(),
      config: getStudyConfig(),
      videos: getVideoList(),
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `emotion_study_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    return true;
  } catch (error) {
    console.error('Error exporting data:', error);
    return false;
  }
};

// Clear all data (for testing/reset purposes)
export const clearAllData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
};

// Check storage availability
export const isStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

