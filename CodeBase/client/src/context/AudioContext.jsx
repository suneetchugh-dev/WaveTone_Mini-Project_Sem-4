import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';

export const AudioContext = createContext();

export function AudioProvider({ children }) {
  const [isAmbientMuted, setIsAmbientMuted] = useState(true);
  const videoRef = useRef(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedMutedState = localStorage.getItem('wavetone-ambient-muted');
    if (savedMutedState !== null) {
      setIsAmbientMuted(savedMutedState === 'true');
    }
  }, []);

  // Persist muted state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('wavetone-ambient-muted', isAmbientMuted);
  }, [isAmbientMuted]);

  // Sync video muted state with global state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isAmbientMuted;
      if (!isAmbientMuted) {
        videoRef.current.volume = 1.0;
      }
    }
  }, [isAmbientMuted]);

  const toggleAmbientSound = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (isAmbientMuted) {
        // Unmute
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        if (videoRef.current.paused) {
          await videoRef.current.play();
        }
        setIsAmbientMuted(false);
      } else {
        // Mute
        videoRef.current.muted = true;
        setIsAmbientMuted(true);
      }
    } catch (error) {
      console.warn('Could not toggle ambient sound:', error);
      videoRef.current.muted = true;
      setIsAmbientMuted(true);
    }
  }, [isAmbientMuted]);

  const setVideoRef = useCallback((ref) => {
    videoRef.current = ref;
    if (ref) {
      ref.muted = isAmbientMuted;
      ref.volume = isAmbientMuted ? 0 : 1.0;
    }
  }, [isAmbientMuted]);

  const value = {
    isAmbientMuted,
    setIsAmbientMuted,
    toggleAmbientSound,
    setVideoRef,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}
