/*
 * ============================================================
 * TYPE DECLARATIONS FOR @silvermine VIDEO.JS PLUGINS
 * ============================================================
 *
 * The @silvermine/videojs-chromecast and @silvermine/videojs-airplay
 * packages are written in plain JavaScript and do not ship their own
 * TypeScript type definitions. Without these declarations, TypeScript
 * (running in strict mode) refuses to import them with:
 *
 *   TS7016: Could not find a declaration file for module '...'
 *
 * Both packages export a single function that takes the video.js
 * module as its first argument and an optional options object as
 * its second. Calling that function registers the plugin globally
 * on the video.js instance — after which the plugin's button is
 * available in the player's control bar.
 */

declare module '@silvermine/videojs-chromecast' {
  import videojs from 'video.js';

  function chromecast(
    vjs: typeof videojs,
    options?: {
      /**
       * Google Cast receiver application ID.
       * 'CC1AD845' is Google's Default Media Receiver, which
       * understands HLS, MP4, and most live streams out of the box.
       */
      receiver?: string;

      /**
       * Namespace prefix used by the plugin for DOM classes and
       * event names. Defaults to 'vjs-chromecast'.
       */
      namespace?: string;

      /**
       * When true, the plugin uses HTML5 native playback on the
       * receiver rather than the video.js player mirror.
       */
      useCustomReceiver?: boolean;
    }
  ): void;

  export default chromecast;
}

declare module '@silvermine/videojs-airplay' {
  import videojs from 'video.js';

  function airplay(
    vjs: typeof videojs,
    options?: {
      /**
       * When true, the plugin automatically adds an AirPlay button
       * to the video.js control bar.
       */
      addButtonToControlBar?: boolean;

      /**
       * Namespace prefix used by the plugin for DOM classes and
       * event names. Defaults to 'vjs-airplay'.
       */
      namespace?: string;
    }
  ): void;

  export default airplay;
}
