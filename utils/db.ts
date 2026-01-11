import { Song } from '../types';

const DB_NAME = 'ElysiumDB';
const DB_VERSION = 1;
const STORE_NAME = 'songs';

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save Songs (Files) to DB (Initial Bulk Save)
export const saveSongsToDB = async (songs: Song[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // We do NOT clear automatically anymore to support appending, 
    // but for folder selection logic (replacement), the App.tsx handles state.
    // However, to mimic "Open Folder" behavior (replace all), we usually want to clear.
    // For this implementation, we Clear to keep sync simple with the UI state.
    store.clear();

    songs.forEach(song => {
      const songRecord = {
        id: song.id,
        name: song.name,
        artist: song.artist,
        file: song.file, 
        coverUrl: song.coverUrl, // Persist cover if available (Base64 string)
      };
      store.put(songRecord);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Update a single song's metadata
export const updateSongInDB = async (song: Song): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const songRecord = {
            id: song.id,
            name: song.name,
            artist: song.artist,
            file: song.file,
            coverUrl: song.coverUrl
        };

        store.put(songRecord);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Load Songs from DB
export const loadSongsFromDB = async (): Promise<Song[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result;
      const songs: Song[] = records.map((record: any) => ({
        id: record.id,
        name: record.name,
        artist: record.artist,
        file: record.file,
        url: URL.createObjectURL(record.file),
        coverUrl: record.coverUrl 
      }));
      resolve(songs);
    };

    request.onerror = () => reject(request.error);
  });
};
