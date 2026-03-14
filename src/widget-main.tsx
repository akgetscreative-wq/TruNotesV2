import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesktopWidget } from './features/DesktopWidget';
import './widget.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <DesktopWidget />
    </React.StrictMode>
);
