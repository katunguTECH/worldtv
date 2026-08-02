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

  useEffect(() => {
    // Reset states when streamUrl changes
    setIsWebsite(false);
    setIframeUrl('');
    setLoadError(null);

    // Check if it's a website URL (not a video stream)
    const url = streamUrl.toLowerCase();
    const isWebsiteUrl = url.includes('.com') || url.includes('.org') || url.includes('.tv') || 
                         url.includes('/live') || url.includes('/watch') || url.includes('youtube') ||
                         url.includes('youtu.be');
    
    if (isWebsiteUrl) {
      setIsWebsite(true);
      // Try to get embed URL or use the URL directly
      let embedUrl = streamUrl;
      
      // Handle YouTube
      if (url.includes('youtube.com/watch') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
        } else {
          const urlParams = new URL(streamUrl).searchParams;
          videoId = urlParams.get('v') || '';
        }
        if (videoId) {
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }
      }
      
      setIframeUrl(embedUrl);
      return;
    }

    // If we have a video element, try to play the stream
    if (!videoRef.current) return;

    // Dispose any existing player
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    // Initialize video player for actual video streams
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
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'liveDisplay',
          'seekToLive',
          'remainingTimeDisplay',
          'customControlSpacer',
          'playbackRateMenuButton',
          'chaptersButton',
          'descriptionsButton',
          'subtitlesButton',
          'captionsButton',
          'audioTrackButton',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Set up error handling
    player.on('error', (e: any) => {
      console.error('Video player error:', e);
      setLoadError('Failed to load stream. Try opening in new tab.');
    });

    // Load the stream
    try {
      // Try different formats
      const streamTypes = [
        { type: 'application/x-mpegURL' },
        { type: 'application/vnd.apple.mpegurl' },
        { type: 'video/mp4' },
        { type: 'video/webm' },
        { type: 'video/ogg' },
      ];

      // If URL ends with .m3u8, use HLS
      if (streamUrl.endsWith('.m3u8')) {
        player.src({
          src: streamUrl,
          type: 'application/x-mpegURL',
        });
      } else {
        // Try the URL as-is with various formats
        let loaded = false;
        for (const format of streamTypes) {
          try {
            player.src({
              src: streamUrl,
              type: format.type,
            });
            loaded = true;
            break;
          } catch (e) {
            continue;
          }
        }
        if (!loaded) {
          throw new Error('Could not load stream with any format');
        }
      }

      // Handle successful load
      player.ready(() => {
        try {
          player.play();
        } catch (e) {
          console.warn('Autoplay was prevented:', e);
        }
      });
    } catch (error) {
      console.error('Error loading stream:', error);
      setLoadError('Unable to load this stream. Try opening in new tab.');
    }

    // Cleanup on unmount or streamUrl change
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [streamUrl]);

  // Create poster image with channel name
  const posterImage = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'><rect width='100%25' height='100%25' fill='%231a1a1a'/><text x='50%25' y='50%25' font-family='Arial' font-size='20' fill='%23666' text-anchor='middle' dy='.3em'>${channelName}</text></svg>`;

  // If it's a website, embed it in an iframe
  if (isWebsite) {
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
        />
      </div>
    );
  }

  // If there's an error, show error message
  if (loadError) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <div className="text-white text-lg mb-2">{loadError}</div>
        <div className="text-gray-400 text-sm mb-4">Stream URL: {streamUrl}</div>
        <button
          onClick={() => window.open(streamUrl, '_blank')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Open in New Tab
        </button>
      </div>
    );
  }

  // For actual video streams
  return (
    <div data-vjs-player className="bg-black rounded-lg overflow-hidden">
      <video 
        ref={videoRef} 
        className="video-js vjs-big-play-centered vjs-theme-city" 
        poster={posterImage}
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;