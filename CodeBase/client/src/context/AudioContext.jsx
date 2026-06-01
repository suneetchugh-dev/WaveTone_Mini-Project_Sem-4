import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';

export const AudioContext = createContext();

export function AudioProvider({ children }) {
  const [isAmbientMuted, setIsAmbientMuted] = useState(true);
  const videoRef = useRef(null);
  const saveTimeoutRef = useRef(null);

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

  // Save video currentTime periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        localStorage.setItem('wavetone-video-currentTime', videoRef.current.currentTime);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Sync video muted state with global state (without causing stutter)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isAmbientMuted;
      if (!isAmbientMuted) {
        videoRef.current.volume = 1.0;
        // Only play if paused, don't interrupt if already playing
        if (videoRef.current.paused) {
          videoRef.current.play().catch(err => console.warn('Could not play video:', err));
        }
      }
    }
  }, [isAmbientMuted]);

  const toggleAmbientSound = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (isAmbientMuted) {
        // Unmute - set muted directly without play() to avoid stutter
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        // Only play if not already playing
        if (videoRef.current.paused) {
          await videoRef.current.play();
        }
        setIsAmbientMuted(false);
      } else {
        // Mute - just set muted property, no need for play/pause
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
      // Restore saved currentTime
      const savedTime = localStorage.getItem('wavetone-video-currentTime');
      if (savedTime) {
        ref.currentTime = parseFloat(savedTime);
      }
      
      // Set muted state
      ref.muted = isAmbientMuted;
      ref.volume = isAmbientMuted ? 0 : 1.0;
      
      // Auto-play if not muted and video is ready
      if (!isAmbientMuted && ref.readyState > 0) {
        ref.play().catch(err => console.warn('Could not autoplay video:', err));
      }
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
