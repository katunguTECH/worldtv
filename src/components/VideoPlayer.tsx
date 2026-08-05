import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface VideoPlayerProps {
  streamUrl: string;
  channelName: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ streamUrl, channelName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [isWebsite, setIsWebsite] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => {
    setIsWebsite(false);
    setIframeUrl('');
    setLoadError(null);
    setIframeFailed(false);

    const url = streamUrl.toLowerCase();

    // YouTube
    if (url.includes('youtube.com/watch') || url.includes('youtu.be')) {
      setIsWebsite(true);
      let videoId = '';
      if (url.includes('youtu.be')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
      } else {
        try {
          videoId = new URL(streamUrl).searchParams.get('v') || '';
        } catch {
          // ignore
        }
      }
      setIframeUrl(videoId
        ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`
        : streamUrl);
      return;
    }

    // Classify by file extension, not domain guessing — a stream host's
    // domain can easily contain ".tv" or "/live" and get misclassified.
    const isDirectMedia = url.endsWith('.m3u8') || url.endsWith('.mp4') || url.includes('.m3u8?');

    if (!isDirectMedia) {
      setIsWebsite(true);
      setIframeUrl(streamUrl);
      return;
    }

    if (!videoRef.current) return;

    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: true,
      preload: 'auto',
      fluid: true,
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      controlBar: {
        children: [
          'playToggle', 'volumePanel', 'currentTimeDisplay', 'timeDivider',
          'durationDisplay', 'progressControl', 'liveDisplay', 'seekToLive',
          'remainingTimeDisplay', 'playbackRateMenuButton', 'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    player.on('error', (e: any) => {
      console.error('Video player error:', e);
      setLoadError('This stream is currently unavailable. Try opening it directly.');
    });

    try {
      if (url.endsWith('.m3u8') || url.includes('.m3u8?')) {
        // Route through our own proxy so CORS/referrer blocks on the
        // origin stream host don't kill playback.
        player.src({
          src: `/api/proxy?url=${encodeURIComponent(streamUrl)}`,
          type: 'application/x-mpegURL',
        });
      } else {
        player.src({ src: streamUrl, type: 'video/mp4' });
      }

      player.ready(() => {
        player.play()?.catch((e: any) => console.warn('Autoplay prevented:', e));
      });
    } catch (error) {
      console.error('Error loading stream:', error);
      setLoadError('Unable to load this stream.');
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [streamUrl]);

  const posterImage = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'><rect width='100%25' height='100%25' fill='%231a1a1a'/><text x='50%25' y='50%25' font-family='Arial' font-size='20' fill='%23666' text-anchor='middle' dy='.3em'>${channelName}</text></svg>`;

  if (isWebsite) {
    if (iframeFailed) {
      return (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <div className="text-yellow-400 text-4xl mb-4">🔒</div>
          <div className="text-white text-lg mb-2">This website blocks embedded viewing</div>
          <div className="text-gray-400 text-sm mb-4">
            {channelName} prevents their stream from being shown in an iframe.
            <br />Click the button below to open it directly.
          </div>
          <button
            onClick={() => window.open(streamUrl, '_blank')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition text-lg font-semibold"
          >
            Open {channelName} in New Tab ↗
          </button>
        </div>
      );
    }

    return (
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%', height: 0 }}>
        <iframe
          src={iframeUrl}
          title={channelName}
          className="absolute top-0 left-0 w-full h-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          style={{ border: 'none' }}
          loading="lazy"
          onError={() => setIframeFailed(true)}
        />
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={() => window.open(streamUrl, '_blank')}
            className="bg-gray-800/90 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm transition flex items-center gap-1"
          >
            Open in new tab ↗
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <div className="text-white text-lg mb-2">{loadError}</div>
        <div className="text-gray-400 text-sm mb-4">Stream URL: {streamUrl}</div>
        <button
          onClick={() => window.open(streamUrl, '_blank')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition text-lg font-semibold"
        >
          Open in New Tab ↗
        </button>
      </div>
    );
  }

  return (
    <div data-vjs-player className="bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} className="video-js vjs-big-play-centered vjs-theme-city" poster={posterImage} playsInline />
    </div>
  );
};

export default VideoPlayer;