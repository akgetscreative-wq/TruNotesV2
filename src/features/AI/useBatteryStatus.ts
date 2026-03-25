import { useEffect, useState } from 'react';

interface BatteryManagerLike extends EventTarget {
    charging: boolean;
}

declare global {
    interface Navigator {
        getBattery?: () => Promise<BatteryManagerLike>;
    }
}

export function useBatteryStatus() {
    const [isCharging, setIsCharging] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        let batteryRef: BatteryManagerLike | null = null;
        let mounted = true;

        const handleChange = () => {
            if (mounted && batteryRef) {
                setIsCharging(!!batteryRef.charging);
            }
        };

        if (!navigator.getBattery) return () => undefined;

        navigator.getBattery().then((battery) => {
            if (!mounted) return;
            batteryRef = battery;
            setIsSupported(true);
            setIsCharging(!!battery.charging);
            battery.addEventListener('chargingchange', handleChange);
        }).catch(() => {
            if (mounted) {
                setIsSupported(false);
            }
        });

        return () => {
            mounted = false;
            batteryRef?.removeEventListener('chargingchange', handleChange);
        };
    }, []);

    return {
        isCharging,
        isSupported,
    };
}
