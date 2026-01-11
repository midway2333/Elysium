import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { Song, PlaybackMode, ThemeColors, DEFAULT_THEME_COLOR, PlaybackLog, AppSettings } from './types';
import { generateTheme, generateDarkTheme } from './utils/theme';
import { formatTime } from './utils/format';
import { loadHistory, addLog, filterLogsByRange, calculateStats, formatDuration, TimeRange, StatsResult } from './utils/stats';
import { getMetadata } from './utils/metadata';
import { saveSongsToDB, loadSongsFromDB, updateSongInDB } from './utils/db';
import { MediaSession } from '@jofr/capacitor-media-session';
import { 
  PlayIcon, PauseIcon, SkipNextIcon, SkipPrevIcon, 
  ShuffleIcon, RepeatIcon, RepeatOneIcon, FolderOpenIcon, 
  PaletteIcon, MusicNoteIcon, DarkModeIcon, LightModeIcon, 
  TranslateIcon, SettingsIcon, ArrowBackIcon, StatsIcon, InfoIcon,
  ChevronDownIcon, SearchIcon, CloseIcon, ShareIcon, FileTextIcon, MoreVertIcon
} from './components/Icons';

// Translations
const translations = {
  en: {
    title: "Elysium",
    noMusic: "No music selected",
    hint: "Tap the folder icon to select music files.", 
    songs: "songs",
    choose: "Choose a song",
    unknown: "Unknown Artist",
    select: "Select",
    settings: "Settings",
    appearance: "Appearance",
    general: "General",
    playback: "Playback",
    stats: "Statistics",
    darkMode: "Dark Mode",
    themeColor: "Theme Color",
    language: "Language",
    back: "Back",
    pauseOnDisconnect: "Pause on Disconnect",
    pauseOnDisconnectHint: "Pause when Bluetooth/Headphones disconnected",
    enableBlur: "Dynamic Blur",
    enableBlurHint: "Use blurred album art for player background",
    statDay: "Today",
    statWeek: "Week",
    statMonth: "Month",
    statQuarter: "Quarter",
    statYear: "Year",
    statAll: "All Time",
    listeningTime: "Listening Time",
    topSong: "Top Song",
    topArtist: "Top Artist",
    noStats: "No listening data yet",
    detailedStats: "Detailed Statistics",
    search: "Search music...",
    songsList: "Songs",
    artistsList: "Artists",
    share: "Share",
    details: "Details",
    fileInfo: "File Info",
    fileName: "File Name",
    fileSize: "Size",
    fileType: "Format",
    lastModified: "Modified",
    info: "Info",
    aboutApp: "About Elysium",
    developer: "Developer",
    basedOn: "Implementation",
    links: "Links",
    loading: "Loading library..."
  },
  zh: {
    title: "Elysium",
    noMusic: "未选择音乐",
    hint: "点击文件夹图标选择音乐文件",
    songs: "首歌曲",
    choose: "选择一首歌曲",
    unknown: "未知艺术家",
    select: "选择",
    settings: "设置",
    appearance: "外观",
    general: "通用",
    playback: "播放",
    stats: "统计信息",
    darkMode: "深色模式",
    themeColor: "主题色",
    language: "语言",
    back: "返回",
    pauseOnDisconnect: "断开连接暂停",
    pauseOnDisconnectHint: "蓝牙或耳机断开时自动暂停",
    enableBlur: "动态模糊",
    enableBlurHint: "使用模糊的专辑封面作为播放器背景",
    statDay: "今日",
    statWeek: "本周",
    statMonth: "本月",
    statQuarter: "本季",
    statYear: "今年",
    statAll: "全部",
    listeningTime: "收听时长",
    topSong: "最常听曲目",
    topArtist: "最常听艺人",
    noStats: "暂无收听数据",
    detailedStats: "详细统计信息",
    search: "搜索音乐...",
    songsList: "曲目排行",
    artistsList: "艺人排行",
    share: "分享",
    details: "详细信息",
    fileInfo: "文件信息",
    fileName: "文件名",
    fileSize: "大小",
    fileType: "格式",
    lastModified: "修改时间",
    info: "信息",
    aboutApp: "关于 Elysium",
    developer: "开发",
    basedOn: "技术实现",
    links: "链接",
    loading: "正在加载曲库..."
  }
};

// Helper for hex to rgba conversion
const hexToRgba = (hex: string, alpha: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`
    : hex;
};

type ViewState = 'main' | 'settings' | 'stats' | 'info';

// --- Reusable Components ---

// Swipeable Panel Logic Hook
const useSwipeDismiss = (isOpen: boolean, onClose: () => void, threshold = 100) => {
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStart = useRef(0);

    useEffect(() => {
        if(!isOpen) setOffset(0);
    }, [isOpen]);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStart.current = e.touches[0].clientX;
        setIsDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isOpen) return;
        const diff = e.touches[0].clientX - touchStart.current;
        // Only allow dragging to the right (positive diff)
        if (diff > 0) {
            setOffset(diff);
        }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (!isOpen) return;
        setIsDragging(false);
        const diff = e.changedTouches[0].clientX - touchStart.current;
        if (diff > threshold) {
            onClose();
            setOffset(0); 
        } else {
            setOffset(0); // Bounce back
        }
    };
    
    return { offset, isDragging, handlers: { onTouchStart, onTouchMove, onTouchEnd }};
}

const SlideOverPanel = ({ 
    isOpen, 
    onClose, 
    children, 
    theme,
    title,
    zIndex = 40
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    children: React.ReactNode, 
    theme: ThemeColors,
    title: React.ReactNode,
    zIndex?: number
}) => {
    const { offset, isDragging, handlers } = useSwipeDismiss(isOpen, onClose);

    return (
        <div 
            className={`absolute inset-0 flex flex-col bg-white shadow-2xl overflow-hidden`}
            style={{ 
                backgroundColor: theme.background,
                transform: isOpen 
                    ? `translateX(${offset}px)` 
                    : 'translateX(100%)',
                transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.0, 0, 1.0)',
                zIndex: zIndex
            }}
            {...handlers}
        >
             <div className="h-16 flex items-center px-4 gap-4 shrink-0 shadow-sm relative z-10" style={{ backgroundColor: theme.surface }}>
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}><ArrowBackIcon /></button>
                  <h1 className="text-xl font-medium" style={{color: theme.onSurface}}>{title}</h1>
             </div>
             <div className="flex-1 overflow-y-auto">
                {children}
             </div>
        </div>
    );
};

// Memoized Song Item
const SongListItem = React.memo(({ 
    song, 
    isActive, 
    isPlaying, 
    theme, 
    onClick 
}: { 
    song: Song, 
    isActive: boolean, 
    isPlaying: boolean, 
    theme: ThemeColors, 
    onClick: () => void 
}) => {
    return (
        <div
        onClick={onClick}
        className={`flex items-center p-3 rounded-2xl cursor-pointer transition-colors duration-200 group`}
        style={{ 
            backgroundColor: isActive ? theme.primaryContainer : 'transparent',
            color: isActive ? theme.onPrimaryContainer : theme.onSurface,
            contentVisibility: 'auto',
            containIntrinsicSize: '0 72px' 
        }}
        >
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mr-4 shrink-0 overflow-hidden bg-cover bg-center border border-black/5" 
                    style={{ 
                        backgroundColor: isActive ? theme.primary : theme.surfaceVariant,
                        backgroundImage: song.coverUrl ? `url(${song.coverUrl})` : 'none',
                        color: isActive ? theme.onPrimary : theme.onSurfaceVariant
                    }}>
                {!song.coverUrl && (isActive ? (isPlaying ? <div className="w-3 h-3 bg-current rounded-sm animate-pulse"/> : <PlayIcon className="w-5 h-5"/>) : <MusicNoteIcon className="w-5 h-5 opacity-50"/>)}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`font-medium truncate ${isActive ? '' : 'text-base'}`}>{song.name}</p>
                {song.artist && <p className="text-sm opacity-70 truncate">{song.artist}</p>}
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.song.id === next.song.id && 
           prev.isActive === next.isActive && 
           prev.isPlaying === next.isPlaying &&
           prev.theme === next.theme;
});


const App: React.FC = () => {
  // --- State Initialization ---
  const [isLoading, setIsLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  
  // Load initial state from LocalStorage
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(() => {
      const saved = localStorage.getItem('elysium_last_index');
      return saved ? parseInt(saved, 10) : -1;
  });
  
  const [mode, setMode] = useState<PlaybackMode>(() => {
      const saved = localStorage.getItem('elysium_mode');
      return (saved as PlaybackMode) || PlaybackMode.SEQUENCE;
  });

  const [themeColor, setThemeColor] = useState<string>(() => {
     return localStorage.getItem('elysium_theme_color') || DEFAULT_THEME_COLOR;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
      const saved = localStorage.getItem('elysium_dark_mode');
      return saved !== null ? JSON.parse(saved) : true;
  });

  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
      const saved = localStorage.getItem('elysium_language');
      return (saved as 'en' | 'zh') || 'zh';
  });

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('elysium_settings');
      return saved ? JSON.parse(saved) : { pauseOnDisconnect: true, enableBlur: true };
  });

  // Runtime State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Shuffle Queue State
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  // UI State
  const [view, setView] = useState<ViewState>('main');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Animation State
  const [isAnimating, setIsAnimating] = useState(false); 
  
  // Refs
  const fullPlayerRef = useRef<HTMLDivElement>(null);
  const albumArtContainerRef = useRef<HTMLDivElement>(null);
  const prevCardRef = useRef<HTMLDivElement>(null);
  const currentCardRef = useRef<HTMLDivElement>(null);
  const nextCardRef = useRef<HTMLDivElement>(null);

  const touchStartRef = useRef(0); 
  const touchStartXRef = useRef(0); 
  const currentTranslateY = useRef(0);
  const currentTranslateX = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSwitchingRef = useRef(false); 
  
  const pendingCarouselReset = useRef<'next' | 'prev' | null>(null);
  const layoutResetNeededRef = useRef(false);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [history, setHistory] = useState<PlaybackLog[]>([]);
  const [statRange, setStatRange] = useState<TimeRange>('day');
  const [theme, setTheme] = useState<ThemeColors>(generateDarkTheme(DEFAULT_THEME_COLOR));

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPlayStartRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const currentSong = songs[currentSongIndex];
  const t = translations[language];

  // --- Effects for Persistence ---
  useEffect(() => localStorage.setItem('elysium_last_index', currentSongIndex.toString()), [currentSongIndex]);
  useEffect(() => localStorage.setItem('elysium_mode', mode), [mode]);
  useEffect(() => localStorage.setItem('elysium_theme_color', themeColor), [themeColor]);
  useEffect(() => localStorage.setItem('elysium_dark_mode', JSON.stringify(isDarkMode)), [isDarkMode]);
  useEffect(() => localStorage.setItem('elysium_language', language), [language]);
  useEffect(() => localStorage.setItem('elysium_settings', JSON.stringify(appSettings)), [appSettings]);

  // Load Songs from IndexedDB on Mount
  useEffect(() => {
    const init = async () => {
        setIsLoading(true);
        try {
            const storedSongs = await loadSongsFromDB();
            if (storedSongs.length > 0) {
                setSongs(storedSongs);
                // Background metadata check
                setTimeout(() => {
                    const checkMetadata = async () => {
                        let needsParse = false;
                        for(let i=0; i<Math.min(storedSongs.length, 5); i++) {
                             if (!storedSongs[i].artist && storedSongs[i].name === storedSongs[i].file.name.replace(/\.[^/.]+$/, "")) {
                                 needsParse = true;
                                 break;
                             }
                        }
                        if (needsParse) {
                             processMetadataQueue(storedSongs, 0);
                        }
                    };
                    checkMetadata();
                }, 2000);
            }
        } catch (e) {
            console.error("Error loading songs from DB", e);
        } finally {
            setIsLoading(false);
        }
    };
    init();
  }, []);

  // Metadata Parser Queue
  const processMetadataQueue = useCallback(async (songsToProcess: Song[], startIndex: number = 0) => {
        const batchSize = 5; 
        const endIndex = Math.min(startIndex + batchSize, songsToProcess.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const song = songsToProcess[i];
            try {
                if (song.artist && song.artist !== "Unknown Artist") continue;

                const meta = await getMetadata(song.file);
                if (meta.title || meta.artist || meta.picture) {
                    const updatedSong = {
                        ...song,
                        name: meta.title || song.name,
                        artist: meta.artist,
                        coverUrl: meta.picture
                    };
                    setSongs(prev => prev.map(s => s.id === song.id ? updatedSong : s));
                    await updateSongInDB(updatedSong);
                }
            } catch (e) {
                console.warn(`Failed to parse metadata for ${song.name}`, e);
            }
        }
        
        if (endIndex < songsToProcess.length) {
            setTimeout(() => processMetadataQueue(songsToProcess, endIndex), 500);
        }
  }, []);

  // Shuffle Generator
  useEffect(() => {
    if (mode === PlaybackMode.SHUFFLE && songs.length > 0) {
        const indices = Array.from({ length: songs.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffledIndices(indices);
    }
  }, [mode, songs.length]);

  // Detect Mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
      const mobile = Boolean(userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i));
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  // History Trap
  useEffect(() => {
      const pushTrap = () => {
          window.history.pushState({ trap: true }, '', '');
      };
      pushTrap();

      const handlePopState = (event: PopStateEvent) => {
          let handled = false;
          if (isImageViewerOpen) {
              setIsImageViewerOpen(false);
              handled = true;
          } else if (isDetailsOpen) {
              setIsDetailsOpen(false);
              handled = true;
          } else if (isFullPlayerOpen) {
              setIsFullPlayerOpen(false);
              handled = true;
          } else if (view !== 'main') {
              setView('main');
              handled = true;
          }

          if (handled) {
              pushTrap();
          }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [isFullPlayerOpen, view, isDetailsOpen, isImageViewerOpen]);

  // View Navigation Helpers
  const navigateTo = (newView: ViewState) => setView(newView);
  const openFullPlayer = () => setIsFullPlayerOpen(true);
  const openImageViewer = () => setIsImageViewerOpen(true);
  const closeFullPlayer = () => setIsFullPlayerOpen(false);
  const closeView = () => setView('main');
  const closeDetails = () => setIsDetailsOpen(false);

  // Focus search
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Load History & Theme
  useEffect(() => { setHistory(loadHistory()); }, []);
  useEffect(() => {
    const newTheme = isDarkMode ? generateDarkTheme(themeColor) : generateTheme(themeColor);
    setTheme(newTheme);
  }, [themeColor, isDarkMode]);

  // Audio Logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
        if (!isDragging) {
            setCurrentTime(audio.currentTime);
        }
    };
    const updateDuration = () => setDuration(audio.duration);
    
    const flushPlaySession = () => {
        const now = Date.now();
        if (lastPlayStartRef.current > 0 && currentSongIndex !== -1 && songs[currentSongIndex]) {
            const playedSeconds = (now - lastPlayStartRef.current) / 1000;
            if (playedSeconds > 1) {
                setHistory(prev => addLog(prev, songs[currentSongIndex], playedSeconds));
            }
        }
        lastPlayStartRef.current = 0;
    };

    const handlePlay = () => {
        lastPlayStartRef.current = Date.now();
        setIsPlaying(true);
        MediaSession.setPlaybackState({ playbackState: 'playing' });
        MediaSession.setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate,
            position: audio.currentTime
        });
    };

    const handlePause = () => {
        flushPlaySession();
        setIsPlaying(false);
        MediaSession.setPlaybackState({ playbackState: 'paused' });
         MediaSession.setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate,
            position: audio.currentTime
        });
    };

    const handleEnded = () => {
        flushPlaySession();
        handleNextAnimated(true); 
    };

    const handleBeforeUnload = () => {
         if (isPlaying) flushPlaySession();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (lastPlayStartRef.current > 0) flushPlaySession(); 
    };
  }, [currentSongIndex, mode, songs, isDragging]);

  useEffect(() => {
    if (currentSongIndex === -1 || !songs[currentSongIndex]) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && audio.paused) {
        audio.play().catch(e => {
            console.error("Play error", e);
            setIsPlaying(false);
        });
    } else if (!isPlaying && !audio.paused) {
        audio.pause();
    }
  }, [isPlaying, currentSongIndex]);

  // Reset transforms when player state changes (Opening/Closing)
  useEffect(() => {
      if (isFullPlayerOpen && fullPlayerRef.current) {
          fullPlayerRef.current.style.transform = `translateY(0px)`;
          currentTranslateY.current = 0;
      } else if (!isFullPlayerOpen && fullPlayerRef.current) {
          currentTranslateY.current = 0;
      }
      
      if (albumArtContainerRef.current) {
          albumArtContainerRef.current.style.transform = `translateX(0px)`;
          currentTranslateX.current = 0;
          
          if (currentCardRef.current) currentCardRef.current.style.transform = 'scale(1)';
          if (prevCardRef.current) prevCardRef.current.style.transform = 'scale(0.85)';
          if (nextCardRef.current) nextCardRef.current.style.transform = 'scale(0.85)';
      }
  }, [isFullPlayerOpen]);

  // Media Session
  useEffect(() => {
      if (currentSong) {
          MediaSession.setMetadata({
              title: currentSong.name,
              artist: currentSong.artist || translations[language].unknown,
              album: "Elysium",
              artwork: currentSong.coverUrl ? [
                  { src: currentSong.coverUrl, sizes: '512x512', type: 'image/png' },
              ] : []
          });
      }
      
      const setHandlers = async () => {
          await MediaSession.setActionHandler({ action: 'play' }, () => setIsPlaying(true));
          await MediaSession.setActionHandler({ action: 'pause' }, () => setIsPlaying(false));
          await MediaSession.setActionHandler({ action: 'previoustrack' }, handlePrevAnimated);
          await MediaSession.setActionHandler({ action: 'nexttrack' }, () => handleNextAnimated(false));
          await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
              if (details.seekTime && audioRef.current) {
                  audioRef.current.currentTime = details.seekTime;
                  setCurrentTime(details.seekTime);
                   MediaSession.setPositionState({
                        duration: audioRef.current.duration || 0,
                        playbackRate: audioRef.current.playbackRate,
                        position: details.seekTime
                    });
              }
          });
      };
      setHandlers();
      MediaSession.setPlaybackState({ 
          playbackState: isPlaying ? 'playing' : 'paused' 
      });

  }, [currentSongIndex, songs, mode, shuffledIndices, language]); 

  // Helpers
  const currentShufflePos = useMemo(() => {
    if (mode !== PlaybackMode.SHUFFLE) return -1;
    return shuffledIndices.indexOf(currentSongIndex);
  }, [mode, shuffledIndices, currentSongIndex]);

  const prevSongIndex = useMemo(() => {
      if (songs.length === 0) return -1;
      if (mode === PlaybackMode.SHUFFLE && currentShufflePos !== -1) {
           const idx = (currentShufflePos - 1 + shuffledIndices.length) % shuffledIndices.length;
           return shuffledIndices[idx];
      }
      return (currentSongIndex - 1 + songs.length) % songs.length;
  }, [currentSongIndex, songs.length, mode, shuffledIndices, currentShufflePos]);

  const nextSongIndex = useMemo(() => {
      if (songs.length === 0) return -1;
      if (mode === PlaybackMode.SHUFFLE && currentShufflePos !== -1) {
           const idx = (currentShufflePos + 1) % shuffledIndices.length;
           return shuffledIndices[idx];
      }
      return (currentSongIndex + 1) % songs.length;
  }, [currentSongIndex, songs.length, mode, shuffledIndices, currentShufflePos]);

  const prevSong = songs[prevSongIndex];
  const nextSong = songs[nextSongIndex];

  const changeIndex = useCallback((direction: 'next' | 'prev', auto = false) => {
      setCurrentSongIndex(prevIndex => {
        if (songs.length === 0) return -1;

        if (mode === PlaybackMode.REPEAT_ONE && auto) {
            if(audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
            return prevIndex;
        }

        if (mode === PlaybackMode.SHUFFLE) {
            const currentPos = shuffledIndices.indexOf(prevIndex);
            if (currentPos === -1) {
                 return Math.floor(Math.random() * songs.length);
            }
            let newPos;
            if (direction === 'next') {
                newPos = (currentPos + 1) % shuffledIndices.length;
            } else {
                newPos = (currentPos - 1 + shuffledIndices.length) % shuffledIndices.length;
            }
            return shuffledIndices[newPos];
        }

        let newIndex = prevIndex;
        if (direction === 'next') {
            newIndex = prevIndex + 1;
            if (newIndex >= songs.length) {
                if (mode === PlaybackMode.SEQUENCE && auto) {
                   setIsPlaying(false); 
                   return prevIndex; 
                }
                newIndex = 0; 
            }
        } else {
            newIndex = prevIndex - 1;
            if (newIndex < 0) newIndex = songs.length - 1;
        }
        return newIndex;
      });
  }, [mode, shuffledIndices, songs]); 

  // --- No-Flash Carousel Logic (Sync Reset) ---

  // Triggers AFTER React has updated the DOM with new song data
  useLayoutEffect(() => {
      if (layoutResetNeededRef.current && albumArtContainerRef.current) {
          // 1. Instantly disable transition to prevent animation during reset
          albumArtContainerRef.current.style.transition = 'none';
          if(prevCardRef.current) prevCardRef.current.style.transition = 'none';
          if(currentCardRef.current) currentCardRef.current.style.transition = 'none';
          if(nextCardRef.current) nextCardRef.current.style.transition = 'none';

          // 2. Reset Position to center (0px)
          // Since React has just updated the data, Slot 2 (Center) now holds the "New Current Song"
          // which is visually identical to the "Old Next/Prev Song" that was shifted into view.
          albumArtContainerRef.current.style.transform = 'translateX(0px)';
          
          // 3. Reset Scales to resting state
          if(currentCardRef.current) currentCardRef.current.style.transform = 'scale(1)';
          if(prevCardRef.current) prevCardRef.current.style.transform = 'scale(0.85)';
          if(nextCardRef.current) nextCardRef.current.style.transform = 'scale(0.85)';

          // 4. Force Browser Reflow to apply changes immediately
          void albumArtContainerRef.current.offsetHeight;

          // 5. Cleanup: Restore standard transition behavior for next interaction
          albumArtContainerRef.current.style.transition = '';
          if(prevCardRef.current) prevCardRef.current.style.transition = '';
          if(currentCardRef.current) currentCardRef.current.style.transition = '';
          if(nextCardRef.current) nextCardRef.current.style.transition = '';

          // 6. Reset Internal State
          currentTranslateX.current = 0;
          layoutResetNeededRef.current = false;
          pendingCarouselReset.current = null;
          setIsAnimating(false);
          isSwitchingRef.current = false;
      }
  }, [currentSongIndex]); // Dependency ensures this runs after render on index change

  const onCarouselTransitionEnd = useCallback((e: React.TransitionEvent) => {
      // Ensure we are catching the transform transition of the container
      if (e.target !== albumArtContainerRef.current || e.propertyName !== 'transform') return;
      
      if (pendingCarouselReset.current) {
          const direction = pendingCarouselReset.current;
          // Mark that we are about to switch data, prompting useLayoutEffect to handle the visual reset
          layoutResetNeededRef.current = true; 
          changeIndex(direction, false); 
      }
  }, [changeIndex]);

  const performSongChange = (direction: 'next' | 'prev', auto = false) => {
      if (isSwitchingRef.current) return;
      isSwitchingRef.current = true;
      const containerWidth = albumArtContainerRef.current ? (albumArtContainerRef.current.clientWidth / 3) : (window.innerWidth || 360);

      if (albumArtContainerRef.current) {
          setIsAnimating(true); // Enable CSS transition class
          pendingCarouselReset.current = direction; // Mark direction for transitionEnd handler
          
          // 1. Slide Track
          const targetX = direction === 'next' ? -containerWidth : containerWidth;
          albumArtContainerRef.current.style.transform = `translateX(${targetX}px)`;

          // 2. Animate Scales Final Step
          if (direction === 'next') {
              if(currentCardRef.current) currentCardRef.current.style.transform = 'scale(0.85)';
              if(nextCardRef.current) nextCardRef.current.style.transform = 'scale(1)';
          } else {
              if(currentCardRef.current) currentCardRef.current.style.transform = 'scale(0.85)';
              if(prevCardRef.current) prevCardRef.current.style.transform = 'scale(1)';
          }
      }
  };

  const handleNextAnimated = (auto = false) => performSongChange('next', auto);
  const handlePrevAnimated = () => {
    if (songs.length === 0) return;
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    performSongChange('prev');
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const rawFiles = (Array.from(files) as File[])
      .filter(f => f.type.startsWith('audio/'))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    if (rawFiles.length === 0) return;

    setIsLoading(true);

    const initialSongs: Song[] = rawFiles.map(file => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file: file,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(file),
        coverUrl: undefined 
    }));

    setSongs(initialSongs);
    setCurrentSongIndex(0);
    setIsPlaying(false);
    setIsLoading(false);

    saveSongsToDB(initialSongs).catch(e => {
        console.error("Failed to save to DB", e);
    });
    
    processMetadataQueue(initialSongs, 0);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const toggleMode = () => {
    const modes = Object.values(PlaybackMode);
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleSeekMove = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setDragTime(val);
      if (!isDragging) setIsDragging(true); 
  };

  const handleSeekEnd = (e: React.MouseEvent | React.TouchEvent) => {
      if (audioRef.current) {
          audioRef.current.currentTime = dragTime;
          setCurrentTime(dragTime);
          
          MediaSession.setPositionState({
                duration: audioRef.current.duration || 0,
                playbackRate: audioRef.current.playbackRate,
                position: dragTime
          });
      }
      setIsDragging(false);
  };

  const startLongPress = () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
          if(currentSong?.coverUrl) {
            openImageViewer();
          }
      }, 600); 
  };

  const cancelLongPress = () => {
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (isSwitchingRef.current) return;

      if (fullPlayerRef.current) {
          fullPlayerRef.current.style.transition = 'none';
      }

      touchStartRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
      
      setIsAnimating(false);
      startLongPress();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (isSwitchingRef.current) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = currentY - touchStartRef.current;
      const diffX = currentX - touchStartXRef.current;

      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
          cancelLongPress();
      }

      if (Math.abs(diffY) > Math.abs(diffX)) {
           if (diffY > 0) {
               currentTranslateY.current = diffY;
               if (fullPlayerRef.current) {
                   fullPlayerRef.current.style.transform = `translateY(${diffY}px)`;
               }
               if (albumArtContainerRef.current && currentTranslateX.current !== 0) {
                   currentTranslateX.current = 0;
                   albumArtContainerRef.current.style.transform = `translateX(0px)`;
                   if (currentCardRef.current) currentCardRef.current.style.transform = 'scale(1)';
                   if (prevCardRef.current) prevCardRef.current.style.transform = 'scale(0.85)';
                   if (nextCardRef.current) nextCardRef.current.style.transform = 'scale(0.85)';
               }
           }
      } else {
           const dampedX = diffX * 0.6;
           const containerWidth = albumArtContainerRef.current ? (albumArtContainerRef.current.clientWidth / 3) : (window.innerWidth || 360);
           
           currentTranslateX.current = dampedX;
           
           if (albumArtContainerRef.current) {
               albumArtContainerRef.current.style.transition = 'none'; 
               albumArtContainerRef.current.style.transform = `translateX(${dampedX}px)`;
           }

           const ratio = Math.min(Math.abs(dampedX) / containerWidth, 1);
           const centerScale = 1 - (0.15 * ratio);
           
           if (currentCardRef.current) {
               currentCardRef.current.style.transition = 'none';
               currentCardRef.current.style.transform = `scale(${centerScale})`;
           }

           if (dampedX < 0) {
               const nextScale = 0.85 + (0.15 * ratio);
               if (nextCardRef.current) {
                   nextCardRef.current.style.transition = 'none';
                   nextCardRef.current.style.transform = `scale(${nextScale})`;
               }
               if (prevCardRef.current) {
                   prevCardRef.current.style.transition = 'none';
                   prevCardRef.current.style.transform = 'scale(0.85)';
               }
           } else {
               const prevScale = 0.85 + (0.15 * ratio);
               if (prevCardRef.current) {
                   prevCardRef.current.style.transition = 'none';
                   prevCardRef.current.style.transform = `scale(${prevScale})`;
               }
               if (nextCardRef.current) {
                   nextCardRef.current.style.transition = 'none';
                   nextCardRef.current.style.transform = 'scale(0.85)';
               }
           }

           if (fullPlayerRef.current && currentTranslateY.current !== 0) {
               currentTranslateY.current = 0;
               fullPlayerRef.current.style.transform = `translateY(0px)`;
           }
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      cancelLongPress();
      if (isSwitchingRef.current) return;

      if (fullPlayerRef.current) fullPlayerRef.current.style.transition = '';
      if (albumArtContainerRef.current) albumArtContainerRef.current.style.transition = '';
      if (currentCardRef.current) currentCardRef.current.style.transition = '';
      if (prevCardRef.current) prevCardRef.current.style.transition = '';
      if (nextCardRef.current) nextCardRef.current.style.transition = '';

      const currentY = e.changedTouches[0].clientY;
      const currentX = e.changedTouches[0].clientX;
      const diffY = currentY - touchStartRef.current;
      const diffX = currentX - touchStartXRef.current;
      
      const verticalThreshold = 150; 
      const containerWidth = albumArtContainerRef.current ? (albumArtContainerRef.current.clientWidth / 3) : (window.innerWidth || 360);
      const horizontalThreshold = containerWidth * 0.35; 

      if (Math.abs(diffY) > Math.abs(diffX) && diffY > 0) {
           if (diffY > verticalThreshold) {
               setIsAnimating(true);
               closeFullPlayer();
               currentTranslateY.current = 0;
           } else {
               setIsAnimating(true);
               if (fullPlayerRef.current) fullPlayerRef.current.style.transform = `translateY(0px)`;
               currentTranslateY.current = 0;
               setTimeout(() => setIsAnimating(false), 300);
           }
      } else {
          // Horizontal Swipe Logic
          if (Math.abs(diffX) > horizontalThreshold) {
              const direction = diffX > 0 ? 'prev' : 'next';
              const targetX = direction === 'next' ? -containerWidth : containerWidth;
              
              isSwitchingRef.current = true;
              setIsAnimating(true);
              
              // Set pending reset for TransitionEnd logic
              pendingCarouselReset.current = direction;

              // Animate to target, this will trigger onTransitionEnd
              if (albumArtContainerRef.current) {
                  albumArtContainerRef.current.style.transform = `translateX(${targetX}px)`;
              }
              
              if (direction === 'next') {
                  if(currentCardRef.current) currentCardRef.current.style.transform = 'scale(0.85)';
                  if(nextCardRef.current) nextCardRef.current.style.transform = 'scale(1)';
              } else {
                  if(currentCardRef.current) currentCardRef.current.style.transform = 'scale(0.85)';
                  if(prevCardRef.current) prevCardRef.current.style.transform = 'scale(1)';
              }
          } else {
              // Snap Back
              setIsAnimating(true);
              if (albumArtContainerRef.current) {
                   albumArtContainerRef.current.style.transform = `translateX(0px)`;
              }
              if(currentCardRef.current) currentCardRef.current.style.transform = 'scale(1)';
              if(prevCardRef.current) prevCardRef.current.style.transform = 'scale(0.85)';
              if(nextCardRef.current) nextCardRef.current.style.transform = 'scale(0.85)';

              currentTranslateX.current = 0;
              setTimeout(() => setIsAnimating(false), 300);
          }
      }
  };

  const filteredSongs = useMemo(() => {
    if (!searchQuery) return songs;
    const lower = searchQuery.toLowerCase();
    return songs.filter(s => 
        s.name.toLowerCase().includes(lower) || 
        (s.artist && s.artist.toLowerCase().includes(lower))
    );
  }, [songs, searchQuery]);

  const handlePlayFiltered = useCallback((song: Song) => {
      const idx = songs.findIndex(s => s.id === song.id);
      if (idx !== -1) {
          setCurrentSongIndex(idx);
          setIsPlaying(true);
      }
  }, [songs]); 

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleShare = async () => {
      setIsMoreMenuOpen(false);
      if (!currentSong) return;
      try {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [currentSong.file] })) {
             await navigator.share({
                files: [currentSong.file],
                title: currentSong.name,
                text: `${currentSong.name} by ${currentSong.artist || 'Unknown'}`
             });
        } else {
            alert('Sharing not supported on this device/browser for local files.');
        }
      } catch (error) {
          console.error('Error sharing:', error);
      }
  };

  const appStyle = useMemo(() => ({
    backgroundColor: theme.background,
    color: theme.onSurface,
  } as React.CSSProperties), [theme.background, theme.onSurface]);

  const primaryContainerStyle = useMemo(() => ({ 
      backgroundColor: theme.primaryContainer, 
      color: theme.onPrimaryContainer 
  } as React.CSSProperties), [theme.primaryContainer, theme.onPrimaryContainer]);

  const miniPlayerStyle = useMemo(() => ({ 
        backgroundColor: appSettings.enableBlur 
            ? hexToRgba(theme.surfaceVariant, 0.85) 
            : theme.surfaceVariant,
        backdropFilter: appSettings.enableBlur ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: appSettings.enableBlur ? 'blur(20px)' : 'none',
        display: (songs.length === 0 && !isLoading) ? 'none' : 'block' 
  }), [appSettings.enableBlur, theme.surfaceVariant, songs.length, isLoading]);

  return (
    <div className="h-screen w-full overflow-hidden select-none relative" style={appStyle}>
      <audio ref={audioRef} src={currentSong?.url} />

      <div className="absolute inset-0 w-full h-full overflow-hidden">
          {/* Main View */}
          <div 
            className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out ${view === 'main' ? 'translate-x-0' : view === 'settings' || view === 'stats' || view === 'info' ? '-translate-x-1/3 opacity-50' : ''}`}
          >
              <div className="h-16 flex items-center justify-between px-4 z-10 shrink-0" style={{ backgroundColor: theme.surface }}>
                {isSearchOpen ? (
                   <div className="flex-1 flex items-center gap-2">
                       <SearchIcon className="w-5 h-5 opacity-50" />
                       <input 
                          ref={searchInputRef}
                          type="text" 
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder={t.search}
                          className="flex-1 bg-transparent border-none outline-none text-lg font-medium"
                          style={{color: theme.onSurface}}
                       />
                       <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="p-2 flex items-center justify-center rounded-full hover:bg-black/5" style={{color: theme.onSurface}}>
                           <CloseIcon />
                       </button>
                   </div>
                ) : (
                    <>
                        <h1 className="text-xl font-medium tracking-tight truncate" style={{color: theme.onSurface}}>
                            {t.title}
                        </h1>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition"
                                style={{ color: theme.onSurfaceVariant }}
                            >
                                <SearchIcon />
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 rounded-full hover:brightness-110 active:scale-95 transition"
                                style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
                            >
                                <FolderOpenIcon />
                            </button>
                            <button 
                                onClick={() => navigateTo('settings')}
                                className="p-2 rounded-full hover:brightness-110 active:scale-95 transition"
                                style={{ color: theme.onSurfaceVariant }}
                            >
                                <SettingsIcon />
                            </button>
                        </div>
                    </>
                )}
              </div>

              <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row">
                {isLoading && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-50 bg-black/5 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current mb-4" style={{color: theme.primary}}></div>
                        <p className="font-medium">{t.loading}</p>
                     </div>
                )}
                {songs.length === 0 && !isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center opacity-70">
                        <div className="mb-4 p-6 rounded-3xl" style={primaryContainerStyle}>
                            <MusicNoteIcon className="w-16 h-16"/>
                        </div>
                        <p className="text-lg font-medium">{t.noMusic}</p>
                        <p className="text-sm mt-2 opacity-80">{t.hint}</p>
                    </div>
                )}
                <div className={`flex-1 overflow-y-auto ${songs.length === 0 ? 'hidden' : ''} pb-32 md:pb-0`}>
                    <div className="p-4 space-y-1">
                         <div className="flex justify-between items-center mb-2 px-2 opacity-70 text-sm font-medium">
                            <span>{filteredSongs.length} {t.songs}</span>
                         </div>
                         {filteredSongs.map((song) => {
                            const isActive = song.id === currentSong?.id;
                            return (
                                <SongListItem
                                    key={song.id}
                                    song={song}
                                    isActive={isActive}
                                    isPlaying={isPlaying}
                                    theme={theme}
                                    onClick={() => handlePlayFiltered(song)}
                                />
                            );
                         })}
                    </div>
                </div>
              </div>
          </div>

          {/* Settings View with Swipe Back */}
          <SlideOverPanel isOpen={view === 'settings'} onClose={closeView} title={t.settings} theme={theme} zIndex={40}>
             <div className="p-4 space-y-6 pb-32">
                <section>
                    <h2 className="text-sm font-medium mb-2 px-2" style={{color: theme.primary}}>{t.stats}</h2>
                    <div className="rounded-3xl overflow-hidden" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                        <div className="p-4 flex justify-between items-center active:bg-black/5 transition cursor-pointer" onClick={() => navigateTo('stats')}>
                                <div className="flex items-center gap-3"><StatsIcon /><span className="text-base">{t.detailedStats}</span></div>
                                <div className="opacity-50"><SkipNextIcon className="w-5 h-5"/></div>
                        </div>
                    </div>
                </section>
                <section>
                    <h2 className="text-sm font-medium mb-2 px-2" style={{color: theme.primary}}>{t.general}</h2>
                    <div className="rounded-3xl overflow-hidden flex flex-col" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                        <div className="p-4 flex justify-between items-center active:bg-black/5 transition cursor-pointer" onClick={toggleLanguage}>
                                <div className="flex items-center gap-3"><TranslateIcon /><span className="text-base">{t.language}</span></div>
                                <span className="text-sm font-medium opacity-70 bg-black/10 px-2 py-1 rounded-md">{language === 'en' ? 'English' : '中文'}</span>
                        </div>
                        <div className="h-px w-full opacity-10" style={{backgroundColor: theme.onSurfaceVariant}}></div>
                        <div className="p-4 flex justify-between items-center cursor-pointer active:bg-black/5 transition" onClick={() => setAppSettings(prev => ({ ...prev, pauseOnDisconnect: !prev.pauseOnDisconnect }))}>
                                <div className="flex flex-col gap-1"><span className="text-base font-medium">{t.pauseOnDisconnect}</span><span className="text-xs opacity-70">{t.pauseOnDisconnectHint}</span></div>
                                <div className={`w-12 h-7 shrink-0 rounded-full relative transition-colors duration-200 border border-transparent`} style={{backgroundColor: appSettings.pauseOnDisconnect ? theme.primary : theme.outline}}>
                                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${appSettings.pauseOnDisconnect ? 'left-6' : 'left-1'}`} />
                                </div>
                        </div>
                    </div>
                </section>
                <section>
                    <h2 className="text-sm font-medium mb-2 px-2" style={{color: theme.primary}}>{t.appearance}</h2>
                    <div className="rounded-3xl overflow-hidden flex flex-col" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                        <div className="p-4 flex justify-between items-center cursor-pointer active:bg-black/5 transition" onClick={() => setIsDarkMode(!isDarkMode)}>
                                <div className="flex items-center gap-3">{isDarkMode ? <DarkModeIcon/> : <LightModeIcon/>}<span className="text-base">{t.darkMode}</span></div>
                                <div className={`w-12 h-7 rounded-full relative transition-colors duration-200 border border-transparent`} style={{backgroundColor: isDarkMode ? theme.primary : theme.outline}}><div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${isDarkMode ? 'left-6' : 'left-1'}`} /></div>
                        </div>
                        <div className="h-px w-full opacity-10" style={{backgroundColor: theme.onSurfaceVariant}}></div>
                        <div className="p-4 flex justify-between items-center cursor-pointer active:bg-black/5 transition" onClick={() => setAppSettings(prev => ({ ...prev, enableBlur: !prev.enableBlur }))}>
                                <div className="flex flex-col gap-1"><span className="text-base font-medium">{t.enableBlur}</span><span className="text-xs opacity-70">{t.enableBlurHint}</span></div>
                                <div className={`w-12 h-7 shrink-0 rounded-full relative transition-colors duration-200 border border-transparent ml-4`} style={{backgroundColor: appSettings.enableBlur ? theme.primary : theme.outline}}>
                                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${appSettings.enableBlur ? 'left-6' : 'left-1'}`} />
                                </div>
                        </div>
                        <div className="h-px w-full opacity-10" style={{backgroundColor: theme.onSurfaceVariant}}></div>
                        <div className="p-4">
                                <div className="flex items-center gap-3 mb-4"><PaletteIcon /><span className="text-base">{t.themeColor}</span></div>
                                <div className="flex flex-wrap gap-4 justify-start">
                                    {[DEFAULT_THEME_COLOR, '#9C27B0', '#E91E63', '#FF80AB', '#F44336', '#00BCD4', '#FF9800', '#4CAF50', '#8BC34A', '#009688', '#2196F3', '#3F51B5', '#607D8B'].map(c => (
                                        <button key={c} className="w-10 h-10 rounded-full border-2 transition-all active:scale-90 flex items-center justify-center" style={{ backgroundColor: c, borderColor: themeColor === c ? theme.onSurface : 'transparent' }} onClick={() => setThemeColor(c)}>{themeColor === c && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}</button>
                                    ))}
                                </div>
                        </div>
                    </div>
                </section>
                <section>
                    <h2 className="text-sm font-medium mb-2 px-2" style={{color: theme.primary}}>{t.info}</h2>
                    <div className="rounded-3xl overflow-hidden" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                        <div className="p-4 flex justify-between items-center active:bg-black/5 transition cursor-pointer" onClick={() => navigateTo('info')}>
                                <div className="flex items-center gap-3"><InfoIcon /><span className="text-base">{t.aboutApp}</span></div>
                                <div className="opacity-50"><SkipNextIcon className="w-5 h-5"/></div>
                        </div>
                    </div>
                </section>
             </div>
          </SlideOverPanel>

          {/* Info View with Swipe Back */}
          <SlideOverPanel isOpen={view === 'info'} onClose={closeView} title={t.info} theme={theme} zIndex={42}>
              <div className="p-4 pb-32">
                   {/* Info Content */}
                   <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-24 h-24 rounded-3xl mb-4 flex items-center justify-center shadow-lg" style={{backgroundColor: theme.primaryContainer}}>
                           <MusicNoteIcon className="w-12 h-12" />
                      </div>
                      <h2 className="text-2xl font-bold mb-1">Elysium</h2>
                      <p className="opacity-60 text-sm">v0.1.0</p>
                  </div>
                  <div className="space-y-4">
                      <div className="rounded-3xl overflow-hidden p-5 space-y-4" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                          <div className="flex flex-col gap-1"><span className="text-xs font-bold uppercase opacity-50 tracking-wider" style={{color: theme.primary}}>{t.developer}</span><span className="text-lg font-medium">midway2333</span></div>
                          <div className="flex flex-col gap-1"><span className="text-xs font-bold uppercase opacity-50 tracking-wider" style={{color: theme.primary}}>{t.basedOn}</span><span className="text-lg font-medium">Gemini 3 vibe coding</span></div>
                      </div>
                      <div className="rounded-3xl overflow-hidden p-1 space-y-1" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                           <div className="px-4 py-2 mt-2"><span className="text-xs font-bold uppercase opacity-50 tracking-wider" style={{color: theme.primary}}>{t.links}</span></div>
                           <a href="https://space.bilibili.com/400980240" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-black/5 rounded-2xl transition"><span className="font-medium">Bilibili</span><SkipNextIcon className="opacity-50 w-5 h-5"/></a>
                           <a href="https://github.com/midway2333/Elysium" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-black/5 rounded-2xl transition"><span className="font-medium">GitHub</span><SkipNextIcon className="opacity-50 w-5 h-5"/></a>
                      </div>
                  </div>
              </div>
          </SlideOverPanel>

          {/* Stats View with Swipe Back */}
          <SlideOverPanel isOpen={view === 'stats'} onClose={closeView} title={t.stats} theme={theme} zIndex={42}>
              <div className="p-4 pb-32">
                 {(() => {
                      const stats = calculateStats(filterLogsByRange(history, statRange));
                      const ranges: {id: TimeRange, label: string}[] = [
                          {id: 'day', label: t.statDay}, {id: 'week', label: t.statWeek}, {id: 'month', label: t.statMonth},
                          {id: 'quarter', label: t.statQuarter}, {id: 'year', label: t.statYear}, {id: 'all', label: t.statAll},
                      ];
                      return (
                          <>
                            <div className="flex overflow-x-auto gap-2 pb-4 mb-2 no-scrollbar">
                                {ranges.map(r => (
                                    <button key={r.id} onClick={() => setStatRange(r.id)} className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap`} style={{backgroundColor: statRange === r.id ? theme.primary : theme.surfaceVariant, color: statRange === r.id ? theme.onPrimary : theme.onSurfaceVariant}}>{r.label}</button>
                                ))}
                            </div>
                            {/* ... stats display ... */}
                            {stats.totalTime > 0 ? (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-2" style={{backgroundColor: theme.primaryContainer, color: theme.onPrimaryContainer}}>
                                            <span className="text-sm font-medium opacity-70 uppercase tracking-wider">{t.listeningTime}</span>
                                            <span className="text-4xl font-bold">{formatDuration(stats.totalTime)}</span>
                                        </div>
                                        {stats.topSong && (
                                            <div className="p-4 rounded-3xl" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                                                <div className="flex items-center gap-3 mb-3 opacity-70"><MusicNoteIcon /><span className="text-sm font-bold uppercase">{t.topSong}</span></div>
                                                <div className="flex justify-between items-center">
                                                    <div className="min-w-0"><div className="text-lg font-bold truncate">{stats.topSong.name}</div><div className="text-sm opacity-80 truncate">{stats.topSong.artist}</div></div>
                                                    <div className="text-right shrink-0 ml-4"><div className="font-mono font-medium">{formatDuration(stats.topSong.time, true)}</div><div className="text-xs opacity-60">{stats.topSong.count} plays</div></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase mb-2 opacity-70 px-2" style={{color: theme.primary}}>{t.songsList}</h3>
                                        <div className="rounded-3xl overflow-hidden" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                                            {stats.songRanking.slice(0, 50).map((s, idx) => (
                                                <div key={idx} className="p-3 flex items-center border-b border-black/5 last:border-0">
                                                    <div className="w-8 text-center font-bold opacity-50">{idx + 1}</div>
                                                    <div className="flex-1 min-w-0 mx-2">
                                                        <div className="truncate font-medium">{s.name}</div>
                                                        <div className="truncate text-xs opacity-70">{s.artist}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-mono text-sm">{formatDuration(s.time, true)}</div>
                                                        <div className="text-xs opacity-50">{s.count}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase mb-2 opacity-70 px-2" style={{color: theme.primary}}>{t.artistsList}</h3>
                                        <div className="rounded-3xl overflow-hidden" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                                            {stats.artistRanking.slice(0, 50).map((a, idx) => (
                                                <div key={idx} className="p-3 flex items-center border-b border-black/5 last:border-0">
                                                    <div className="w-8 text-center font-bold opacity-50">{idx + 1}</div>
                                                    <div className="flex-1 min-w-0 mx-2">
                                                        <div className="truncate font-medium">{a.name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-mono text-sm">{formatDuration(a.time, true)}</div>
                                                        <div className="text-xs opacity-50">{a.count}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-center opacity-50"><InfoIcon className="w-12 h-12 mb-2"/><p>{t.noStats}</p></div>
                            )}
                          </>
                      )
                 })()}
              </div>
          </SlideOverPanel>
      </div>

      {/* --- Mini Player (Bottom Bar) --- */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden ${isFullPlayerOpen ? 'translate-y-full' : 'translate-y-0'}`}
        style={miniPlayerStyle}
        onClick={openFullPlayer}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-4 relative z-10">
             <div className="flex items-center gap-3 flex-1 min-w-0">
                 <div className="w-10 h-10 rounded-lg bg-cover bg-center shrink-0 border border-black/5 shadow-sm" 
                      style={{ 
                          backgroundColor: theme.primary,
                          backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : 'none'
                      }}>
                     {!currentSong?.coverUrl && <MusicNoteIcon className="w-5 h-5 m-auto text-white opacity-70"/>}
                 </div>
                 <div className="min-w-0">
                     <p className="font-medium truncate text-base" style={{color: theme.onSurfaceVariant}}>{currentSong?.name || t.choose}</p>
                     <p className="text-xs opacity-70 truncate" style={{color: theme.onSurfaceVariant}}>{currentSong?.artist || t.unknown}</p>
                 </div>
             </div>
             
             {/* Mini Controls */}
             <div className="flex items-center gap-3">
                 <button onClick={togglePlay} className="p-2 rounded-full" style={{backgroundColor: theme.primary, color: theme.onPrimary}}>
                     {isPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
                 </button>
             </div>
        </div>
        {/* Mini Progress */}
        <div className="h-1 w-full bg-black/5 relative z-10">
             <div className="h-full transition-all duration-500 linear" style={{width: `${(currentTime / (duration || 1)) * 100}%`, backgroundColor: theme.primary}} />
        </div>
      </div>

      {/* --- Full Screen Player Overlay --- */}
      <div 
         ref={fullPlayerRef}
         className={`absolute inset-0 z-30 flex flex-col cubic-bezier(0.2, 0.0, 0, 1.0) overflow-hidden ${!isAnimating ? 'transition-transform duration-500' : 'transition-transform duration-300'}`}
         style={{ 
            backgroundColor: theme.surfaceVariant, 
            height: '100dvh',
            transform: isFullPlayerOpen ? `translateY(0px)` : 'translateY(100%)',
            willChange: 'transform' // GPU Hint
         }}
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
      >
          {/* Blurred Background Layer for Full Player */}
          {appSettings.enableBlur && currentSong?.coverUrl && (
             <div className="absolute inset-0 bg-cover bg-center opacity-70 blur-3xl z-0 pointer-events-none scale-110" 
                  style={{ backgroundImage: `url(${currentSong.coverUrl})` }} 
             />
          )}
          {/* Contrast Overlay */}
          {appSettings.enableBlur && currentSong?.coverUrl && (
             <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }} />
          )}

          {/* Header */}
          <div className="pt-8 pb-4 px-6 flex items-center justify-between shrink-0 relative z-10">
               <button onClick={closeFullPlayer} className="p-2 rounded-full active:bg-black/10 transition" style={{color: theme.onSurfaceVariant}}>
                   <ChevronDownIcon />
               </button>
               <span className="text-xs font-bold tracking-widest uppercase opacity-50" style={{color: theme.onSurfaceVariant}}>Now Playing</span>
               <button onClick={() => { closeFullPlayer(); setTimeout(() => navigateTo('settings'), 300); }} className="p-2 rounded-full active:bg-black/10 transition" style={{color: theme.onSurfaceVariant}}>
                   <SettingsIcon />
               </button>
          </div>

          {/* Main Body (Flexibly Shrinkable) */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 relative z-10 min-h-0 overflow-hidden">
               {/* Album Art Slider */}
               <div className="w-full aspect-square max-h-[40vh] max-w-sm relative z-20" 
                    style={{ }}> 
                    {/* The sliding track. Width is 300% to hold 3 items. marginLeft -100% to center the middle item. */}
                    <div 
                         ref={albumArtContainerRef}
                         className={`flex h-full w-[300%] -ml-[100%] flex-row ${isAnimating ? 'transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]' : ''}`}
                         style={{ 
                            touchAction: 'none', 
                            willChange: 'transform',
                            transform: 'translateX(0px)' 
                         }}
                         onTransitionEnd={onCarouselTransitionEnd}
                         onContextMenu={(e) => e.preventDefault()}
                    >
                        {/* Prev Song */}
                         <div className="flex-1 h-full flex items-center justify-center p-4 transition-all duration-300"
                              ref={prevCardRef}
                              style={{ 
                                  transform: 'scale(0.85)',
                              }}>
                              <div className="w-full aspect-square rounded-[2rem] shadow-2xl border border-black/5 relative overflow-hidden bg-black/5" 
                                   style={{ backgroundColor: theme.surface }}>
                                   {prevSong?.coverUrl ? (
                                       <img src={prevSong.coverUrl} className="w-full h-full object-cover pointer-events-none select-none block" draggable={false} alt="" />
                                   ) : (
                                       <div className="absolute inset-0 flex items-center justify-center"><MusicNoteIcon className="w-32 h-32 opacity-10"/></div>
                                   )}
                              </div>
                         </div>

                        {/* Current Song */}
                         <div className="flex-1 h-full flex items-center justify-center p-0 relative z-10 transition-all duration-300"
                              ref={currentCardRef}
                              style={{ 
                                  transform: 'scale(1)',
                              }}>
                              <div className="w-full aspect-square rounded-[2rem] shadow-2xl border border-black/5 relative overflow-hidden bg-black/5" 
                                   style={{ backgroundColor: theme.surface }}>
                                   {currentSong?.coverUrl ? (
                                       <img src={currentSong.coverUrl} className="w-full h-full object-cover pointer-events-none select-none block" draggable={false} alt="" />
                                   ) : (
                                       <div className="absolute inset-0 flex items-center justify-center"><MusicNoteIcon className="w-32 h-32 opacity-10"/></div>
                                   )}
                              </div>
                         </div>

                        {/* Next Song */}
                         <div className="flex-1 h-full flex items-center justify-center p-4 transition-all duration-300"
                              ref={nextCardRef}
                              style={{ 
                                  transform: 'scale(0.85)',
                              }}>
                              <div className="w-full aspect-square rounded-[2rem] shadow-2xl border border-black/5 relative overflow-hidden bg-black/5" 
                                   style={{ backgroundColor: theme.surface }}>
                                   {nextSong?.coverUrl ? (
                                       <img src={nextSong.coverUrl} className="w-full h-full object-cover pointer-events-none select-none block" draggable={false} alt="" />
                                   ) : (
                                       <div className="absolute inset-0 flex items-center justify-center"><MusicNoteIcon className="w-32 h-32 opacity-10"/></div>
                                   )}
                              </div>
                         </div>
                    </div>
               </div>

               {/* Song Info */}
               <div className="w-full text-center max-w-sm shrink-0">
                   <h2 className="text-2xl font-bold truncate mb-1" style={{color: theme.onSurfaceVariant}}>{currentSong?.name || "No Song"}</h2>
                   <p className="text-lg opacity-60 truncate" style={{color: theme.onSurfaceVariant}}>{currentSong?.artist || "Unknown Artist"}</p>
               </div>
          </div>

          {/* Bottom Controls Area */}
          <div className="p-8 pb-12 flex flex-col gap-6 relative z-10 rounded-t-3xl backdrop-blur-md shrink-0" 
            style={{backgroundColor: appSettings.enableBlur ? (isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)') : theme.surface}}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
               {/* Progress Bar */}
               <div className="flex flex-col gap-2">
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={isDragging ? dragTime : currentTime}
                        onInput={handleSeekMove}
                        onMouseDown={handleSeekStart}
                        onTouchStart={handleSeekStart}
                        onMouseUp={handleSeekEnd}
                        onTouchEnd={handleSeekEnd}
                        className="w-full h-10 cursor-pointer touch-none"
                        style={{
                            color: theme.primary,
                            background: `linear-gradient(to right, ${theme.primary} ${((isDragging ? dragTime : currentTime) / (duration || 1)) * 100}%, ${theme.outline}30 ${((isDragging ? dragTime : currentTime) / (duration || 1)) * 100}%)`,
                            height: '4px',
                            borderRadius: '2px',
                        }}
                    />
                    <div className="flex justify-between text-xs font-medium font-mono opacity-50" style={{color: theme.onSurface}}>
                        <span>{formatTime(isDragging ? dragTime : currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
               </div>

               {/* Main Controls */}
               <div className="flex items-center justify-between">
                    <button onClick={toggleMode} className="p-3 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}>
                        {mode === PlaybackMode.SHUFFLE && <ShuffleIcon active />}
                        {mode === PlaybackMode.REPEAT_ALL && <RepeatIcon active />}
                        {mode === PlaybackMode.REPEAT_ONE && <RepeatOneIcon active />}
                        {mode === PlaybackMode.SEQUENCE && <RepeatIcon />}
                    </button>

                    <div className="flex items-center gap-6">
                        <button onClick={handlePrevAnimated} className="p-4 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}>
                            <SkipPrevIcon className="w-8 h-8"/>
                        </button>
                        <button onClick={togglePlay} className="p-6 rounded-[24px] shadow-lg active:scale-95 transition hover:shadow-xl hover:brightness-110" style={{backgroundColor: theme.primary, color: theme.onPrimary}}>
                             {isPlaying ? <PauseIcon className="w-10 h-10"/> : <PlayIcon className="w-10 h-10"/>}
                        </button>
                        <button onClick={() => handleNextAnimated(false)} className="p-4 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}>
                            <SkipNextIcon className="w-8 h-8"/>
                        </button>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMoreMenuOpen(!isMoreMenuOpen); }} 
                            className="p-3 rounded-full hover:bg-black/5 active:scale-95 transition" 
                            style={{color: theme.onSurface}}
                        >
                            <MoreVertIcon />
                        </button>
                        {isMoreMenuOpen && (
                            <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)}></div>
                            <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-xl shadow-xl z-50 overflow-hidden flex flex-col py-1" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurface}}>
                                <button onClick={() => { setIsMoreMenuOpen(false); setIsDetailsOpen(true); }} className="px-4 py-3 text-left text-sm font-medium hover:brightness-95 active:brightness-90 flex items-center gap-3 transition" style={{backgroundColor: 'transparent'}}>
                                    <FileTextIcon className="w-5 h-5 opacity-70"/>
                                    {t.details}
                                </button>
                                <button onClick={handleShare} className="px-4 py-3 text-left text-sm font-medium hover:brightness-95 active:brightness-90 flex items-center gap-3 transition" style={{backgroundColor: 'transparent'}}>
                                    <ShareIcon className="w-5 h-5 opacity-70"/>
                                    {t.share}
                                </button>
                            </div>
                            </>
                        )}
                    </div>
               </div>
          </div>

           {/* Details Modal */}
           {isDetailsOpen && currentSong && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={() => setIsDetailsOpen(false)}>
                    <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl relative" style={{backgroundColor: theme.surface, color: theme.onSurface}} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                             <h3 className="text-lg font-bold">{t.fileInfo}</h3>
                             <button onClick={closeDetails} className="p-2 -mr-2 rounded-full hover:bg-black/5 flex items-center justify-center"><CloseIcon /></button>
                        </div>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b border-black/5">
                                <span className="opacity-60">{t.fileName}</span>
                                <span className="font-medium text-right truncate max-w-[12rem]">{currentSong.file.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-black/5">
                                <span className="opacity-60">{t.fileSize}</span>
                                <span className="font-mono">{formatFileSize(currentSong.file.size)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-black/5">
                                <span className="opacity-60">{t.fileType}</span>
                                <span className="font-mono">{currentSong.file.type || 'N/A'}</span>
                            </div>
                             <div className="flex justify-between py-2 border-b border-black/5">
                                <span className="opacity-60">{t.lastModified}</span>
                                <span className="font-medium">{new Date(currentSong.file.lastModified).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
           )}

           {/* Image Viewer Modal */}
           {isImageViewerOpen && currentSong?.coverUrl && (
                <div 
                    className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setIsImageViewerOpen(false)}
                >
                    <img 
                        src={currentSong.coverUrl} 
                        alt="Full Album Art"
                        className="max-w-full max-h-full object-contain p-4 shadow-2xl scale-in-95 animate-in duration-300"
                    />
                    <button className="absolute top-4 right-4 p-3 rounded-full bg-black/50 text-white" onClick={() => setIsImageViewerOpen(false)}>
                        <CloseIcon />
                    </button>
                </div>
           )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFolderSelect}
        className="hidden"
        multiple
        accept="audio/*"
        // @ts-ignore
        {...(!isMobile ? { webkitdirectory: "", directory: "" } : {})}
      />
    </div>
  );
};

export default App;