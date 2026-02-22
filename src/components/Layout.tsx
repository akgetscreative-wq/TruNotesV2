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
    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panDirection = useRef<'horizontal' | 'vertical' | 'ignore' | null>(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    // --- Buttery Smooth Gesture Logic ---
    const SIDEBAR_WIDTH = 280;
    // x tracks the sidebar offset: -SIDEBAR_WIDTH (closed) to 0 (open)
    const x = useMotionValue(-SIDEBAR_WIDTH);
    // STIFF SPRING: 1000 stiffness + 60 damping = Instant but smooth snap
    const springX = useSpring(x, { damping: 30, stiffness: 300, mass: 0.8, restDelta: 0.5 });

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
            {/* 1. Close-on-tap-outside overlay */}
            {isMobile && isMenuOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: SIDEBAR_WIDTH,
                        zIndex: 2045,
                        background: 'transparent'
                    }}
                    onTouchEnd={(e) => { e.preventDefault(); closeMenu(); }}
                    onClick={closeMenu}
                />
            )}

            {/* 3. Smooth Overlay — outside pan handler */}
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
                        pointerEvents: 'none'
                    }}
                />
            )}

            {/* 4. The Sidebar — outside pan handler so taps register instantly */}
            {sidebar && React.cloneElement(sidebar as React.ReactElement<any>, {
                onClose: closeMenu,
                dragX: springX,
                isOpen: isMenuOpen
            })}

            <motion.div
                style={{ flex: 1, display: 'flex', width: '100vw', height: '100%', touchAction: 'pan-y' }}
                onPanStart={(e) => {
                    const target = e.target as Element | null;
                    if (target?.closest?.('.no-swipe')) {
                        panDirection.current = 'ignore';
                    } else {
                        panDirection.current = null;
                    }
                }}
                onPan={(_e, info) => {
                    if (disableGlobalSwipe || !isMobile || panDirection.current === 'ignore') return;

                    // Lock direction on the first significant movement (15px)
                    if (!panDirection.current) {
                        const absX = Math.abs(info.offset.x);
                        const absY = Math.abs(info.offset.y);
                        if (absX > 15 || absY > 15) {
                            // Must be overwhelmingly horizontal (5:1) to count as sidebar swipe
                            panDirection.current = (absX > absY * 5) ? 'horizontal' : 'vertical';
                        }
                        return; // Don't move sidebar until direction is locked
                    }

                    // Only move sidebar if direction is locked as horizontal
                    if (panDirection.current === 'horizontal') {
                        const currentPos = isMenuOpen ? 0 : -SIDEBAR_WIDTH;
                        const newX = Math.min(0, Math.max(-SIDEBAR_WIDTH, currentPos + info.offset.x));
                        x.set(newX);
                    }
                }}
                onPanEnd={(_e, info) => {
                    if (disableGlobalSwipe || !isMobile || panDirection.current === 'ignore') return;

                    // Only act on sidebar if the gesture was locked horizontal
                    if (panDirection.current !== 'horizontal') {
                        panDirection.current = null;
                        return;
                    }
                    panDirection.current = null;

                    const velocityThreshold = 200;
                    const offsetThreshold = 60;

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

                <main
                    style={{ flex: 1, position: 'relative', overflowY: disableGlobalSwipe ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
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
