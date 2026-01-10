import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Song, PlaybackMode, ThemeColors, DEFAULT_THEME_COLOR, PlaybackLog, AppSettings } from './types';
import { generateTheme, generateDarkTheme } from './utils/theme';
import { formatTime } from './utils/format';
import { loadHistory, addLog, filterLogsByRange, calculateStats, formatDuration, TimeRange, StatsResult } from './utils/stats';
import { getMetadata } from './utils/metadata';
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
    hint: "Tap the folder icon to select a folder containing music files.",
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
    links: "Links"
  },
  zh: {
    title: "Elysium",
    noMusic: "未选择音乐",
    hint: "点击文件夹图标选择包含音乐文件的文件夹",
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
    links: "链接"
  }
};

type ViewState = 'main' | 'settings' | 'stats' | 'info';

const App: React.FC = () => {
  // --- State ---
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<PlaybackMode>(PlaybackMode.SEQUENCE);
  
  // UI State
  const [view, setView] = useState<ViewState>('main');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  // Swipe Logic State
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef(0);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings & History State
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [history, setHistory] = useState<PlaybackLog[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
      pauseOnDisconnect: true,
      enableBlur: true
  });
  
  // Stats View State
  const [statRange, setStatRange] = useState<TimeRange>('day');
  
  // Theme State
  const [themeColor, setThemeColor] = useState<string>(DEFAULT_THEME_COLOR);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [theme, setTheme] = useState<ThemeColors>(generateDarkTheme(DEFAULT_THEME_COLOR));

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPlayStartRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Load History
  useEffect(() => {
      setHistory(loadHistory());
  }, []);

  // Update theme
  useEffect(() => {
    const newTheme = isDarkMode ? generateDarkTheme(themeColor) : generateTheme(themeColor);
    setTheme(newTheme);
  }, [themeColor, isDarkMode]);

  // Audio Events & Tracking logic
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
    };

    const handlePause = () => {
        flushPlaySession();
        setIsPlaying(false);
    };

    const handleEnded = () => {
        flushPlaySession();
        handleNext(true); 
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

  // Sync isPlaying state to audio element
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

  // Device Disconnect
  useEffect(() => {
      if (!appSettings.pauseOnDisconnect) return;
      // @ts-ignore
      const handleDeviceChange = () => { if (isPlaying) setIsPlaying(false); };
      // @ts-ignore
      if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
           // @ts-ignore
           navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
           return () => {
               // @ts-ignore
               navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
           }
      }
  }, [appSettings.pauseOnDisconnect, isPlaying]);


  // --- Handlers ---

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // 1. Basic Load
    const rawFiles = (Array.from(files) as File[])
      .filter(f => f.type.startsWith('audio/'))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    if (rawFiles.length === 0) return;

    // Temporary array with basic info
    const initialSongs: Song[] = rawFiles.map(file => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file: file,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(file),
    }));

    setSongs(initialSongs);
    setCurrentSongIndex(0);
    // Don't auto-play on load
    setIsPlaying(false); 
    
    // 2. Lazy Load Metadata (async)
    for (let i = 0; i < initialSongs.length; i++) {
        const metadata = await getMetadata(initialSongs[i].file);
        if (metadata.title || metadata.artist || metadata.picture) {
             setSongs(prev => {
                 const newArr = [...prev];
                 const idx = newArr.findIndex(s => s.id === initialSongs[i].id);
                 if (idx !== -1) {
                     newArr[idx] = {
                         ...newArr[idx],
                         name: metadata.title || newArr[idx].name,
                         artist: metadata.artist,
                         coverUrl: metadata.picture
                     };
                 }
                 return newArr;
             });
        }
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
  };

  const handleNext = useCallback((auto = false) => {
    setSongs(prevSongs => {
      setCurrentSongIndex(prevIndex => {
        if (prevSongs.length === 0) return -1;
        
        if (mode === PlaybackMode.REPEAT_ONE && auto) {
            if(audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
            return prevIndex;
        }

        if (mode === PlaybackMode.SHUFFLE) {
          const randomIndex = Math.floor(Math.random() * prevSongs.length);
          return randomIndex;
        }

        const nextIndex = prevIndex + 1;
        if (nextIndex >= prevSongs.length) {
          if (mode === PlaybackMode.SEQUENCE) {
             setIsPlaying(false); 
             return prevIndex;
          }
          return 0;
        }
        return nextIndex;
      });
      return prevSongs;
    });
  }, [mode]);

  const handlePrev = () => {
    if (songs.length === 0) return;
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    if (mode === PlaybackMode.SHUFFLE) {
       handleNext(); 
       return;
    }
    setCurrentSongIndex(prev => {
      const newIndex = prev - 1;
      return newIndex < 0 ? songs.length - 1 : newIndex;
    });
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

  // Dragging Handlers (Seekbar)
  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleSeekMove = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setDragTime(val);
      if (!isDragging) setIsDragging(true); // Safety
  };

  const handleSeekEnd = (e: React.MouseEvent | React.TouchEvent) => {
      if (audioRef.current) {
          audioRef.current.currentTime = dragTime;
          setCurrentTime(dragTime);
      }
      setIsDragging(false);
  };

  // Swipe Handlers (Full Player)
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartRef.current;
      // Only allow dragging down
      if (diff > 0) {
          setSwipeOffset(diff);
      }
  };

  const handleTouchEnd = () => {
      const threshold = 150; // px to close
      if (swipeOffset > threshold) {
          setIsFullPlayerOpen(false);
      }
      // Reset immediately to allow animation to clean up or snap back
      setSwipeOffset(0);
  };

  // Filter Songs
  const filteredSongs = useMemo(() => {
    if (!searchQuery) return songs;
    const lower = searchQuery.toLowerCase();
    return songs.filter(s => 
        s.name.toLowerCase().includes(lower) || 
        (s.artist && s.artist.toLowerCase().includes(lower))
    );
  }, [songs, searchQuery]);

  const handlePlayFiltered = (song: Song) => {
      const idx = songs.findIndex(s => s.id === song.id);
      if (idx !== -1) {
          setCurrentSongIndex(idx);
          setIsPlaying(true);
      }
  };

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

  // --- Render Helpers ---

  const currentSong = songs[currentSongIndex];
  const t = translations[language];

  // Styles
  const appStyle = {
    backgroundColor: theme.background,
    color: theme.onSurface,
  } as React.CSSProperties;

  const primaryStyle = { color: theme.primary } as React.CSSProperties;
  const primaryContainerStyle = { backgroundColor: theme.primaryContainer, color: theme.onPrimaryContainer } as React.CSSProperties;
  const surfaceVariantStyle = { backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant } as React.CSSProperties;

  return (
    <div className="h-screen w-full overflow-hidden select-none relative" style={appStyle}>
      {/* Audio Element (Persistent) */}
      <audio 
        ref={audioRef} 
        src={currentSong?.url} 
      />

      {/* --- View Container (Stack) --- */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
          
          {/* Main View */}
          <div 
            className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out ${view === 'main' ? 'translate-x-0' : view === 'settings' || view === 'stats' || view === 'info' ? '-translate-x-1/3 opacity-50' : ''}`}
          >
              {/* Top Bar */}
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
                                onClick={() => setView('settings')}
                                className="p-2 rounded-full hover:brightness-110 active:scale-95 transition"
                                style={{ color: theme.onSurfaceVariant }}
                            >
                                <SettingsIcon />
                            </button>
                        </div>
                    </>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row">
                 {/* Empty State */}
                {songs.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center opacity-70">
                        <div className="mb-4 p-6 rounded-3xl" style={primaryContainerStyle}>
                            <MusicNoteIcon className="w-16 h-16"/>
                        </div>
                        <p className="text-lg font-medium">{t.noMusic}</p>
                        <p className="text-sm mt-2 opacity-80">{t.hint}</p>
                    </div>
                )}
                {/* List */}
                <div className={`flex-1 overflow-y-auto ${songs.length === 0 ? 'hidden' : ''} pb-32 md:pb-0`}>
                    <div className="p-4 space-y-1">
                         <div className="flex justify-between items-center mb-2 px-2 opacity-70 text-sm font-medium">
                            <span>{filteredSongs.length} {t.songs}</span>
                         </div>
                         {filteredSongs.map((song) => {
                            const originalIndex = songs.findIndex(s => s.id === song.id);
                            const isActive = originalIndex === currentSongIndex;
                            return (
                                <div
                                key={song.id}
                                onClick={() => handlePlayFiltered(song)}
                                className={`flex items-center p-3 rounded-2xl cursor-pointer transition-colors duration-200 group`}
                                style={{ 
                                    backgroundColor: isActive ? theme.primaryContainer : 'transparent',
                                    color: isActive ? theme.onPrimaryContainer : theme.onSurface
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
                         })}
                    </div>
                </div>
              </div>
          </div>

          {/* Settings View */}
          <div 
            className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ease-in-out ${view === 'settings' ? 'translate-x-0' : 'translate-x-full'}`}
            style={{ backgroundColor: theme.background }}
          >
             <div className="h-16 flex items-center px-4 gap-4 shrink-0" style={{ backgroundColor: theme.surface }}>
                  <button onClick={() => setView('main')} className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}><ArrowBackIcon /></button>
                  <h1 className="text-xl font-medium" style={{color: theme.onSurface}}>{t.settings}</h1>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {/* ... (Settings content) ... */}
                <section>
                    <h2 className="text-sm font-medium mb-2 px-2" style={{color: theme.primary}}>{t.stats}</h2>
                    <div className="rounded-3xl overflow-hidden" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                        <div className="p-4 flex justify-between items-center active:bg-black/5 transition cursor-pointer" onClick={() => setView('stats')}>
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
                                <div className={`w-12 h-7 shrink-0 rounded-full relative transition-colors duration-200 border border-transparent ml-4`} style={{backgroundColor: appSettings.pauseOnDisconnect ? theme.primary : theme.outline}}>
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
                                    {[DEFAULT_THEME_COLOR, '#9C27B0', '#E91E63', '#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#3F51B5', '#607D8B'].map(c => (
                                        <button key={c} className="w-10 h-10 rounded-full border-2 transition-all active:scale-90 flex items-center justify-center" style={{ backgroundColor: c, borderColor: themeColor === c ? theme.onSurface : 'transparent' }} onClick={() => setThemeColor(c)}>{themeColor === c && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}</button>
                                    ))}
                                </div>
                        </div>
                    </div>
                </section>
                <section>
                    <h2 className="text-sm font-medium mb-2 px-2" style={{color: theme.primary}}>{t.info}</h2>
                    <div className="rounded-3xl overflow-hidden" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                        <div className="p-4 flex justify-between items-center active:bg-black/5 transition cursor-pointer" onClick={() => setView('info')}>
                                <div className="flex items-center gap-3"><InfoIcon /><span className="text-base">{t.aboutApp}</span></div>
                                <div className="opacity-50"><SkipNextIcon className="w-5 h-5"/></div>
                        </div>
                    </div>
                </section>
             </div>
          </div>

          {/* Info View */}
          <div 
             className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ease-in-out ${view === 'info' ? 'translate-x-0' : 'translate-x-full'}`}
             style={{ backgroundColor: theme.background }}
          >
              <div className="h-16 flex items-center px-4 gap-4 shrink-0" style={{ backgroundColor: theme.surface }}>
                  <button onClick={() => setView('settings')} className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}><ArrowBackIcon /></button>
                  <h1 className="text-xl font-medium" style={{color: theme.onSurface}}>{t.info}</h1>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-32">
                  <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-24 h-24 rounded-3xl mb-4 flex items-center justify-center shadow-lg" style={{backgroundColor: theme.primaryContainer}}>
                           <MusicNoteIcon className="w-12 h-12" />
                      </div>
                      <h2 className="text-2xl font-bold mb-1">Elysium</h2>
                      <p className="opacity-60 text-sm">v0.1.0</p>
                  </div>

                  <div className="space-y-4">
                      <div className="rounded-3xl overflow-hidden p-5 space-y-4" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                          <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold uppercase opacity-50 tracking-wider" style={{color: theme.primary}}>{t.developer}</span>
                              <span className="text-lg font-medium">midway2333</span>
                          </div>
                          <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold uppercase opacity-50 tracking-wider" style={{color: theme.primary}}>{t.basedOn}</span>
                              <span className="text-lg font-medium">Gemini 3 vibe coding</span>
                          </div>
                      </div>

                      <div className="rounded-3xl overflow-hidden p-1 space-y-1" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                           <div className="px-4 py-2 mt-2">
                                <span className="text-xs font-bold uppercase opacity-50 tracking-wider" style={{color: theme.primary}}>{t.links}</span>
                           </div>
                           <a href="https://space.bilibili.com/400980240" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-black/5 rounded-2xl transition">
                                <span className="font-medium">Bilibili</span>
                                <SkipNextIcon className="opacity-50 w-5 h-5"/>
                           </a>
                           <a href="https://github.com/midway2333/Elysium" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-black/5 rounded-2xl transition">
                                <span className="font-medium">GitHub</span>
                                <SkipNextIcon className="opacity-50 w-5 h-5"/>
                           </a>
                      </div>
                  </div>
              </div>
          </div>

          {/* Stats View */}
          <div 
             className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ease-in-out ${view === 'stats' ? 'translate-x-0' : 'translate-x-full'}`}
             style={{ backgroundColor: theme.background }}
          >
              <div className="h-16 flex items-center px-4 gap-4 shrink-0" style={{ backgroundColor: theme.surface }}>
                  <button onClick={() => setView('settings')} className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}><ArrowBackIcon /></button>
                  <h1 className="text-xl font-medium" style={{color: theme.onSurface}}>{t.stats}</h1>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-32">
                 {/* ... (Stats content same as before) ... */}
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
                                        {stats.topArtist && (
                                            <div className="p-4 rounded-3xl" style={{backgroundColor: theme.surfaceVariant, color: theme.onSurfaceVariant}}>
                                                <div className="flex items-center gap-3 mb-3 opacity-70"><StatsIcon /><span className="text-sm font-bold uppercase">{t.topArtist}</span></div>
                                                <div className="flex justify-between items-center">
                                                    <div className="min-w-0"><div className="text-lg font-bold truncate">{stats.topArtist.name}</div></div>
                                                    <div className="text-right shrink-0 ml-4"><div className="font-mono font-medium">{formatDuration(stats.topArtist.time, true)}</div><div className="text-xs opacity-60">{stats.topArtist.count} plays</div></div>
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
          </div>
      </div>

      {/* --- Mini Player (Bottom Bar) --- */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden ${isFullPlayerOpen ? 'translate-y-full' : 'translate-y-0'}`}
        style={{ 
            // Changed: Use theme color with opacity for tinting, enabling content behind to be seen
            backgroundColor: appSettings.enableBlur 
                ? theme.surfaceVariant.replace('rgb', 'rgba').replace(')', ', 0.5)') 
                : theme.surfaceVariant,
            backdropFilter: appSettings.enableBlur ? 'blur(16px)' : 'none',
            WebkitBackdropFilter: appSettings.enableBlur ? 'blur(16px)' : 'none', // Safari support
            display: songs.length === 0 ? 'none' : 'block' 
        }}
        onClick={() => setIsFullPlayerOpen(true)}
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
         className={`absolute inset-0 z-30 flex flex-col cubic-bezier(0.2, 0.0, 0, 1.0) overflow-hidden ${swipeOffset === 0 ? 'transition-transform duration-500' : ''}`}
         style={{ 
            backgroundColor: theme.surfaceVariant, 
            height: '100dvh',
            transform: isFullPlayerOpen ? `translateY(${swipeOffset}px)` : 'translateY(100%)'
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
               <button onClick={() => setIsFullPlayerOpen(false)} className="p-2 rounded-full active:bg-black/10 transition" style={{color: theme.onSurfaceVariant}}>
                   <ChevronDownIcon />
               </button>
               <span className="text-xs font-bold tracking-widest uppercase opacity-50" style={{color: theme.onSurfaceVariant}}>Now Playing</span>
               <button onClick={() => {setIsFullPlayerOpen(false); setView('settings');}} className="p-2 rounded-full active:bg-black/10 transition" style={{color: theme.onSurfaceVariant}}>
                   <SettingsIcon />
               </button>
          </div>

          {/* Main Body (Flexibly Shrinkable) */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 relative z-10 min-h-0 overflow-hidden">
               {/* Big Cover Art */}
               <div className="w-full h-auto aspect-square max-h-[40vh] max-w-sm rounded-[2rem] shadow-2xl overflow-hidden bg-cover bg-center border border-black/5 relative shrink-1"
                    style={{ 
                        backgroundColor: theme.surface,
                        backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : 'none'
                    }}>
                    {!currentSong?.coverUrl && <div className="absolute inset-0 flex items-center justify-center"><MusicNoteIcon className="w-32 h-32 opacity-10"/></div>}
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
                        <button onClick={handlePrev} className="p-4 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}>
                            <SkipPrevIcon className="w-8 h-8"/>
                        </button>
                        <button onClick={togglePlay} className="p-6 rounded-[24px] shadow-lg active:scale-95 transition hover:shadow-xl hover:brightness-110" style={{backgroundColor: theme.primary, color: theme.onPrimary}}>
                             {isPlaying ? <PauseIcon className="w-10 h-10"/> : <PlayIcon className="w-10 h-10"/>}
                        </button>
                        <button onClick={() => handleNext()} className="p-4 rounded-full hover:bg-black/5 active:scale-95 transition" style={{color: theme.onSurface}}>
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
                             <button onClick={() => setIsDetailsOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-black/5 flex items-center justify-center"><CloseIcon /></button>
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
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFolderSelect}
        className="hidden"
        multiple
        accept="audio/*"
        // @ts-ignore
        webkitdirectory="" 
        directory=""
      />
    </div>
  );
};

export default App;