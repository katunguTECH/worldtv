import { useCallback, useEffect, useRef, useState } from 'react';

const FAV_KEY = 'worldtv_favorites';
const LEGACY_FAV_KEY = 'favorites';
const EMAIL_KEY = 'worldtv_email';

/*
============================================================
LOCAL STORAGE HELPERS
============================================================
*/

function readLocalFavorites(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw =
      localStorage.getItem(FAV_KEY) ||
      localStorage.getItem(LEGACY_FAV_KEY) ||
      '[]';

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(ids: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));

    // Keep the legacy key in sync in case any other component
    // still reads it directly.
    localStorage.setItem(LEGACY_FAV_KEY, JSON.stringify(ids));
  } catch {
    // Quota exceeded or private mode — silently ignore.
  }
}

function readEmail(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const e = localStorage.getItem(EMAIL_KEY);
  return e ? e.trim().toLowerCase() : null;
}

/*
============================================================
SERVER SYNC
============================================================
*/

async function fetchServerFavorites(
  email: string
): Promise<string[] | null> {
  try {
    const res = await fetch(
      `/api/favorites?email=${encodeURIComponent(email)}`
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    return Array.isArray(data.favorites)
      ? data.favorites.filter(
          (x: unknown) => typeof x === 'string'
        )
      : [];
  } catch {
    return null;
  }
}

function pushServerFavorites(
  email: string,
  favorites: string[]
) {
  fetch('/api/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, favorites }),
  }).catch(() => {
    // Best-effort — localStorage already has the truth locally.
  });
}

/*
============================================================
HOOK
============================================================
*/

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(
    readLocalFavorites
  );

  const [email, setEmail] = useState<string | null>(
    readEmail
  );

  // Only run the initial server merge once per session, so a
  // transient fetch failure doesn't keep retrying on every
  // render after the user has started toggling.
  const initialSyncDone = useRef(false);

  /*
   * Watch for the email becoming available *after* mount —
   * the EmailGate can set it at any time during the session.
   * We listen both to cross-tab storage events and to window
   * focus (covers same-tab writes that don't fire 'storage').
   */
  useEffect(() => {
    const maybeUpdateEmail = () => {
      const next = readEmail();
      if (next !== email) {
        setEmail(next);
        initialSyncDone.current = false; // allow a fresh sync
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === EMAIL_KEY) {
        maybeUpdateEmail();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', maybeUpdateEmail);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', maybeUpdateEmail);
    };
  }, [email]);

  /*
   * On email present: pull server favorites, merge with local,
   * and push the merged set back up. Merge (not replace) so a
   * viewer who favorited anonymously before entering their
   * email doesn't lose those entries.
   */
  useEffect(() => {
    if (!email || initialSyncDone.current) {
      return;
    }

    initialSyncDone.current = true;

    let cancelled = false;

    (async () => {
      const server = await fetchServerFavorites(email);

      if (cancelled || server === null) {
        return;
      }

      const local = readLocalFavorites();
      const merged = Array.from(
        new Set([...local, ...server])
      );

      setFavorites(merged);
      writeLocalFavorites(merged);

      // Only push if the server was actually missing entries.
      if (merged.length > server.length) {
        pushServerFavorites(email, merged);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  /*
   * Toggle — updates state, localStorage, and (if we know the
   * email) the server, in that order. Local write is synchronous
   * so the UI updates instantly even if the network is down.
   */
  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];

        writeLocalFavorites(next);

        const currentEmail = readEmail();
        if (currentEmail) {
          pushServerFavorites(currentEmail, next);
        }

        return next;
      });
    },
    []
  );

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
}

export default useFavorites;