import React, { useState, useRef, useMemo } from 'react';
import { Pipette } from 'lucide-react';

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    onClose: () => void;
}

export const PremiumColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, onClose }) => {
    // Helper to convert hex to rgb
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    // Helper to convert rgb to hex
    const rgbToHex = (r: number, g: number, b: number) => {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };

    // Helper to convert rgb to hsv
    const rgbToHsv = (r: number, g: number, b: number) => {
        let r_norm = r / 255, g_norm = g / 255, b_norm = b / 255;
        let max = Math.max(r_norm, g_norm, b_norm), min = Math.min(r_norm, g_norm, b_norm);
        let h = 0, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max !== min) {
            switch (max) {
                case r_norm: h = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
                case g_norm: h = (b_norm - r_norm) / d + 2; break;
                case b_norm: h = (r_norm - g_norm) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    };

    // Helper to convert hsv to rgb
    const hsvToRgb = (h: number, s: number, v: number) => {
        let r = 0, g = 0, b = 0;
        let i = Math.floor(h / 60);
        let f = h / 60 - i;
        let p = v * (1 - s / 100) / 100;
        let q = v * (1 - f * s / 100) / 100;
        let t = v * (1 - (1 - f) * s / 100) / 100;
        v /= 100;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    };

    const initialRgb = hexToRgb(color);
    const initialHsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b);

    const [hsv, setHsv] = useState(initialHsv);
    const [rgb, setRgb] = useState(initialRgb);

    const svRef = useRef<HTMLDivElement>(null);
    const hueRef = useRef<HTMLDivElement>(null);

    const hueColor = useMemo(() => {
        const rgb = hsvToRgb(hsv.h, 100, 100);
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }, [hsv.h]);

    const handleSvMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!svRef.current) return;
        const rect = svRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        let s = ((clientX - rect.left) / rect.width) * 100;
        let v = (1 - (clientY - rect.top) / rect.height) * 100;

        s = Math.max(0, Math.min(100, s));
        v = Math.max(0, Math.min(100, v));

        const newHsv = { ...hsv, s, v };
        setHsv(newHsv);
        const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
        setRgb(newRgb);
        onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    };

    const handleHueMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!hueRef.current) return;
        const rect = hueRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

        let h = ((clientX - rect.left) / rect.width) * 360;
        h = Math.max(0, Math.min(360, h));

        const newHsv = { ...hsv, h };
        setHsv(newHsv);
        const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
        setRgb(newRgb);
        onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    };

    const handleRgbInputChange = (key: 'r' | 'g' | 'b', val: string) => {
        let num = parseInt(val) || 0;
        num = Math.max(0, Math.min(255, num));
        const newRgb = { ...rgb, [key]: num };
        setRgb(newRgb);
        const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
        setHsv(newHsv);
        onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    };

    return (
        <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            width: '280px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none'
        }}>
            {/* SV Square */}
            <div
                ref={svRef}
                onMouseDown={(e) => {
                    handleSvMove(e);
                    const moveHandler = (me: MouseEvent) => handleSvMove(me as any);
                    const upHandler = () => {
                        window.removeEventListener('mousemove', moveHandler);
                        window.removeEventListener('mouseup', upHandler);
                    };
                    window.addEventListener('mousemove', moveHandler);
                    window.addEventListener('mouseup', upHandler);
                }}
                onTouchStart={(e) => {
                    handleSvMove(e);
                    const moveHandler = (te: TouchEvent) => handleSvMove(te as any);
                    const upHandler = () => {
                        window.removeEventListener('touchmove', moveHandler);
                        window.removeEventListener('touchend', upHandler);
                    };
                    window.addEventListener('touchmove', moveHandler);
                    window.addEventListener('touchend', upHandler);
                }}
                style={{
                    height: '180px',
                    width: '100%',
                    position: 'relative',
                    background: hueColor,
                    cursor: 'crosshair'
                }}
            >
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, #fff, transparent)'
                }} />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, #000, transparent)'
                }} />

                {/* SV Cursor */}
                <div style={{
                    position: 'absolute',
                    left: `${hsv.s}%`,
                    top: `${100 - hsv.v}%`,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    backgroundColor: color
                }} />
            </div>

            {/* Controls Section */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Pipette size={20} color="#333" style={{ cursor: 'pointer' }} />

                    {/* Current Color Circle */}
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)'
                    }} />

                    {/* Hue Slider */}
                    <div
                        ref={hueRef}
                        onMouseDown={(e) => {
                            handleHueMove(e);
                            const moveHandler = (me: MouseEvent) => handleHueMove(me as any);
                            const upHandler = () => {
                                window.removeEventListener('mousemove', moveHandler);
                                window.removeEventListener('mouseup', upHandler);
                            };
                            window.addEventListener('mousemove', moveHandler);
                            window.addEventListener('mouseup', upHandler);
                        }}
                        onTouchStart={(e) => {
                            handleHueMove(e);
                            const moveHandler = (te: TouchEvent) => handleHueMove(te as any);
                            const upHandler = () => {
                                window.removeEventListener('touchmove', moveHandler);
                                window.removeEventListener('touchend', upHandler);
                            };
                            window.addEventListener('touchmove', moveHandler);
                            window.addEventListener('touchend', upHandler);
                        }}
                        style={{
                            flex: 1,
                            height: '12px',
                            borderRadius: '6px',
                            background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                            position: 'relative',
                            cursor: 'pointer'
                        }}
                    >
                        {/* Hue Cursor */}
                        <div style={{
                            position: 'absolute',
                            left: `${(hsv.h / 360) * 100}%`,
                            top: '50%',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'white',
                            border: '2px solid red', // Hue indicator color
                            borderColor: hueColor,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none'
                        }} />
                    </div>
                </div>

                {/* RGB Inputs */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="text"
                            value={rgb.r}
                            onChange={(e) => handleRgbInputChange('r', e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center', fontSize: '1rem', color: '#333' }}
                        />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>R</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="text"
                            value={rgb.g}
                            onChange={(e) => handleRgbInputChange('g', e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center', fontSize: '1rem', color: '#333' }}
                        />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>G</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="text"
                            value={rgb.b}
                            onChange={(e) => handleRgbInputChange('b', e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center', fontSize: '1rem', color: '#333' }}
                        />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>B</span>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        padding: '10px',
                        background: '#333',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '0.5rem'
                    }}
                >
                    Done
                </button>
            </div>
        </div>
    );
};
