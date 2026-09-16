import React, { useEffect, useRef, useState } from 'react';
import { Channel } from './types/channel.types';
import {
  initializeChannels,
  getCountries,
  getCategories,
  getChannelsByCountry,
  searchChannels,
  refreshChannels
} from './services/channelService';

import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import ChannelGrid from './components/ChannelGrid';
import VideoPlayer, {
  VideoPlayerHandle,
} from './components/VideoPlayer';
import EmailGate from './components/EmailGate';
import WhatsAppButton from './components/WhatsAppButton';

import { useFavorites } from './hooks/useFavorites';

/*
============================================================
COUNTRY URL HELPERS
============================================================
*/

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'USA',
  us: 'USA',

  uk: 'United Kingdom',
  unitedkingdom: 'United Kingdom',
  gb: 'United Kingdom',

  uae: 'UAE',
  unitedarabemirates: 'UAE',

  southafrica: 'South Africa',
  south_africa: 'South Africa',

  southkorea: 'South Korea',
  south_korea: 'South Korea',

  hongkong: 'Hong Kong',
  hong_kong: 'Hong Kong',

  newzealand: 'New Zealand',
  new_zealand: 'New Zealand',
};

function countryFromUrl(): string {
  const path = window.location.pathname.toLowerCase();

  if (!path.startsWith('/tv/')) {
    return 'All';
  }

  const slug = path
    .replace('/tv/', '')
    .replace(/\/+$/, '');

  if (!slug) {
    return 'All';
  }

  /*
    If the server already provided country information,
    prefer that value.
  */
  const serverCountry = (
    window as any
  ).__WORLDTV_COUNTRY__?.country;

  if (serverCountry) {
    return serverCountry;
  }

  /*
    Convert URL slug to a readable country name.
  */
  const normalizedSlug = slug
    .replace(/-/g, '')
    .replace(/_/g, '');

  if (COUNTRY_ALIASES[normalizedSlug]) {
    return COUNTRY_ALIASES[normalizedSlug];
  }

  /*
    Fallback:
    Turn "kenya" into "Kenya",
    "nigeria" into "Nigeria", etc.
  */
  return slug
    .split('-')
    .map(
      part =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(' ');
}

/*
============================================================
APP
============================================================
*/

function App() {
  const initialCountry = countryFromUrl();

  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [selectedCountry, setSelectedCountry] =
    useState(initialCountry);

  const [selectedCategory, setSelectedCategory] =
    useState('All');

  const [selectedChannel, setSelectedChannel] =
    useState<Channel | null>(null);

  /*
    Whether the grid is currently filtered down to favorites
    only. Toggled by the "Favs" button in the header; cleared
    whenever the viewer picks a country or category so those
    controls don't silently fight the favorites filter.
  */
  const [showFavoritesOnly, setShowFavoritesOnly] =
    useState(false);

  /*
    The big modal ("now playing" overlay) and the mounted
    <VideoPlayer> are decoupled on purpose. Closing the modal
    normally unmounts the player and stops the stream — but if
    the viewer has put the video into Picture-in-Picture (the
    floating window that stays on top of other apps, same as
    YouTube's mini player), unmounting would kill that floating
    window. So we only unmount when it's actually safe to.
  */
  const [isPlayerModalOpen, setIsPlayerModalOpen] =
    useState(false);

  const [isPip, setIsPip] = useState(false);

  const videoPlayerRef =
    useRef<VideoPlayerHandle>(null);

  const [currentChannels, setCurrentChannels] =
    useState<Channel[]>([]);

  const [hasEmail, setHasEmail] =
    useState<boolean>(
      () =>
        !!localStorage.getItem(
          'worldtv_email'
        )
    );

  /*
    Timed email gate — instead of blocking the whole app on first
    render, we let people browse freely (grid, search, and playing
    channels all work with no gate) for SESSION_THRESHOLD_MINUTES of
    *wall-clock time since they first landed on the site*. Once that
    elapses, showEmailGate flips true and stays true — rendered at the
    root of the app (see below), so it blocks all further browsing,
    not just the video — until they confirm an email (or hasEmail was
    already true, in which case the timer never even starts).

    The session start time is stored in localStorage so a reload (or
    coming back an hour later without confirming) doesn't reset the
    clock — only actually confirming an email clears the gate for
    good.
  */
  const SESSION_THRESHOLD_MINUTES = 15;
  const SESSION_START_KEY = 'worldtv_session_start';
  const [showEmailGate, setShowEmailGate] = useState(false);
  const gateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasEmail) {
      return; // already confirmed — never start the timer at all
    }

    let sessionStart = Number(localStorage.getItem(SESSION_START_KEY)) || 0;
    if (!sessionStart) {
      sessionStart = Date.now();
      localStorage.setItem(SESSION_START_KEY, String(sessionStart));
    }

    const thresholdMs = SESSION_THRESHOLD_MINUTES * 60 * 1000;
    const remaining = thresholdMs - (Date.now() - sessionStart);

    if (remaining <= 0) {
      setShowEmailGate(true);
      return;
    }

    gateTimerRef.current = setTimeout(() => {
      setShowEmailGate(true);
    }, remaining);

    return () => {
      if (gateTimerRef.current) {
        clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
      }
    };
  }, [hasEmail]);

  const countries = getCountries();
  const categories = getCategories();

  const {
    favorites,
    toggleFavorite,
    isFavorite
  } = useFavorites();

  /*
  ============================================================
  TRACK VISIT
  ============================================================
  */

  useEffect(() => {
    fetch('/api/track-visit', {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body: JSON.stringify({
        path:
          window.location.pathname
      }),
    }).catch(() => {});
  }, []);

  /*
  ============================================================
  LOAD CHANNELS
  ============================================================
  */

  useEffect(() => {
    const loadChannels = async () => {
      setLoading(true);

      try {
        console.log(
          'App: Loading channels...'
        );

        await initializeChannels();

        console.log(
          'App: Channels initialized, loading from service...'
        );

        const country =
          countryFromUrl();

        const channels =
          getChannelsByCountry(
            country
          );

        console.log(
          `App: Loaded ${channels.length} channels for ${country}`
        );

        setSelectedCountry(country);
        setCurrentChannels(channels);

      } catch (error) {
        console.error(
          'App: Error loading channels:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadChannels();
  }, []);

  /*
  ============================================================
  FILTER CHANNELS
  ============================================================
  */

  useEffect(() => {
    if (loading) {
      return;
    }

    let channels: Channel[] = [];

    if (showFavoritesOnly) {
      /*
        Favorites view is its own mode: pull from the full
        channel list (not the currently-selected country) so
        favorites from any country show up together, then keep
        only what's actually favorited. Search still narrows
        further if the viewer is typing.
      */
      channels =
        getChannelsByCountry('All').filter(
          channel => isFavorite(channel.id)
        );

      if (searchQuery) {
        const q = searchQuery.toLowerCase();

        channels = channels.filter(
          channel =>
            channel.name
              .toLowerCase()
              .includes(q) ||
            channel.country
              .toLowerCase()
              .includes(q) ||
            channel.category
              .toLowerCase()
              .includes(q)
        );
      }
    } else if (searchQuery) {
      channels =
        searchChannels(
          searchQuery
        );
    } else {
      channels =
        getChannelsByCountry(
          selectedCountry
        );

      if (
        selectedCategory !==
        'All'
      ) {
        channels =
          channels.filter(
            channel =>
              channel.category ===
              selectedCategory
          );
      }
    }

    setCurrentChannels(
      channels
    );

  }, [
    searchQuery,
    selectedCountry,
    selectedCategory,
    loading,
    showFavoritesOnly,
    favorites
  ]);

  /*
  ============================================================
  COUNTRY SELECT
  ============================================================
  */

  const handleCountrySelect = (
    country: string
  ) => {
    setSelectedCountry(
      country
    );

    setSearchQuery('');

    /*
      Picking a country is a deliberate "show me this region"
      action, so drop out of favorites-only mode. Otherwise the
      grid would keep ignoring the country they just clicked.
    */
    setShowFavoritesOnly(false);

    /*
      When a user manually selects a country,
      update the URL to the country SEO page.
    */
    if (
      country !== 'All'
    ) {
      const slug =
        country
          .toLowerCase()
          .replace(/\s+/g, '-');

      window.history.pushState(
        {},
        '',
        `/tv/${slug}`
      );
    } else {
      window.history.pushState(
        {},
        '',
        '/'
      );
    }
  };

  /*
  ============================================================
  CATEGORY SELECT
  ============================================================
  */

  const handleCategorySelect = (
    category: string
  ) => {
    setSelectedCategory(
      category
    );

    setSearchQuery('');

    setShowFavoritesOnly(false);
  };

  /*
  ============================================================
  FAVORITES VIEW TOGGLE
  ============================================================
  */

  const handleToggleFavoritesView = () => {
    setShowFavoritesOnly(
      prev => !prev
    );

    /*
      Clear search so the first click of "Favs" shows every
      favorite, not "favorites matching whatever was typed".
    */
    setSearchQuery('');
  };

  /*
  ============================================================
  CHANNEL SELECT
  ============================================================
  */

  const handleChannelSelect = (
    channel: Channel
  ) => {
    setSelectedChannel(
      channel
    );

    setIsPlayerModalOpen(true);
    setShowEmailGate(false);
  };

  /*
  ============================================================
  RANDOM CHANNEL
  ============================================================
  */

  const handleRandomChannel = () => {
    if (
      currentChannels.length === 0
    ) {
      return;
    }

    const randomIndex =
      Math.floor(
        Math.random() *
          currentChannels.length
      );

    setSelectedChannel(
      currentChannels[
        randomIndex
      ]
    );

    setIsPlayerModalOpen(true);
    setShowEmailGate(false);
  };

  /*
  ============================================================
  CLOSE PLAYER
  ============================================================
  */

  const handleCloseModal = () => {
    setIsPlayerModalOpen(false);

    /*
      If the viewer has floated the video into Picture-in-Picture,
      leave `selectedChannel` set so <VideoPlayer> stays mounted
      and the floating window keeps playing while they browse the
      channel grid underneath. It gets fully unmounted either when
      they pick a new channel, or when they exit PiP (see
      handlePipChange below).
    */
    if (!isPip) {
      setSelectedChannel(null);
    }
  };

  /*
  ============================================================
  PICTURE-IN-PICTURE STATE
  ============================================================
  */

  const handlePipChange = (nowInPip: boolean) => {
    setIsPip(nowInPip);

    /*
      The viewer manually closed the floating PiP window (rather
      than the in-app modal) while the modal was already hidden —
      nothing left referencing the stream, so tear it down.
    */
    if (!nowInPip && !isPlayerModalOpen) {
      setSelectedChannel(null);
    }
  };

  /*
  ============================================================
  REFRESH CHANNELS
  ============================================================
  */

  const handleRefreshChannels =
    async () => {
      setLoading(true);

      try {
        console.log(
          'Refreshing channels...'
        );

        await refreshChannels();

        const channels =
          getChannelsByCountry(
            selectedCountry
          );

        console.log(
          `App: Refreshed ${channels.length} channels`
        );

        setCurrentChannels(
          channels
        );

      } catch (error) {
        console.error(
          'App: Error refreshing channels:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

  /*
  ============================================================
  CLEAR CACHE
  ============================================================
  */

  const handleClearCache = () => {
    if (
      window.confirm(
        'Clear all cached data and refresh?'
      )
    ) {
      localStorage.removeItem(
        'iptv_channels'
      );

      // Favorites are user data, not cache — deliberately NOT
      // removed here. They live under 'worldtv_favorites' (and
      // on the server, keyed by email) and survive this reset.

      alert(
        'Cache cleared! Favorites were kept. Click Refresh to reload channels.'
      );

      window.location.reload();
    }
  };

  /*
  ============================================================
  LOADING SCREEN
  ============================================================
  */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">

          <div className="text-white text-4xl mb-4">
            WorldTV
          </div>

          <div className="text-white text-xl animate-pulse">
            Loading channels...
          </div>

          <div className="text-gray-400 text-sm mt-2">
            This may take a moment
          </div>

        </div>
      </div>
    );
  }

  /*
  ============================================================
  MAIN APPLICATION
  ============================================================
  */

  const favoriteCount = favorites.length;

  return (
    <div className="flex h-screen bg-gray-900">

      <Sidebar
        selectedCountry={
          selectedCountry
        }
        onCountrySelect={
          handleCountrySelect
        }
        countries={
          countries
        }
        selectedCategory={
          selectedCategory
        }
        onCategorySelect={
          handleCategorySelect
        }
        categories={
          categories
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}

        <header className="p-4 border-b border-gray-700 bg-gray-800">

          <div className="flex items-center justify-between mb-3">

            <div>

              <h1 className="text-white text-2xl font-bold">
                WorldTV
              </h1>

              {showFavoritesOnly ? (
                <div className="text-yellow-400 text-sm mt-1">
                  Your favorites
                </div>
              ) : (
                selectedCountry !==
                  'All' && (
                  <div className="text-gray-400 text-sm mt-1">
                    Live TV from{' '}
                    {selectedCountry}
                  </div>
                )
              )}

            </div>

            <div className="flex items-center gap-2">

              <span className="text-gray-400 text-sm">
                {currentChannels.length}{' '}
                channels
              </span>

              <button
                onClick={
                  handleClearCache
                }
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm"
              >
                Clear
              </button>

              <button
                onClick={
                  handleRefreshChannels
                }
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm"
              >
                Refresh
              </button>

              <button
                onClick={
                  handleRandomChannel
                }
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm"
              >
                Random
              </button>

              <button
                onClick={
                  handleToggleFavoritesView
                }
                title={
                  showFavoritesOnly
                    ? 'Show all channels'
                    : 'Show only your favorites'
                }
                className={
                  showFavoritesOnly
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm font-semibold ring-2 ring-yellow-300'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm'
                }
              >
                ★ Favs
                {favoriteCount > 0 && (
                  <span
                    className={
                      showFavoritesOnly
                        ? 'bg-gray-900 text-yellow-300 text-xs px-1.5 py-0.5 rounded-full'
                        : 'bg-yellow-800 text-yellow-100 text-xs px-1.5 py-0.5 rounded-full'
                    }
                  >
                    {favoriteCount}
                  </span>
                )}
              </button>

            </div>

          </div>

          <SearchBar
            value={
              searchQuery
            }
            onChange={
              setSearchQuery
            }
          />

        </header>

        {/* CHANNEL GRID */}

        <main className="flex-1 overflow-y-auto p-4">

          {showFavoritesOnly &&
          currentChannels.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-4">
                <div className="text-yellow-400 text-5xl mb-4">
                  ★
                </div>
                <div className="text-white text-xl mb-2">
                  No favorites yet
                </div>
                <div className="text-gray-400 text-sm">
                  Open any channel and click the{' '}
                  <span className="text-yellow-400 font-medium">
                    Fav
                  </span>{' '}
                  button in the player to save it here.
                  Favorites are stored on this device.
                </div>
              </div>
            </div>
          ) : (
            <ChannelGrid
              channels={
                currentChannels
              }
              onChannelSelect={
                handleChannelSelect
              }
              favorites={
                favorites
              }
              onToggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )}

        </main>

      </div>

      {/* PLAYER MODAL */}

      {/*
        IMPORTANT: <VideoPlayer> below is mounted in exactly ONE place in
        the tree, unconditionally, for as long as `selectedChannel` is
        set — regardless of whether the modal is open or the viewer has
        floated it into Picture-in-Picture ("Watch in background").

        Only the surrounding chrome (header/footer, backdrop, sizing)
        is toggled based on `isPlayerModalOpen`. This used to be two
        separate conditional blocks, each rendering its own <VideoPlayer>
        at a different spot in the tree — which meant React unmounted
        one and mounted a brand-new one whenever the modal opened or
        closed. That destroyed the underlying <video> element (and, if
        it was in native PiP, silently ended/froze the floating window)
        every time. Picking a new channel from the grid while "Watch in
        background" was active suffered the same problem: it reopens
        the modal, which used to swap VideoPlayer instances instead of
        just handing the same instance a new `streamUrl`.

        Keeping a single, persistent <VideoPlayer> means changing
        channels just updates its props — the same <video> element (and
        any active native PiP session) stays alive and switches to the
        new channel in place.
      */}

      {selectedChannel && (

        <div
          className={
            isPlayerModalOpen
              ? 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4'
              : 'fixed opacity-0 pointer-events-none w-1 h-1 overflow-hidden top-0 left-0 z-0'
          }
          onClick={
            handleCloseModal
          }
        >

          <div
            className={
              isPlayerModalOpen
                ? 'bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto'
                : ''
            }
            onClick={e =>
              e.stopPropagation()
            }
          >

            {/* PLAYER HEADER */}

            {isPlayerModalOpen && (

              <div className="flex justify-between items-start p-4 border-b border-gray-700">

                <div className="flex-1">

                  <h2 className="text-white text-xl font-bold">
                    {
                      selectedChannel.name
                    }
                  </h2>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">

                    <span className="text-gray-400 text-sm">
                      {
                        selectedChannel.country
                      }
                    </span>

                    <span className="text-blue-400 text-sm bg-blue-900/30 px-2 py-0.5 rounded">
                      {
                        selectedChannel.category
                      }
                    </span>

                    <span className="text-gray-500 text-sm">
                      {
                        selectedChannel.language
                      }
                    </span>

                    <button
                      onClick={() =>
                        toggleFavorite(
                          selectedChannel.id
                        )
                      }
                      title={
                        isFavorite(
                          selectedChannel.id
                        )
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                      className={
                        isFavorite(
                          selectedChannel.id
                        )
                          ? 'text-xl transition text-yellow-400 hover:text-yellow-300'
                          : 'text-xl transition text-gray-500 hover:text-yellow-400'
                      }
                    >
                      {isFavorite(
                        selectedChannel.id
                      )
                        ? '★ Fav'
                        : '☆ Fav'}
                    </button>

                  </div>

                </div>

                <div className="flex items-center gap-3 ml-4">

                  {typeof document !== 'undefined' &&
                    document.pictureInPictureEnabled && (
                    <button
                      onClick={() =>
                        videoPlayerRef.current?.requestPip()
                      }
                      className="text-gray-300 hover:text-white text-sm border border-gray-600 hover:border-gray-500 rounded px-3 py-1.5 transition"
                      title="Keep watching in a floating window while you browse"
                    >
                      Watch in background ⧉
                    </button>
                  )}

                  <button
                    onClick={
                      handleCloseModal
                    }
                    className="text-gray-400 hover:text-white text-2xl leading-none"
                  >
                    Close
                  </button>

                </div>

              </div>

            )}

            {/* VIDEO — always mounted; see note above. */}

            <div className={isPlayerModalOpen ? 'p-4 relative' : ''}>

              <VideoPlayer
                ref={videoPlayerRef}
                streamUrl={
                  selectedChannel.streamUrl
                }
                channelName={
                  selectedChannel.name
                }
                onPipChange={
                  handlePipChange
                }
              />

            </div>

            {/* STREAM INFORMATION */}

            {isPlayerModalOpen && (

              <div className="p-4 border-t border-gray-700 bg-gray-800/50">

                <div className="flex items-center justify-between text-sm">

                  <div className="text-gray-400 truncate">

                    <span className="font-medium">
                      Stream URL:
                    </span>{' '}

                    <span className="text-gray-500 truncate inline-block max-w-xs">
                      {
                        selectedChannel.streamUrl
                      }
                    </span>

                  </div>

                  <button
                    onClick={() =>
                      window.open(
                        selectedChannel.streamUrl,
                        '_blank'
                      )
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                  >
                    Open in new tab
                  </button>

                </div>

              </div>

            )}

          </div>

        </div>

      )}

      {/*
        FLOATING PIP PILL
        ============================================================
        The modal is closed but the viewer floated the video into
        Picture-in-Picture, so the stream is still live in a floating
        OS-level window. This pill just lets them jump back into the
        full modal or stop the stream entirely — the actual
        <VideoPlayer> stays mounted above regardless of this pill's
        presence.
      */}

      {selectedChannel && !isPlayerModalOpen && isPip && (

        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white text-sm rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <span>
            Floating: {selectedChannel.name}
          </span>

          <button
            onClick={() =>
              setIsPlayerModalOpen(true)
            }
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Reopen
          </button>

          <button
            onClick={() => {
              if (document.pictureInPictureElement) {
                document
                  .exitPictureInPicture()
                  .catch(() => {});
              }

              setSelectedChannel(null);
            }}
            className="text-gray-400 hover:text-white"
          >
            Stop
          </button>
        </div>

      )}

      {/* WHATSAPP */}

      <WhatsAppButton />

      {/*
        Full-app timed email gate — renders on top of everything
        (sidebar, grid, search, player) once the free-browsing window
        has elapsed for a visitor who hasn't confirmed an email yet.
      */}
      {showEmailGate && !hasEmail && (
        <EmailGate
          onSubmit={() => {
            setHasEmail(true);
            setShowEmailGate(false);
            localStorage.removeItem(SESSION_START_KEY);
          }}
        />
      )}

    </div>
  );
}

export default App;