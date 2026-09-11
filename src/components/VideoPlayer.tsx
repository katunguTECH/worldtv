import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface VideoPlayerProps {
  streamUrl: string;
  channelName: string;
  /*
   * Called whenever the underlying <video> enters/leaves
   * Picture-in-Picture. The App shell uses this to know whether
   * it's safe to unmount the player when the "modal" is closed —
   * unmounting while PiP is active would kill the floating window.
   */
  onPipChange?: (isInPip: boolean) => void;
  /*
   * Called whenever the underlying stream actually starts or stops
   * playing (not just "modal open" — real playback). Used by the
   * parent App to drive a watch-timer for the timed email gate.
   */
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export interface VideoPlayerHandle {
  /*
   * Manually request Picture-in-Picture. Exposed so a "Watch in
   * background" button elsewhere in the UI can trigger the same
   * floating window the control-bar toggle does.
   */
  requestPip: () => Promise<void>;
}

/*
 * ================================================================
 * CASTING SUPPORT (Chromecast + AirPlay)
 * ================================================================
 *
 * Both of these ride on standard browser APIs, so no external SDK
 * or Chromecast receiver app registration is required:
 *
 * - Chromecast / Google Cast: the W3C Remote Playback API
 *   (`videoEl.remote.prompt()`), supported by Chrome/Edge on
 *   desktop + Android. This is the same mechanism that powers the
 *   native cast icon Chrome sometimes shows on <video> elements.
 *
 * - AirPlay: Safari's `webkitShowPlaybackTargetPicker()`,
 *   supported on macOS/iOS Safari.
 *
 * A device only shows up in either picker if it's actually on the
 * same network, so there's nothing else to configure server-side.
 * ================================================================
 */

const supportsRemotePlayback =
  typeof window !== 'undefined' &&
  typeof HTMLMediaElement !== 'undefined' &&
  'remote' in HTMLMediaElement.prototype;

const supportsAirPlay =
  typeof window !== 'undefined' &&
  typeof (window as any).WebKitPlaybackTargetAvailabilityEvent !==
    'undefined';

let castButtonsRegistered = false;

function registerCastButtons() {
  if (castButtonsRegistered) {
    return;
  }

  castButtonsRegistered = true;

  const Button = videojs.getComponent('Button');

  class CastButton extends (Button as any) {
    constructor(player: any, options: any) {
      super(
        player,
        Object.assign({}, options, { controlText: 'Cast to TV' })
      );

      this.addClass('vjs-cast-button');

      if (!supportsRemotePlayback) {
        this.hide();
      }
    }

    /*
     * Let video.js build its normal button markup (this is what
     * sets up controlTextEl_, which the base Button class relies
     * on internally — replacing the markup wholesale, like an
     * earlier version of this code did, breaks that and crashes
     * the player). We only reach in and swap the icon glyph.
     */
    createEl(tag: any, props: any, attributes: any) {
      const el = super.createEl(tag, props, attributes);

      const iconPlaceholder = el.querySelector(
        '.vjs-icon-placeholder'
      );

      if (iconPlaceholder) {
        iconPlaceholder.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
          '<path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>' +
          '</svg>';
      }

      return el;
    }

    handleClick() {
      const videoEl = this.player().tech().el();

      if (videoEl && (videoEl as any).remote && (videoEl as any).remote.prompt) {
        (videoEl as any).remote.prompt().catch((error: any) => {
          console.warn(
            '[WorldTV] Cast prompt failed or was dismissed:',
            error
          );
        });
      }
    }
  }

  class AirPlayButton extends (Button as any) {
    constructor(player: any, options: any) {
      super(
        player,
        Object.assign({}, options, { controlText: 'AirPlay' })
      );

      this.addClass('vjs-airplay-button');

      if (!supportsAirPlay) {
        this.hide();
      }
    }

    createEl(tag: any, props: any, attributes: any) {
      const el = super.createEl(tag, props, attributes);

      const iconPlaceholder = el.querySelector(
        '.vjs-icon-placeholder'
      );

      if (iconPlaceholder) {
        iconPlaceholder.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
          '<path d="M6 22h12l-6-6z"/>' +
          '<path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4v-2H3V5h18v14h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>' +
          '</svg>';
      }

      return el;
    }

    handleClick() {
      const videoEl = this.player().tech().el() as any;

      if (videoEl && videoEl.webkitShowPlaybackTargetPicker) {
        videoEl.webkitShowPlaybackTargetPicker();
      }
    }
  }


  videojs.registerComponent('CastButton', CastButton as any);
  videojs.registerComponent('AirPlayButton', AirPlayButton as any);
}

registerCastButtons();

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

  useEffect(() => {
    onPipChangeRef.current = onPipChange;
  }, [onPipChange]);

  useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onPlayStateChange]);

  React.useImperativeHandle(ref, () => ({
    requestPip: async () => {
      const videoEl = videoRef.current;

      if (!videoEl) {
        return;
      }

      if (document.pictureInPictureElement) {
        return;
      }

      try {
        await videoEl.requestPictureInPicture();
      } catch (error) {
        console.warn(
          '[WorldTV] requestPictureInPicture failed:',
          error
        );
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

  /*
   * ----------------------------------------------------------
   * Pop the YouTube/website iframe out into an always-on-top
   * floating window (Chrome/Edge desktop only — Document
   * Picture-in-Picture API). This is the closest desktop
   * equivalent of the mobile "keep watching while you scroll"
   * behavior for embedded, cross-origin players that don't
   * expose their own <video> element for native PiP.
   * ----------------------------------------------------------
   */
  const popOutIframe = async () => {
    const wrapper = iframeWrapperRef.current;
    const docPip = (window as any).documentPictureInPicture;

    if (!wrapper || !docPip) {
      return;
    }

    try {
      const pipWindow = await docPip.requestWindow({
        width: 480,
        height: 270,
      });

      // Copy over styles so the floating window isn't unstyled.
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const css = Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('');

          const style = pipWindow.document.createElement('style');
          style.textContent = css;
          pipWindow.document.head.appendChild(style);
        } catch (error) {
          // Cross-origin stylesheets can't be read; skip them.
        }
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
      console.warn(
        '[WorldTV] Document Picture-in-Picture failed:',
        error
      );
    }
  };

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
      onPlayStateChangeRef.current?.(false);
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
      muted: false, // CHANGED: from true to false - volume is now on by default
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
          'castButton',
          'airPlayButton',
          'pictureInPictureToggle',
          'fullscreenToggle',
        ],
      },
    });

    /*
     * --------------------------------------------------------
     * Native Picture-in-Picture (mobile "floating over other
     * apps" behavior, same as YouTube's mini player).
     *
     * The `pictureInPictureToggle` control above already wires
     * this up for the video.js UI. We additionally:
     *
     *  - Set Media Session metadata so the floating PiP window
     *    (and lock screen / notification tray) shows the
     *    channel name instead of a blank title.
     *  - Track PiP enter/leave so the parent App can decide
     *    whether it's safe to unmount the player when the user
     *    dismisses the modal (see onPipChange prop).
     * --------------------------------------------------------
     */

    /*
     * IMPORTANT: this runs in its own player.ready() callback,
     * fully isolated (try/catch) from the source-loading logic
     * below. player.tech() is unsafe to call this early (before
     * a source is loaded, video.js may not have an active tech
     * yet, and calling it can throw) — we use the <video> DOM
     * node we already hold a ref to instead, which always exists.
     */
    player.ready(() => {
      try {
        const videoEl = videoRef.current;

        if (
          'mediaSession' in navigator &&
          (navigator as any).mediaSession
        ) {
          try {
            (navigator as any).mediaSession.metadata =
              new (window as any).MediaMetadata({
                title: channelName,
                artist: 'WorldTV',
              });
          } catch (error) {
            console.warn(
              '[WorldTV] Media Session metadata failed:',
              error
            );
          }
        }

        if (videoEl) {
          videoEl.addEventListener('enterpictureinpicture', () => {
            onPipChangeRef.current?.(true);
          });

          videoEl.addEventListener('leavepictureinpicture', () => {
            onPipChangeRef.current?.(false);
          });
        }
      } catch (error) {
        console.warn(
          '[WorldTV] Post-ready setup (media session / PiP listeners) failed:',
          error
        );
      }
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
      onPlayStateChangeRef.current?.(true);
    });

    player.on('pause', () => {
      onPlayStateChangeRef.current?.(false);
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
          `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&rel=0` // CHANGED: from mute=1 to mute=0
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
        ref={iframeWrapperRef}
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

        <div className="absolute bottom-4 right-4 z-10 flex gap-2">
          {typeof window !== 'undefined' &&
            'documentPictureInPicture' in window && (
              <button
                onClick={popOutIframe}
                className="bg-gray-800/90 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm transition flex items-center gap-1"
                title="Float this player in a window on top of everything else"
              >
                Float window ⧉
              </button>
            )}

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
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;