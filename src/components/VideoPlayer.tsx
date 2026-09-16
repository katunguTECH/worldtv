import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// Silvermine casting plugins
import chromecast from '@silvermine/videojs-chromecast';
import airplay from '@silvermine/videojs-airplay';

// Register the plugins once, at module load time.
chromecast(videojs);
airplay(videojs);

interface VideoPlayerProps {
  streamUrl: string;
  channelName: string;
  onPipChange?: (isInPip: boolean) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export interface VideoPlayerHandle {
  requestPip: () => Promise<void>;
}

const VideoPlayer = React.forwardRef<
  VideoPlayerHandle,
  VideoPlayerProps
>(({ streamUrl, channelName, onPipChange, onPlayStateChange }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const onPipChangeRef = useRef(onPipChange);
  const onPlayStateChangeRef = useRef(onPlayStateChange);

  const streamUrlRef = useRef(streamUrl);
  const channelNameRef = useRef(channelName);
  streamUrlRef.current = streamUrl;
  channelNameRef.current = channelName;

  useEffect(() => {
    onPipChangeRef.current = onPipChange;
  }, [onPipChange]);

  useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onPlayStateChange]);

  React.useImperativeHandle(ref, () => ({
    requestPip: async () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      if (document.pictureInPictureElement) return;
      try {
        await videoEl.requestPictureInPicture();
      } catch (error) {
        console.warn('[WorldTV] requestPictureInPicture failed:', error);
      }
    },
  }));

  const [isWebsite, setIsWebsite] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const iframeWrapperRef = useRef<HTMLDivElement>(null);
  const iframeOriginalParentRef = useRef<Node | null>(null);
  const iframeOriginalNextSiblingRef = useRef<Node | null>(null);

  const popOutIframe = async () => {
    const wrapper = iframeWrapperRef.current;
    const docPip = (window as any).documentPictureInPicture;
    if (!wrapper || !docPip) return;

    try {
      const pipWindow = await docPip.requestWindow({ width: 480, height: 270 });

      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const css = Array.from(sheet.cssRules).map(r => r.cssText).join('');
          const style = pipWindow.document.createElement('style');
          style.textContent = css;
          pipWindow.document.head.appendChild(style);
        } catch (e) { /* cross-origin, skip */ }
      });

      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.background = '#000';

      iframeOriginalParentRef.current = wrapper.parentNode;
      iframeOriginalNextSiblingRef.current = wrapper.nextSibling;

      pipWindow.document.body.append(wrapper);

      pipWindow.addEventListener('pagehide', () => {
        if (iframeOriginalParentRef.current) {
          iframeOriginalParentRef.current.insertBefore(
            wrapper,
            iframeOriginalNextSiblingRef.current
          );
        }
      });
    } catch (error) {
      console.warn('[WorldTV] Document Picture-in-Picture failed:', error);
    }
  };

  const getProxyUrl = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

  const getStreamType = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8') || lower.includes('playlist.m3u8') || lower.includes('chunklist')) {
      return 'application/x-mpegURL';
    }
    if (lower.includes('.mp4') || lower.includes('.m4v')) return 'video/mp4';
    if (lower.includes('.webm')) return 'video/webm';
    return 'application/x-mpegURL';
  };

  const destroyPlayer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.dispose(); } catch (e) { console.warn('dispose error:', e); }
      playerRef.current = null;
      onPlayStateChangeRef.current?.(false);
    }
  };

  const createPlayer = () => {
    if (!videoRef.current) return;

    destroyPlayer();
    setLoadError(null);
    setIsRetrying(false);

    const streamUrl = streamUrlRef.current;
    const channelName = channelNameRef.current;
    const proxyUrl = getProxyUrl(streamUrl);
    const streamType = getStreamType(streamUrl);

    console.log('[WorldTV] Loading stream:', streamUrl);
    console.log('[WorldTV] Proxy URL:', proxyUrl);
    console.log('[WorldTV] Stream type:', streamType);

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: true,
      muted: false,
      preload: 'auto',
      fluid: true,
      responsive: true,
      liveui: true,
      inactivityTimeout: 0,
      techOrder: ['chromecast', 'html5'],

      plugins: {
        chromecast: {
          addButtonToControlBar: false,
          receiver: 'CC1AD845',
          preloadWebComponents: true,
        },
        airPlay: {
          addButtonToControlBar: false,
        },
      },

      html5: {
        vhs: {
          enabled: true,
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: !videojs.browser.IS_SAFARI,
          limitRenditionByPlayerDimensions: false,
          useDevicePixelRatio: true,
        },
        nativeAudioTracks: videojs.browser.IS_SAFARI,
        nativeVideoTracks: videojs.browser.IS_SAFARI,
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
          'pictureInPictureToggle',
          'fullscreenToggle',
        ],
      },
    });

    player.ready(() => {
      try {
        const videoEl = videoRef.current;

        if ('mediaSession' in navigator && (navigator as any).mediaSession) {
          try {
            (navigator as any).mediaSession.metadata =
              new (window as any).MediaMetadata({
                title: channelName,
                artist: 'WorldTV',
              });
          } catch (e) { console.warn('[WorldTV] Media Session metadata failed:', e); }
        }

        if (videoEl) {
          videoEl.addEventListener('enterpictureinpicture', () => onPipChangeRef.current?.(true));
          videoEl.addEventListener('leavepictureinpicture', () => onPipChangeRef.current?.(false));
        }

        /*
         * Manually add the Cast + AirPlay buttons.
         *
         * We do this here (instead of listing them in controlBar.children)
         * because the plugin reads its `preloadWebComponents` flag from
         * the BUTTON's own options — not from the plugin config. Passing
         * that flag when we create the button is what makes the icon
         * actually render (without it, the button is created but stays
         * empty/invisible).
         *
         * The setTimeout gives the plugin's per-player initialization a
         * moment to finish before we insert the buttons.
         */
        setTimeout(() => {
          try {
            const controlBar = (player as any).controlBar;
            if (!controlBar) return;

            const insertIndex = Math.max(0, (controlBar.children()?.length || 0) - 2);

            if (!controlBar.getChild('ChromecastButton')) {
              controlBar.addChild(
                'ChromecastButton',
                { preloadWebComponents: true },
                insertIndex
              );
              console.log('[WorldTV] Cast button added');
            }

            if (!controlBar.getChild('AirPlayButton') && videojs.browser.IS_SAFARI) {
              controlBar.addChild(
                'AirPlayButton',
                {},
                insertIndex
              );
              console.log('[WorldTV] AirPlay button added');
            }
          } catch (e) {
            console.warn('[WorldTV] Failed to add cast buttons:', e);
          }
        }, 300);
      } catch (error) {
        console.warn('[WorldTV] Post-ready setup failed:', error);
      }
    });

    playerRef.current = player;

    player.on('loadstart', () => console.log(`[WorldTV] Stream load started: ${channelName}`));
    player.on('loadedmetadata', () => {
      console.log(`[WorldTV] Metadata loaded: ${channelName}`);
      setLoadError(null);
      setIsRetrying(false);
    });
    player.on('canplay', () => {
      console.log(`[WorldTV] Stream can play: ${channelName}`);
      setLoadError(null);
      setIsRetrying(false);
      if (player.paused()) {
        const p = player.play();
        if (p !== undefined) p.catch((e: any) => console.warn('[WorldTV] Play blocked:', e));
      }
    });
    player.on('playing', () => {
      console.log(`[WorldTV] Playback started: ${channelName}`);
      retryCountRef.current = 0;
      setLoadError(null);
      setIsRetrying(false);
      onPlayStateChangeRef.current?.(true);
    });
    player.on('pause', () => onPlayStateChangeRef.current?.(false));
    player.on('waiting', () => console.log(`[WorldTV] Buffering: ${channelName}`));
    player.on('stalled', () => console.warn(`[WorldTV] Stream stalled: ${channelName}`));
    player.on('ended', () => { console.warn(`[WorldTV] Stream ended: ${channelName}`); scheduleRetry(); });
    player.on('error', () => {
      console.error('[WorldTV] Video.js error:', player.error());
      scheduleRetry();
    });
    player.on('xhr-error', (event: any) => console.warn('[WorldTV] VHS/XHR error:', event));

    try {
      player.src({ src: proxyUrl, type: streamType });
      player.ready(() => {
        console.log(`[WorldTV] Player ready: ${channelName}`);
        const p = player.play();
        if (p !== undefined) {
          p.then(() => console.log(`[WorldTV] Autoplay successful: ${channelName}`))
           .catch((e: any) => console.warn('[WorldTV] Autoplay prevented:', e));
        }
      });
    } catch (error) {
      console.error('[WorldTV] Failed to initialize player:', error);
      setLoadError('Unable to initialize this stream.');
    }
  };

  const updateSource = () => {
    const player = playerRef.current;
    if (!player) return;

    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    retryCountRef.current = 0;
    setLoadError(null);
    setIsRetrying(false);

    const streamUrl = streamUrlRef.current;
    const channelName = channelNameRef.current;
    const proxyUrl = getProxyUrl(streamUrl);
    const streamType = getStreamType(streamUrl);

    console.log(`[WorldTV] Switching channel (player reused): ${channelName}`);

    try {
      player.src({ src: proxyUrl, type: streamType });
      if ('mediaSession' in navigator && (navigator as any).mediaSession) {
        try {
          (navigator as any).mediaSession.metadata =
            new (window as any).MediaMetadata({ title: channelName, artist: 'WorldTV' });
        } catch (e) { console.warn('[WorldTV] Media Session update failed:', e); }
      }
      const p = player.play();
      if (p !== undefined) p.catch((e: any) => console.warn('[WorldTV] Autoplay prevented after switch:', e));
    } catch (error) {
      console.error('[WorldTV] Failed to switch source:', error);
      setLoadError('Unable to load this stream.');
    }
  };

  const scheduleRetry = () => {
    if (retryTimerRef.current) return;
    const retryNumber = retryCountRef.current + 1;
    if (retryNumber > 5) {
      console.error(`[WorldTV] Max retries reached: ${channelNameRef.current}`);
      setIsRetrying(false);
      setLoadError('This stream is currently unavailable. Please try again.');
      return;
    }
    retryCountRef.current = retryNumber;
    const delay = Math.min(retryNumber * 2000, 10000);
    console.log(`[WorldTV] Retrying in ${delay}ms`);
    setIsRetrying(true);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!videoRef.current) return;
      createPlayer();
    }, delay);
  };

  const retryNow = () => {
    retryCountRef.current = 0;
    setLoadError(null);
    setIsRetrying(false);
    createPlayer();
  };

  useEffect(() => {
    setIsWebsite(false);
    setIframeUrl('');
    setLoadError(null);
    setIframeFailed(false);
    setIsRetrying(false);
    retryCountRef.current = 0;

    if (!streamUrl) {
      setLoadError('No stream URL is available for this channel.');
      return;
    }

    const url = streamUrl.toLowerCase();

    if (
      url.includes('youtube.com/watch') ||
      url.includes('youtu.be/') ||
      url.includes('youtube.com/live/')
    ) {
      destroyPlayer();
      setIsWebsite(true);

      let videoId = '';
      try {
        const parsed = new URL(streamUrl);
        if (parsed.hostname.includes('youtu.be')) {
          videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
        } else if (parsed.pathname.includes('/live/')) {
          videoId = parsed.pathname.split('/live/')[1]?.split('/')[0]?.split('?')[0] || '';
        } else {
          videoId = parsed.searchParams.get('v') || '';
        }
      } catch (e) { console.warn('[WorldTV] Could not parse YouTube URL:', e); }

      if (videoId) {
        setIframeUrl(`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&rel=0`);
      } else {
        setIframeUrl(streamUrl);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (playerRef.current) updateSource();
      else createPlayer();
    }, 0);

    return () => { clearTimeout(timer); };
  }, [streamUrl, channelName]);

  useEffect(() => {
    return () => { destroyPlayer(); };
    // eslint-disable-next-line
  }, []);

  const posterImage =
    `data:image/svg+xml,` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">` +
    `<rect width="100%" height="100%" fill="#111827"/>` +
    `<text x="50%" y="50%" font-family="Arial,sans-serif" font-size="32" ` +
    `fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">` +
    `${encodeURIComponent(channelName)}</text></svg>`;

  if (isWebsite) {
    if (iframeFailed) {
      return (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <div className="text-yellow-400 text-4xl mb-4">🔒</div>
          <div className="text-white text-lg mb-2">This website blocks embedded viewing</div>
          <div className="text-gray-400 text-sm mb-4">
            {channelName} prevents its stream from being shown in an iframe.<br />
            Click below to open it directly.
          </div>
          <button
            onClick={() => window.open(streamUrl, '_blank', 'noopener,noreferrer')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition text-lg font-semibold"
          >
            Open {channelName} in New Tab ↗
          </button>
        </div>
      );
    }

    return (
      <div
        ref={iframeWrapperRef}
        className="relative bg-black rounded-lg overflow-hidden"
        style={{ paddingBottom: '56.25%', height: 0 }}
      >
        <iframe
          src={iframeUrl}
          title={channelName}
          className="absolute top-0 left-0 w-full h-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          style={{ border: 'none' }}
          loading="eager"
          onError={() => setIframeFailed(true)}
        />

        <div className="absolute bottom-4 right-4 z-10 flex gap-2">
          {typeof window !== 'undefined' && 'documentPictureInPicture' in window && (
            <button
              onClick={popOutIframe}
              className="bg-gray-800/90 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm transition flex items-center gap-1"
              title="Float this player in a window on top of everything else"
            >
              Float window ⧉
            </button>
          )}

          <button
            onClick={() => window.open(streamUrl, '_blank', 'noopener,noreferrer')}
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
        {isRetrying && (<div className="text-yellow-400 text-sm mb-4">Attempting to reconnect…</div>)}
        <div className="text-gray-500 text-xs mb-5 break-all">{streamUrl}</div>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={retryNow}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-semibold"
          >
            Try Again
          </button>
          <button
            onClick={() => window.open(streamUrl, '_blank', 'noopener,noreferrer')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition font-semibold"
          >
            Open Stream ↗
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-vjs-player className="bg-black rounded-lg overflow-hidden relative">
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
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;