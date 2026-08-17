import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface VideoPlayerProps {
  streamUrl: string;
  channelName: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  streamUrl,
  channelName,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const [isWebsite, setIsWebsite] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  /*
   * ----------------------------------------------------------
   * Build proxy URL
   * ----------------------------------------------------------
   */
  const getProxyUrl = (url: string) => {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  /*
   * ----------------------------------------------------------
   * Determine stream type
   * ----------------------------------------------------------
   */
  const getStreamType = (url: string) => {
    const lower = url.toLowerCase();

    if (
      lower.includes('.m3u8') ||
      lower.includes('playlist.m3u8') ||
      lower.includes('chunklist')
    ) {
      return 'application/x-mpegURL';
    }

    if (
      lower.includes('.mp4') ||
      lower.includes('.m4v')
    ) {
      return 'video/mp4';
    }

    if (
      lower.includes('.webm')
    ) {
      return 'video/webm';
    }

    return 'application/x-mpegURL';
  };

  /*
   * ----------------------------------------------------------
   * Destroy existing Video.js player
   * ----------------------------------------------------------
   */
  const destroyPlayer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (playerRef.current) {
      try {
        playerRef.current.dispose();
      } catch (error) {
        console.warn('Video.js dispose error:', error);
      }

      playerRef.current = null;
    }
  };

  /*
   * ----------------------------------------------------------
   * Create/recreate player
   * ----------------------------------------------------------
   */
  const createPlayer = () => {
    if (!videoRef.current) {
      return;
    }

    destroyPlayer();

    setLoadError(null);
    setIsRetrying(false);

    const proxyUrl = getProxyUrl(streamUrl);
    const streamType = getStreamType(streamUrl);

    console.log('[WorldTV] Loading stream:', streamUrl);
    console.log('[WorldTV] Proxy URL:', proxyUrl);
    console.log('[WorldTV] Stream type:', streamType);

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: true,
      muted: true,
      preload: 'auto',
      fluid: true,
      responsive: true,
      liveui: true,
      inactivityTimeout: 0,

      html5: {
        vhs: {
          enabled: true,

          /*
           * Start with a smaller rendition where possible.
           * This makes initial playback more reliable on slower
           * connections.
           */
          enableLowInitialPlaylist: true,

          /*
           * Allow VHS to switch quality while playing.
           */
          smoothQualityChange: true,

          /*
           * Use Video.js VHS instead of native HLS where possible.
           */
          overrideNative: true,

          /*
           * Helps recover from temporary live-stream interruptions.
           */
          limitRenditionByPlayerDimensions: false,

          useDevicePixelRatio: true,
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
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    /*
     * --------------------------------------------------------
     * Player events
     * --------------------------------------------------------
     */

    player.on('loadstart', () => {
      console.log(
        `[WorldTV] Stream load started: ${channelName}`
      );
    });

    player.on('loadedmetadata', () => {
      console.log(
        `[WorldTV] Metadata loaded: ${channelName}`
      );

      setLoadError(null);
      setIsRetrying(false);
    });

    player.on('canplay', () => {
      console.log(
        `[WorldTV] Stream can play: ${channelName}`
      );

      setLoadError(null);
      setIsRetrying(false);

      if (player.paused()) {
        const playPromise = player.play();

        // player.play() is not guaranteed to return a Promise
        // (depends on browser/state), so guard before chaining.
        if (playPromise !== undefined) {
          playPromise.catch((error: any) => {
            console.warn(
              '[WorldTV] Playback requires user interaction:',
              error
            );
          });
        }
      }
    });

    player.on('playing', () => {
      console.log(
        `[WorldTV] Playback started: ${channelName}`
      );

      retryCountRef.current = 0;
      setLoadError(null);
      setIsRetrying(false);
    });

    player.on('waiting', () => {
      console.log(
        `[WorldTV] Buffering: ${channelName}`
      );
    });

    player.on('stalled', () => {
      console.warn(
        `[WorldTV] Stream stalled: ${channelName}`
      );
    });

    player.on('ended', () => {
      console.warn(
        `[WorldTV] Stream ended: ${channelName}`
      );

      scheduleRetry();
    });

    player.on('error', () => {
      const error = player.error();

      console.error(
        '[WorldTV] Video.js error:',
        error
      );

      scheduleRetry();
    });

    /*
     * --------------------------------------------------------
     * VHS-specific error handling
     * --------------------------------------------------------
     */

    player.on('xhr-error', (event: any) => {
      console.warn(
        '[WorldTV] VHS/XHR error:',
        event
      );

      /*
       * Do not immediately destroy the player.
       *
       * Live HLS streams frequently have temporary failed
       * segment requests. VHS can often recover by itself.
       */
    });

    /*
     * --------------------------------------------------------
     * Set source
     * --------------------------------------------------------
     */

    try {
      player.src({
        src: proxyUrl,
        type: streamType,
      });

      player.ready(() => {
        console.log(
          `[WorldTV] Player ready: ${channelName}`
        );

        const playPromise = player.play();

        // Guard here too — same reasoning as above.
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(
                `[WorldTV] Autoplay successful: ${channelName}`
              );
            })
            .catch((error: any) => {
              console.warn(
                '[WorldTV] Autoplay prevented:',
                error
              );

              /*
               * Muted autoplay is attempted first.
               * If the browser still blocks it, the user can
               * press the normal play button.
               */
            });
        }
      });
    } catch (error) {
      console.error(
        '[WorldTV] Failed to initialize player:',
        error
      );

      setLoadError(
        'Unable to initialize this stream.'
      );
    }
  };

  /*
   * ----------------------------------------------------------
   * Retry logic
   * ----------------------------------------------------------
   */
  const scheduleRetry = () => {
    if (retryTimerRef.current) {
      return;
    }

    const retryNumber = retryCountRef.current + 1;

    /*
     * Maximum automatic retries.
     *
     * We do not retry forever because some channels really
     * are offline.
     */
    if (retryNumber > 5) {
      console.error(
        `[WorldTV] Maximum retries reached: ${channelName}`
      );

      setIsRetrying(false);
      setLoadError(
        'This stream is currently unavailable. Please try again.'
      );

      return;
    }

    retryCountRef.current = retryNumber;

    /*
     * Exponential-ish backoff:
     *
     * retry 1 = 2 seconds
     * retry 2 = 4 seconds
     * retry 3 = 6 seconds
     * retry 4 = 8 seconds
     * retry 5 = 10 seconds
     */
    const delay = Math.min(
      retryNumber * 2000,
      10000
    );

    console.log(
      `[WorldTV] Retrying ${channelName} in ${delay}ms`
    );

    setIsRetrying(true);

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;

      if (!videoRef.current) {
        return;
      }

      createPlayer();
    }, delay);
  };

  /*
   * ----------------------------------------------------------
   * Manual retry
   * ----------------------------------------------------------
   */
  const retryNow = () => {
    retryCountRef.current = 0;

    setLoadError(null);
    setIsRetrying(false);

    createPlayer();
  };

  /*
   * ----------------------------------------------------------
   * Main stream effect
   * ----------------------------------------------------------
   */
  useEffect(() => {
    setIsWebsite(false);
    setIframeUrl('');
    setLoadError(null);
    setIframeFailed(false);
    setIsRetrying(false);

    retryCountRef.current = 0;

    if (!streamUrl) {
      setLoadError(
        'No stream URL is available for this channel.'
      );

      return;
    }

    const url = streamUrl.toLowerCase();

    /*
     * --------------------------------------------------------
     * YouTube
     * --------------------------------------------------------
     */

    if (
      url.includes('youtube.com/watch') ||
      url.includes('youtu.be/') ||
      url.includes('youtube.com/live/')
    ) {
      setIsWebsite(true);

      let videoId = '';

      try {
        const parsed = new URL(streamUrl);

        if (
          parsed.hostname.includes('youtu.be')
        ) {
          videoId =
            parsed.pathname
              .replace(/^\/+/, '')
              .split('/')[0] || '';
        } else if (
          parsed.pathname.includes('/live/')
        ) {
          videoId =
            parsed.pathname
              .split('/live/')[1]
              ?.split('/')[0]
              ?.split('?')[0] || '';
        } else {
          videoId =
            parsed.searchParams.get('v') || '';
        }
      } catch (error) {
        console.warn(
          '[WorldTV] Could not parse YouTube URL:',
          error
        );
      }

      if (videoId) {
        setIframeUrl(
          `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0`
        );
      } else {
        setIframeUrl(streamUrl);
      }

      return;
    }

    /*
     * --------------------------------------------------------
     * Everything else is treated as a media stream.
     * --------------------------------------------------------
     */

    const timer = setTimeout(() => {
      createPlayer();
    }, 0);

    return () => {
      clearTimeout(timer);
      destroyPlayer();
    };

  
  }, [streamUrl, channelName]);

  /*
   * ----------------------------------------------------------
   * Poster
   * ----------------------------------------------------------
   */

  const posterImage =
    `data:image/svg+xml,` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="1280" height="720">` +
    `<rect width="100%" height="100%" fill="#111827"/>` +
    `<text x="50%" y="50%" ` +
    `font-family="Arial,sans-serif" ` +
    `font-size="32" ` +
    `fill="#9ca3af" ` +
    `text-anchor="middle" ` +
    `dominant-baseline="middle">` +
    `${encodeURIComponent(channelName)}` +
    `</text>` +
    `</svg>`;

  /*
   * ----------------------------------------------------------
   * Website / YouTube player
   * ----------------------------------------------------------
   */

  if (isWebsite) {
    if (iframeFailed) {
      return (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <div className="text-yellow-400 text-4xl mb-4">
            🔒
          </div>

          <div className="text-white text-lg mb-2">
            This website blocks embedded viewing
          </div>

          <div className="text-gray-400 text-sm mb-4">
            {channelName} prevents its stream from being
            shown in an iframe.
            <br />
            Click below to open it directly.
          </div>

          <button
            onClick={() =>
              window.open(
                streamUrl,
                '_blank',
                'noopener,noreferrer'
              )
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition text-lg font-semibold"
          >
            Open {channelName} in New Tab ↗
          </button>
        </div>
      );
    }

    return (
      <div
        className="relative bg-black rounded-lg overflow-hidden"
        style={{
          paddingBottom: '56.25%',
          height: 0,
        }}
      >
        <iframe
          src={iframeUrl}
          title={channelName}
          className="absolute top-0 left-0 w-full h-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          style={{
            border: 'none',
          }}
          loading="eager"
          onError={() => setIframeFailed(true)}
        />

        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={() =>
              window.open(
                streamUrl,
                '_blank',
                'noopener,noreferrer'
              )
            }
            className="bg-gray-800/90 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm transition flex items-center gap-1"
          >
            Open in new tab ↗
          </button>
        </div>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * Stream error
   * ----------------------------------------------------------
   */

  if (loadError) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <div className="text-red-400 text-4xl mb-4">
          ⚠️
        </div>

        <div className="text-white text-lg mb-2">
          {loadError}
        </div>

        {isRetrying && (
          <div className="text-yellow-400 text-sm mb-4">
            Attempting to reconnect…
          </div>
        )}

        <div className="text-gray-500 text-xs mb-5 break-all">
          {streamUrl}
        </div>

        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={retryNow}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-semibold"
          >
            Try Again
          </button>

          <button
            onClick={() =>
              window.open(
                streamUrl,
                '_blank',
                'noopener,noreferrer'
              )
            }
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition font-semibold"
          >
            Open Stream ↗
          </button>
        </div>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * Video.js player
   * ----------------------------------------------------------
   */

  return (
    <div
      data-vjs-player
      className="bg-black rounded-lg overflow-hidden relative"
    >
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered vjs-theme-city"
        poster={posterImage}
        playsInline
      />

      {isRetrying && (
        <div className="absolute top-3 left-3 z-20 bg-black/75 text-white text-sm px-3 py-2 rounded">
          Reconnecting…
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
