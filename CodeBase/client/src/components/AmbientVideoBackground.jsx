import React, { useRef, useEffect, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

function AmbientVideoBackground({ variant = 'subtle', showToggleButton = false }) {
  const { isAmbientMuted, toggleAmbientSound, setVideoRef } = useContext(AudioContext);
  const videoRef = useRef(null);

  // Register video element with context
  useEffect(() => {
    if (videoRef.current) {
      setVideoRef(videoRef.current);
    }
  }, [setVideoRef]);

  return (
    <>
      <div className={`ambient-video-backdrop ambient-video-backdrop--${variant}`} aria-hidden="true">
        <video
          ref={videoRef}
          className="ambient-bg-video"
          autoPlay
          loop
          muted={isAmbientMuted}
          playsInline
          preload="auto"
          volume={1.0}
          poster="/videos/wavetone-bg-poster.jpg"
        >
          <source src="/videos/wavetone-bg.mp4" type="video/mp4" />
        </video>
        <div className="ambient-video-shade" />
      </div>
      {showToggleButton && (
        <button
          className="ambient-sound-toggle"
          onClick={toggleAmbientSound}
          aria-label={isAmbientMuted ? 'Unmute background video' : 'Mute background video'}
        >
          {isAmbientMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          )}
        </button>
      )}
    </>
  );
}

export default AmbientVideoBackground;
