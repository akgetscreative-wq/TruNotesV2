import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, RotateCcw, Maximize, Minimize, Edit2, Lock, Unlock, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { useThemeContext } from '../../context/ThemeContext';
import { getWallpaperPath } from '../../utils/assetLoader';
import defaultWallpaper from '../../assets/wallpapers/default-bg.png';
import { useSettings } from '../../context/SettingsContext';

export const TimerView: React.FC = () => {
    // Timer State
    const {
        timeLeft,
        duration,
        isActive,
        mode,
        taskName,
        setTaskName,
        toggleTimer,
        resetTimer,
        setTimerMode,
        setCustomDuration
    } = useTimer();

    const { theme } = useThemeContext();
    const { customWallpapers } = useSettings();
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const totalWallpapersCount = 17 + customWallpapers.length;

    // Local UI State
    const [isEditingTask, setIsEditingTask] = useState(false);
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('25');

    // --- INSERTED CUSTOM MODAL LOGIC START ---
    const [showCustomTimeModal, setShowCustomTimeModal] = useState(false);

    // Custom Time Modal Logic
    const confirmCustomTime = () => {
        const mins = parseInt(customMinutes);
        if (!isNaN(mins) && mins > 0) {
            setCustomDuration(mins);
            setTimerMode('custom');
            setShowCustomTimeModal(false);
        }
    };

    const customTimeModal = showCustomTimeModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            zIndex: 999999, // Above Zen Mode
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCustomTimeModal(false); }} // Click outside to close
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                    background: 'rgba(30,30,40,0.85)',
                    backdropFilter: 'blur(20px)',
                    padding: '2rem',
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.5rem',
                    width: '320px'
                }}
            >
                <h3 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Set Timer</h3>

                <div style={{ position: 'relative', width: '100%' }}>
                    <input
                        type="number"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmCustomTime()}
                        autoFocus
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '1rem',
                            color: 'white',
                            fontSize: '2rem',
                            textAlign: 'center',
                            outline: 'none',
                            fontWeight: 'bold'
                        }}
                    />
                    <span style={{
                        position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                        color: 'rgba(255,255,255,0.5)', pointerEvents: 'none'
                    }}>min</span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                    <button
                        onClick={() => setShowCustomTimeModal(false)}
                        style={{
                            flex: 1, padding: '0.8rem', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.1)', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 600
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmCustomTime}
                        style={{
                            flex: 1, padding: '0.8rem', borderRadius: '12px',
                            background: 'var(--accent-primary)', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 600
                        }}
                    >
                        Start
                    </button>
                </div>
            </motion.div>
        </div>
    );
    // --- INSERTED CUSTOM MODAL LOGIC END ---

    // "Zen Mode" = Portal Mode (Overlays everything, used for Slideshow & Fullscreen)
    const [isZenMode, setIsZenMode] = useState(false);
    const [isStandbyActive, setIsStandbyActive] = useState(false);

    // Wallpaper State
    const [wallpaperUrl, setWallpaperUrl] = useState<string>(defaultWallpaper);
    const [isSlideshowActive, setIsSlideshowActive] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [currentWallpaperIndex, setCurrentWallpaperIndex] = useState(Math.floor(Math.random() * 17));
    const [showControls, setShowControls] = useState(false);
    const controlsTimeoutRef = useRef<any>(null);

    // Load Wallpaper
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                if (isSlideshowActive) {
                    if (currentWallpaperIndex < 17) {
                        const path = await getWallpaperPath(currentWallpaperIndex);
                        if (isMounted) setWallpaperUrl(path);
                    } else {
                        // Custom wallpaper
                        const customIndex = currentWallpaperIndex - 17;
                        if (isMounted) setWallpaperUrl(customWallpapers[customIndex]);
                    }
                } else {
                    setWallpaperUrl(defaultWallpaper);
                }
            } catch (error) {
                console.error("Failed to load wallpaper", error);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [currentWallpaperIndex, isSlideshowActive, customWallpapers]);

    const wallpaper = wallpaperUrl;

    // Controls Visibility
    const handleMouseMove = () => {
        if (!showControls) setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    };

    // Slideshow Interval
    useEffect(() => {
        let interval: any;
        if (isSlideshowActive && !isLocked) {
            interval = setInterval(() => {
                // Shuffle randomly instead of sequentially
                let nextIndex;
                do {
                    nextIndex = Math.floor(Math.random() * totalWallpapersCount);
                } while (nextIndex === currentWallpaperIndex && totalWallpapersCount > 1);
                setCurrentWallpaperIndex(nextIndex);
            }, 30000);
        }
        return () => clearInterval(interval);
    }, [isSlideshowActive, isLocked, currentWallpaperIndex, totalWallpapersCount]);

    const toggleSlideshow = () => {
        const nextState = !isSlideshowActive;
        setIsSlideshowActive(nextState);
        if (nextState) {
            setIsZenMode(true); // Enter Portal
            setIsStandbyActive(false); // Disable Standby if active
            setIsLocked(false);
            handleMouseMove();

            // Auto enter browser fullscreen
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch((e) => console.log(e));
            }
        } else {
            // Exit functionality is handled by X button or Esc usually
            // but if toggled off via button directly (rare):
            setIsZenMode(false);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => console.log(e));
            setIsZenMode(true); // Enter Portal (Essential for hiding sidebar)
            setIsStandbyActive(false);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => console.log(err));
            }
            setIsZenMode(false); // Exit Portal
            setIsStandbyActive(false);
        }
    };

    const toggleStandby = () => {
        console.log("Toggle Standby Clicked. Next State:", !isStandbyActive);
        const nextState = !isStandbyActive;
        setIsStandbyActive(nextState);
        if (nextState) {
            setIsZenMode(true);
            setIsSlideshowActive(false);
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(e => console.log(e));
            }
        } else {
            setIsZenMode(false);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    };

    // Sync fullscreen state with simple "Escape" or F11 key presses
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFull = !!document.fullscreenElement;
            if (!isFull) {
                setIsZenMode(false);
                setIsSlideshowActive(false);
                setIsStandbyActive(false);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const getRandomIndex = () => {
        if (totalWallpapersCount <= 1) return 0;
        let next;
        do {
            next = Math.floor(Math.random() * totalWallpapersCount);
        } while (next === currentWallpaperIndex);
        return next;
    };

    const nextWallpaper = () => setCurrentWallpaperIndex(getRandomIndex());
    const prevWallpaper = () => setCurrentWallpaperIndex(getRandomIndex());

    // Custom Time
    const handleCustomTimeSubmit = () => {
        const mins = parseInt(customMinutes);
        if (!isNaN(mins) && mins > 0) {
            setCustomDuration(mins);
        }
        setIsEditingTime(false);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isZenMode) {
                    setIsSlideshowActive(false);
                    setIsZenMode(false);
                    setIsStandbyActive(false);
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(err => console.log(err));
                    }
                    e.stopImmediatePropagation();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isZenMode]);

    // Keep inputs focused
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (isEditingTask && inputRef.current) inputRef.current.focus();
    }, [isEditingTask]);

    useEffect(() => {
        if (mode === 'custom' && !isEditingTime) {
            setCustomMinutes(Math.floor(duration / 60).toString());
        }
    }, [mode, duration, isEditingTime]);


    // --- Standby Clock Component ---
    const renderStandbyClock = () => {
        const digitVariants = {
            initial: { y: 50, opacity: 0, scale: 0.5 },
            animate: { y: 0, opacity: 1, scale: 1 },
            exit: { y: -50, opacity: 0, scale: 0.5 }
        };
        const minStr = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const secStr = (timeLeft % 60).toString().padStart(2, '0');

        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', cursor: 'pointer',
                fontFamily: "'Fredoka', sans-serif",
            }}
                onClick={(e) => { e.stopPropagation(); toggleTimer(); }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100vw', // Use full viewport width to allow flexing
                    fontSize: '28vw', fontWeight: 800, lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
                    gap: 0 // Remove gap, handle spacing via flex containers
                }}>
                    {/* Minutes (Right Aligned) */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', color: '#60a5fa' }}>
                        <AnimatePresence mode='popLayout'>
                            <motion.span key={`m1-${minStr[0]}`} variants={digitVariants} initial="initial" animate="animate" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 20 }}>{minStr[0]}</motion.span>
                            <motion.span key={`m2-${minStr[1]}`} variants={digitVariants} initial="initial" animate="animate" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 20 }}>{minStr[1]}</motion.span>
                        </AnimatePresence>
                    </div>

                    {/* Colon (Fixed Center) */}
                    <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        style={{
                            color: 'rgba(255,255,255,0.2)',
                            width: '12vw', // Fixed width for colon area
                            textAlign: 'center',
                            display: 'flex',
                            justifyContent: 'center',
                            paddingBottom: '3vw'
                        }}
                    >
                        :
                    </motion.div>

                    {/* Seconds (Left Aligned) */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', color: '#4ade80' }}>
                        <AnimatePresence mode='popLayout'>
                            <motion.span key={`s1-${secStr[0]}`} variants={digitVariants} initial="initial" animate="animate" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 20 }}>{secStr[0]}</motion.span>
                            <motion.span key={`s2-${secStr[1]}`} variants={digitVariants} initial="initial" animate="animate" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 20 }}>{secStr[1]}</motion.span>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        );
    };


    // --- Shared Timer Display Component ---
    const TimerDisplay = ({ isZen = false }) => (
        // Removed negative margins for Zen Mode to ensure true centering
        <div style={{ textAlign: 'center', marginBottom: isZen ? '0' : '3rem', marginTop: isZen ? '0' : '0' }}>
            <div
                // Click to toggle timer (Pause/Play)
                onClick={() => {
                    if (!isEditingTime) toggleTimer();
                }}
                style={{
                    fontSize: '8rem',
                    fontWeight: 800,
                    color: 'white',
                    textShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    fontVariantNumeric: 'tabular-nums',

                    lineHeight: 1,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                {mode === 'custom' && isEditingTime ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
                        <input
                            type="number"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(e.target.value)}
                            onBlur={handleCustomTimeSubmit}
                            onKeyDown={(e) => e.key === 'Enter' && handleCustomTimeSubmit()}
                            autoFocus
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                fontSize: '8rem',
                                fontWeight: 800,
                                width: '300px',
                                textAlign: 'right',
                                borderRadius: '16px',
                                padding: '0 1rem',
                                fontFamily: 'inherit'
                            }}
                        />
                        <span style={{ fontSize: '4rem', opacity: 0.8 }}>min</span>
                    </div>
                ) : (
                    // SPLIT LAYOUT: Minutes (Right) | Colon (Center) | Seconds (Left)
                    // This explicitly locks the visual center to the colon.
                    <div
                        onClick={() => !isZen && mode === 'custom' && setIsEditingTime(true)}
                        style={{
                            cursor: !isZen && mode === 'custom' ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            maxWidth: '900px'
                        }}
                    >
                        {/* Minutes: Pushes content to the right edge of its box */}
                        <div style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.floor(timeLeft / 60).toString().padStart(2, '0')}
                        </div>

                        {/* Colon: Fixed Center */}
                        <div style={{ width: '4rem', textAlign: 'center', paddingBottom: '1rem' }}>:</div>

                        {/* Seconds: Pushes content to the left edge of its box */}
                        <div style={{ flex: 1, textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
                            {(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '1rem', height: '40px', display: 'flex', justifyContent: 'center' }}>
                {isEditingTask && !isZen ? (
                    <input
                        ref={inputRef}
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        onBlur={() => setIsEditingTask(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingTask(false)}
                        style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: 'white',
                            fontSize: '1.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            textAlign: 'center',
                            width: '400px'
                        }}
                    />
                ) : (
                    <div
                        onClick={() => !isZen && setIsEditingTask(true)}
                        style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '1.5rem',
                            cursor: isZen ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {taskName || 'Focus'}
                        {!isZen && <Edit2 size={16} style={{ opacity: 0.7 }} />}
                    </div>
                )}
            </div>


        </div>
    );

    // Zen Mode Curtain (Portal to Body to cover Sidebar)
    const zenCurtain = createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{
                opacity: isZenMode ? 1 : 0,
                pointerEvents: isZenMode ? 'auto' : 'none'
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                zIndex: 999998,
                backgroundColor: isStandbyActive ? '#000' : 'rgba(0,0,0,0)', // Solid Black for Standby
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseMove={handleMouseMove}
        >
            {/* Wallpaper Layer - Only show if NOT Standby */}
            {!isStandbyActive && (
                <>
                    <div
                        style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            backgroundImage: `url(${wallpaper})`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            transition: 'background-image 1s ease-in-out'
                        }}
                    />
                    <AnimatePresence>
                        <motion.div
                            key={wallpaper}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                            style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center',
                            }}
                        />
                    </AnimatePresence>

                    {/* Overlay */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: isSlideshowActive
                            ? (theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.10)')
                            : 'rgba(0,0,0,0.65)',
                        transition: 'background-color 1s ease'
                    }} />
                </>
            )}

            {/* Zen Timer Content & Controls - Auto Hide */}
            <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isStandbyActive ? renderStandbyClock() : <TimerDisplay isZen={true} />}

                {/* Auto-hide Play/Reset Controls in Zen Mode */}
                <AnimatePresence>
                    {isZenMode && showControls && !isStandbyActive && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '2rem',
                                pointerEvents: 'auto',
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bottom: '20%',
                            }}
                        >
                            <button
                                onClick={toggleTimer}
                                style={{
                                    width: '80px', height: '80px', borderRadius: '50%',
                                    background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'white',
                                    color: isActive ? 'white' : 'var(--accent-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                                    fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', border: 'none'
                                }}
                            >
                                {isActive ? 'PAUSE' : 'START'}
                            </button>
                            <button
                                onClick={resetTimer}
                                style={{
                                    width: '60px', height: '60px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.1)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(10px)', marginTop: '10px',
                                    cursor: 'pointer', border: 'none'
                                }}
                            >
                                <RotateCcw size={24} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating UI Controls (Exit, Slideshow Nav) */}
            <AnimatePresence>
                {isZenMode && showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 20, x: '-50%' }}
                        style={{
                            position: 'absolute',
                            bottom: '50px',
                            left: '50%',
                            display: 'flex', gap: '1rem', alignItems: 'center',
                            background: 'rgba(0,0,0,0.6)',
                            padding: '0.8rem 1.5rem', borderRadius: '50px',
                            backdropFilter: 'blur(10px)', zIndex: 100, border: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        {isSlideshowActive && (
                            <>
                                <button onClick={prevWallpaper} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={20} /></button>
                                <button onClick={() => setIsLocked(!isLocked)} style={{ background: 'none', border: 'none', color: isLocked ? '#fbbf24' : 'white', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                                </button>
                                <button onClick={nextWallpaper} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><ChevronRight size={20} /></button>
                                <div style={{ width: '1px', height: '1.5rem', background: 'rgba(255,255,255,0.3)', margin: '0 0.5rem' }} />
                            </>
                        )}

                        {/* Common Controls */}
                        <button
                            onClick={() => { setIsZenMode(false); setIsStandbyActive(false); if (document.fullscreenElement) document.exitFullscreen(); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                            title="Exit"
                        >
                            <Minimize size={24} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

        </motion.div>,
        document.body
    );

    const bgContent = (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center',
            zIndex: -1, display: 'block'
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.3)',
                transition: 'background-color 0.5s ease'
            }} />
        </div>
    );

    return (
        <>
            {customTimeModal}
            {zenCurtain}
            {bgContent}
            <div className={`timer-view ${isZenMode ? 'zen-mode-active' : ''}`} style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                maxWidth: '100%',
                margin: '0',
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 4rem)',
                justifyContent: 'space-between',
                transition: 'opacity 0.5s ease',
                opacity: isZenMode ? 0 : 1,
                pointerEvents: isZenMode ? 'none' : 'auto',
                overflow: 'hidden'
            }}>

                {/* Top Controls (Top Right) */}
                <div style={{
                    position: 'absolute',
                    top: '2rem',
                    right: '2rem',
                    display: 'flex',
                    gap: '0.75rem',
                    zIndex: 10
                }}>
                    <button
                        onClick={toggleStandby}
                        style={{
                            background: 'rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '12px',
                            color: '#fbbf24', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
                            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
                        }}
                        title="Standby Mode"
                    >
                        <Star size={20} fill="#fbbf24" strokeWidth={1} />
                    </button>

                    <button
                        onClick={toggleFullScreen}
                        style={{
                            background: 'rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '12px',
                            color: 'white', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
                            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
                        }}
                        title="Full Screen"
                    >
                        <Maximize size={20} />
                    </button>

                    <button
                        onClick={toggleSlideshow}
                        style={{
                            background: 'rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '12px',
                            color: 'white', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
                            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
                        }}
                        title="Slideshow"
                    >
                        <Image size={20} />
                    </button>
                </div>

                {/* Center Content: Timer Display & Play Controls */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2rem'
                }}>
                    <TimerDisplay />

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
                        <button
                            onClick={toggleTimer}
                            style={{
                                width: '80px', height: '80px', borderRadius: '50%',
                                background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'white',
                                color: isActive ? 'white' : 'var(--accent-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                                fontSize: '1rem', fontWeight: 800, cursor: 'pointer', border: 'none',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            {isActive ? 'PAUSE' : 'START'}
                        </button>

                        <button
                            onClick={resetTimer}
                            style={{
                                width: '60px', height: '60px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(10px)',
                                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <RotateCcw size={24} />
                        </button>
                    </div>
                </div>

                {/* Bottom Mode Selector (Floating Refined Pill) */}
                <div style={{
                    width: 'auto',
                    maxWidth: '90%',
                    margin: isMobile ? '0 auto 1.5rem auto' : '0 auto 2rem auto',
                    padding: isMobile ? '0.4rem' : '0.5rem',
                    background: theme === 'dark' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    flexShrink: 0
                }}>
                    <div className="no-scrollbar" style={{
                        display: 'flex',
                        gap: '0.4rem',
                        overflowX: 'auto',
                        width: '100%',
                        justifyContent: 'center',
                        padding: '0 0.5rem'
                    }}>
                        {[
                            { id: 'focus', label: 'Pomodoro' },
                            { id: 'short', label: 'Short' },
                            { id: 'long', label: 'Long' },
                            { id: 'custom', label: 'Custom' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => {
                                    if (m.id === 'custom') {
                                        setCustomMinutes(Math.floor(duration / 60).toString());
                                        setShowCustomTimeModal(true);
                                    } else {
                                        setTimerMode(m.id as any);
                                        setIsEditingTime(false);
                                    }
                                }}
                                style={{
                                    padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1rem',
                                    borderRadius: '14px',
                                    background: mode === m.id ? 'var(--accent-primary)' : 'transparent',
                                    color: mode === m.id ? 'white' : 'rgba(255,255,255,0.8)',
                                    fontWeight: 700,
                                    fontSize: isMobile ? '0.75rem' : '0.85rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    boxShadow: mode === m.id ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                                }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
