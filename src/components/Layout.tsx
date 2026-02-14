import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Menu } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    sidebar?: React.ReactElement;
    isFocusedContent?: boolean;
    disableGlobalSwipe?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar, isFocusedContent, disableGlobalSwipe }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isToggleButtonVisible, setIsToggleButtonVisible] = useState(true);
    const inactivityTimer = useRef<any>(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    // --- Buttery Smooth Gesture Logic ---
    const SIDEBAR_WIDTH = 280;
    // x tracks the sidebar offset: -SIDEBAR_WIDTH (closed) to 0 (open)
    const x = useMotionValue(-SIDEBAR_WIDTH);
    // STIFF SPRING: 1000 stiffness + 60 damping = Instant but smooth snap
    const springX = useSpring(x, { damping: 60, stiffness: 1000, mass: 0.5, restDelta: 0.001 });

    // Derived values for the overlay
    const opacity = useTransform(springX, [-SIDEBAR_WIDTH, 0], [0, 1]);
    const backdropBlur = useTransform(springX, [-SIDEBAR_WIDTH, 0], [0, 8]);

    const openMenu = () => {
        setIsMenuOpen(true);
        x.set(0);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
        x.set(-SIDEBAR_WIDTH);
    };

    const resetInactivityTimer = () => {
        setIsToggleButtonVisible(true);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            setIsToggleButtonVisible(false);
        }, 5000);
    };

    useEffect(() => {
        if (!isMobile) return;
        if (isFocusedContent) setIsToggleButtonVisible(false);
        else resetInactivityTimer();

        const handleInteraction = () => {
            if (!isFocusedContent) resetInactivityTimer();
        };

        window.addEventListener('mousedown', handleInteraction);
        window.addEventListener('scroll', handleInteraction, true);
        return () => {
            window.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('scroll', handleInteraction, true);
        };
    }, [isMobile, isFocusedContent]);

    return (
        <div
            className="layout"
            style={{
                height: '100%',
                display: 'flex',
                background: 'transparent',
                isolation: 'isolate',
                overflow: 'hidden'
            }}
        >
            {/* 1. Global Touch Handler (Pan on the whole layout) */}
            {isMobile && !disableGlobalSwipe && (
                <motion.div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: isMenuOpen ? 2045 : 0,
                        pointerEvents: isMenuOpen ? 'auto' : 'none',
                        background: 'transparent'
                    }}
                    onClick={closeMenu}
                    onPan={(_, info) => {
                        if (!isMenuOpen) return;
                        if (Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.5) {
                            const newX = Math.min(0, Math.max(-SIDEBAR_WIDTH, info.offset.x));
                            x.set(newX);
                        }
                    }}
                    onPanEnd={(_, info) => {
                        if (!isMenuOpen) return;
                        const velocityThreshold = 50;
                        const offsetThreshold = 20;
                        const shouldClose = info.velocity.x < -velocityThreshold || (info.offset.x < -offsetThreshold && info.velocity.x < velocityThreshold);

                        if (shouldClose) closeMenu();
                        else openMenu();
                    }}
                />
            )}

            <motion.div
                style={{ flex: 1, display: 'flex', width: '100vw', height: '100%', touchAction: 'pan-y' }}
                onPan={(_, info) => {
                    if (disableGlobalSwipe || !isMobile) return;

                    // Only handle pan if it's primarily horizontal
                    if (Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.5) {
                        const currentPos = isMenuOpen ? 0 : -SIDEBAR_WIDTH;
                        const newX = Math.min(0, Math.max(-SIDEBAR_WIDTH, currentPos + info.offset.x));
                        x.set(newX);
                    }
                }}
                onPanEnd={(_, info) => {
                    if (disableGlobalSwipe || !isMobile) return;

                    // Hyper-sensitive snapping (similar to Calendar month change)
                    const velocityThreshold = 50;
                    const offsetThreshold = 20;

                    const shouldOpen = info.velocity.x > velocityThreshold || (info.offset.x > offsetThreshold && info.velocity.x > -velocityThreshold);
                    const shouldClose = info.velocity.x < -velocityThreshold || (info.offset.x < -offsetThreshold && info.velocity.x < velocityThreshold);

                    if (isMenuOpen) {
                        if (shouldClose) closeMenu();
                        else openMenu();
                    } else {
                        if (shouldOpen) openMenu();
                        else closeMenu();
                    }
                }}
            >
                {/* 2. Hamburger for mobile */}
                <AnimatePresence>
                    {isMobile && isToggleButtonVisible && (
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="mobile-menu-btn"
                            onClick={() => isMenuOpen ? closeMenu() : openMenu()}
                            style={{ zIndex: 2100 }}
                        >
                            <Menu size={20} />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* 3. Smooth Overlay */}
                {isMobile && (
                    <motion.div
                        onClick={closeMenu}
                        style={{
                            position: 'fixed', inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            opacity,
                            backdropFilter: `blur(${backdropBlur}px)`,
                            WebkitBackdropFilter: `blur(${backdropBlur}px)`,
                            zIndex: 2040,
                            pointerEvents: 'none' // Clicks are handled by the global overlay or main container
                        }}
                    />
                )}

                {/* 4. The Sidebar with injected MotionValue */}
                {sidebar && React.cloneElement(sidebar as React.ReactElement<any>, {
                    onClose: closeMenu,
                    dragX: springX
                })}

                <main
                    style={{ flex: 1, position: 'relative', overflowY: disableGlobalSwipe ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                    >
                        {children}
                    </motion.div>
                </main>
            </motion.div>
        </div>
    );
};
