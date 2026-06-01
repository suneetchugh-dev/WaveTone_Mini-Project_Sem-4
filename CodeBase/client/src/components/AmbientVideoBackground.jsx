import React from 'react';

function AmbientVideoBackground({ variant = 'subtle' }) {
  return (
    <div className={`ambient-video-backdrop ambient-video-backdrop--${variant}`} aria-hidden="true">
      <video
        className="ambient-bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/videos/wavetone-bg-poster.jpg"
      >
        <source src="/videos/wavetone-bg.mp4" type="video/mp4" />
      </video>
      <div className="ambient-video-shade" />
    </div>
  );
}

export default AmbientVideoBackground;
