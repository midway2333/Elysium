import { PlaybackLog, Song } from '../types';

// Storage Key
const STORAGE_KEY = 'md3_music_history';

// Load history from local storage
export const loadHistory = (): PlaybackLog[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

// Save history
export const saveHistory = (history: PlaybackLog[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save history", e);
  }
};

// Add a log entry
export const addLog = (history: PlaybackLog[], song: Song, duration: number): PlaybackLog[] => {
    if (duration < 1) return history; // Ignore negligible plays
    
    const newLog: PlaybackLog = {
        songId: song.id, // Using generated ID, but usually we'd want a stable file hash or path
        songName: song.name,
        artist: song.artist || 'Unknown',
        timestamp: Date.now(),
        duration
    };
    
    const newHistory = [...history, newLog];
    saveHistory(newHistory);
    return newHistory;
};

// Helper to get start of dates
const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};
const getStartOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getTime();
const getStartOfQuarter = (date: Date) => {
    const q = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), q * 3, 1).getTime();
};
const getStartOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1).getTime();

export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export const filterLogsByRange = (history: PlaybackLog[], range: TimeRange): PlaybackLog[] => {
    const now = new Date();
    let startTime = 0;

    switch (range) {
        case 'day': startTime = getStartOfDay(now); break;
        case 'week': startTime = getStartOfWeek(now); break;
        case 'month': startTime = getStartOfMonth(now); break;
        case 'quarter': startTime = getStartOfQuarter(now); break;
        case 'year': startTime = getStartOfYear(now); break;
        case 'all': return history;
    }

    return history.filter(log => log.timestamp >= startTime);
};

export interface StatsResult {
    totalTime: number; // Seconds
    topSong: { name: string, artist: string, count: number, time: number } | null;
    topArtist: { name: string, count: number, time: number } | null;
    songRanking: { name: string, artist: string, count: number, time: number }[];
    artistRanking: { name: string, count: number, time: number }[];
}

export const calculateStats = (logs: PlaybackLog[]): StatsResult => {
    let totalTime = 0;
    const songMap = new Map<string, {name: string, artist: string, count: number, time: number}>();
    const artistMap = new Map<string, {name: string, count: number, time: number}>();

    logs.forEach(log => {
        totalTime += log.duration;

        // Song Stats (Key by name+artist to handle duplicate file names across folders if possible, 
        // though ID is better if stable. Here we use name/artist for display aggregation)
        const songKey = `${log.songName}||${log.artist}`;
        if (!songMap.has(songKey)) {
            songMap.set(songKey, { name: log.songName, artist: log.artist, count: 0, time: 0 });
        }
        const s = songMap.get(songKey)!;
        s.count++;
        s.time += log.duration;

        // Artist Stats
        const artistKey = log.artist;
        if (!artistMap.has(artistKey)) {
            artistMap.set(artistKey, { name: log.artist, count: 0, time: 0 });
        }
        const a = artistMap.get(artistKey)!;
        a.count++;
        a.time += log.duration;
    });

    // Sort Maps to Arrays
    const songRanking = Array.from(songMap.values()).sort((a, b) => b.time - a.time);
    const artistRanking = Array.from(artistMap.values()).sort((a, b) => b.time - a.time);

    return { 
        totalTime, 
        topSong: songRanking[0] || null, 
        topArtist: artistRanking[0] || null,
        songRanking,
        artistRanking
    };
};

export const formatDuration = (seconds: number, short = false): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    if (short) {
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }
    
    if (h > 0) return `${h} hours ${m} minutes`;
    return `${m} minutes`;
};