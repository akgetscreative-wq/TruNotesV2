import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    sidebar?: React.ReactElement;
    isFocusedContent?: boolean; // If true (Editor/Scribble), keep menu hidden until edge slide
    disableGlobalSwipe?: boolean; // Disable global drawer swipes (used for Calendar)
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar, isFocusedContent, disableGlobalSwipe }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isToggleButtonVisible, setIsToggleButtonVisible] = useState(true);
    const inactivityTimer = useRef<any>(null);
    const touchStartPos = useRef({ x: 0, y: 0 });
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const resetInactivityTimer = () => {
        setIsToggleButtonVisible(true);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            setIsToggleButtonVisible(false);
        }, 5000);
    };

    useEffect(() => {
        if (!isMobile) return;

        // In focused content, we start hidden
        if (isFocusedContent) {
            setIsToggleButtonVisible(false);
        } else {
            resetInactivityTimer();
        }

        // In normal views, any interaction shows the button
        const handleInteraction = () => {
            if (!isFocusedContent) {
                resetInactivityTimer();
            }
        };

        // Edge slide detection & Global Swipe
        const handleTouchStart = (e: TouchEvent) => {
            touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            if (!isFocusedContent) resetInactivityTimer();
        };

        const handleTouchMove = (e: TouchEvent) => {
            const currentX = e.touches[0].clientX;
            const startX = touchStartPos.current.x;

            // If focused and sliding from left edge (within 25px) to show menu button
            if (isFocusedContent && startX < 25 && currentX > startX + 40) {
                setIsToggleButtonVisible(true);
                resetInactivityTimer();
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (disableGlobalSwipe || !isMobile) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - touchStartPos.current.x;
            const diffY = endY - touchStartPos.current.y;

            // Thresholds
            const SWIPE_X_THRESHOLD = 80;
            const SWIPE_Y_MAX = 50; // Ignore vertical swipes

            if (Math.abs(diffY) > SWIPE_Y_MAX) return;

            if (diffX > SWIPE_X_THRESHOLD) {
                // Right Swipe -> Open Menu (only if swiped from near left edge)
                if (touchStartPos.current.x < 100) {
                    setIsMenuOpen(true);
                }
            } else if (diffX < -SWIPE_X_THRESHOLD) {
                // Left Swipe -> Close Menu
                if (isMenuOpen) {
                    setIsMenuOpen(false);
                }
            }
        };

        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('mousedown', handleInteraction);
        window.addEventListener('scroll', handleInteraction, true);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('scroll', handleInteraction, true);
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [isMobile, isFocusedContent, disableGlobalSwipe, isMenuOpen]);

    return (
        <div className="layout" style={{
            minHeight: '100vh',
            display: 'flex',
            background: 'transparent',
            isolation: 'isolate'
        }}>
            {/* Hamburger for mobile */}
            <AnimatePresence>
                {isMobile && isToggleButtonVisible && (
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="mobile-menu-btn"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <Menu size={20} /> : <Menu size={20} />}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Injected Sidebar Logic */}
            {sidebar && React.cloneElement(sidebar as React.ReactElement<any>, {
                isOpen: isMenuOpen,
                onClose: () => setIsMenuOpen(false)
            })}

            <main
                onClick={() => isMobile && isMenuOpen && setIsMenuOpen(false)}
                style={{ flex: 1, position: 'relative', overflowY: 'auto', height: '100vh', cursor: (isMobile && isMenuOpen) ? 'pointer' : 'default' }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ width: '100%', height: '100%', padding: 0 }}
                >
                    {children}
                </motion.div>
            </main>
        </div>
    );
};
