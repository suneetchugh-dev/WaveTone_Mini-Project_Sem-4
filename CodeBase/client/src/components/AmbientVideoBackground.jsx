import React, { useState, useRef, useEffect, useCallback } from 'react';

function AmbientVideoBackground({ variant = 'subtle', showToggleButton = false }) {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  // Sync muted state to video element via DOM (React's muted prop is unreliable)
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
      video.volume = 1.0;
    }
  }, [isMuted]);

  // Ensure video starts muted on mount (React muted prop can be flaky)
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.volume = 1.0;
    }
  }, []);

  const toggleSound = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      // Currently muted -> try to unmute
      try {
        video.muted = false;
        video.volume = 1.0;

        // If video is paused, play it; if already playing, just unmute
        if (video.paused) {
          await video.play();
        }

        setIsMuted(false);
      } catch (error) {
        console.warn('Could not unmute video:', error);
        // Re-mute if browser blocks it
        video.muted = true;
        setIsMuted(true);
      }
    } else {
      // Currently unmuted -> mute
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted]);

  return (
    <>
      <div className={`ambient-video-backdrop ambient-video-backdrop--${variant}`} aria-hidden="true">
        <video
          ref={videoRef}
          className="ambient-bg-video"
          autoPlay
          loop
          muted={isMuted}
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
          onClick={toggleSound}
          aria-label={isMuted ? 'Unmute background video' : 'Mute background video'}
        >
          {isMuted ? (
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
