# TruNotesv2 - Comprehensive Feature Specification

TruNotesv2 is a next-generation, privacy-first productivity suite that seamlessly blends powerful note-taking, task management, and personal organization with a cutting-edge native AI engine. Designed for speed, security, and offline capability, it empowers users to manage their life and work without compromising data privacy.

---

## 1. Core User Experience & Interface
The application is built with a "Design-First" philosophy, featuring a stunning, responsive interface that adapts to user preferences.

*   **Dynamic Visual Themes:**
    *   **Glassmorphism UI:** Modern, translucent elements with background blur (backdrop-filter) for a premium feel.
    *   **Adaptive Dark/Light Mode:** Automatically switches based on system settings or user preference, with carefully tuned contrast ratios.
    *   **Custom Backgrounds:** Users can set personal images as the app background, with adjustable darkness and blur levels to ensure text readability.
*   **Fluid Navigation:**
    *   **Gesture Control:** Swipe gestures for navigating between views (Dashboard, Journal, Tasks).
    *   **Smooth Transitions:** Powered by Framer Motion, every interaction—from opening a note to checking a task—is animated for tactile feedback.
*   **Responsive Dashboard:** A centralized hub providing an "At a Glance" view of recent notes, pending tasks, and quick actions.

## 2. Advanced Note-Taking Integration
At its heart, TruNotesv2 is a robust editor capable of handling everything from quick thoughts to complex documentation.

*   **Rich Text Editor:**
    *   Full support for **Markdown** styling (bold, italic, lists, headers).
    *   **HTML Support:** Ability to render complex layouts and embedded content.
    *   **Multimedia:** Insert images, links, and code blocks directly into notes.
*   **Scribble & Canvas Mode:**
    *   **Freehand Drawing:** A dedicated canvas for handwriting, sketching, and diagramming.
    *   **Infinite Canvas:** (Planned) or large scrollable area for expansive brainstorming.
    *   **Pen Tools:** Various brush types, colors, and heavy optimization for touch responsiveness.
*   **Organization & Search:**
    *   **Favorites & Pinning:** Keep important notes accessible at the top of the list.
    *   **Global Search:** Instant real-time filtering of notes by title and content.
    *   **Intelligent Sorting:** Sort by date created, last modified, or alphabetical order.

## 3. Task Management & Planning
Going beyond simple checkboxes, the task system is designed for daily execution.

*   **Smart Todo Lists:**
    *   **Quick Add:** Rapidly capture tasks with a simplified input interface.
    *   **Strikethrough Completion:** Satisfying visual feedback when tasks are marked done.
*   **"Tomorrow" View:** A dedicated planning interface to lineup tasks for the next day, helping users end their current day with clarity.
*   **Recurring Tasks:** (Planned) Capability to set tasks that repeat daily, weekly, or monthly.

## 4. Time Management & Calendar
Integrated tools to help users visualize their time and schedule.

*   **Interactive Calendar:**
    *   **Monthly & Weekly Views:** Visualize workload and note distribution across the calendar.
    *   **Event Integration:** See tasks and notes pinned to specific dates.
*   **Hourly Log System:**
    *   **Day Timeline:** A vertical timeline view to log activities or plan the day hour-by-hour.
    *   **Time Blocking:** dedicate specific chunks of time to deep work.
*   **Focus Timer:**
    *   **Pomodoro-style Timer:** Built-in countdown timer to structure work sessions (e.g., 25m work, 5m break).
    *   **Visual Progress:** Circular progress indicators to keep users on track.

## 5. Native Native AI Engine (Offline & Private)
The crown jewel of TruNotesv2 is its fully offline, privacy-centric AI capabilities. Unlike cloud-based assistants, this runs accurately on-device.

*   **Local LLM Execution:**
    *   **Zero Data Egress:** AI models run 100% locally on the device (CPU/GPU) using a custom Native C++ Bridge (JNI). No data is ever sent to external servers for processing.
    *   **Model Agnostic:** Supports industry-standard **GGUF** model formats (e.g., Gemma, Llama 3, Phi-3, Mistral). Users can swap models based on their device performance.
*   **Context-Aware Chat:**
    *   **RAG (Retrieval-Augmented Generation):** The AI can "read" your recent notes, tasks, and calendar events to provide contextually relevant answers.
    *   **"Grounding":** Answers are grounded in your personal data (e.g., "What did I do yesterday?" will actually check your yesterday's logs).
*   **Autonomous Actions:**
    *   **Natural Language Command:** Tell the AI to "Remind me to buy milk" or "Create a note about the meeting," and it will execute the actual app function to create the data.
*   **Model Management Library:**
    *   **Download Manager:** Browse and download optimized models directly within the app.
    *   **Performance Metrics:** Real-time tokens-per-second (TPS) tracking to monitor AI speed.

## 6. Security & Synchronization
Ensuring data is safe and available across devices.

*   **Biometric Security:**
    *   **App Lock:** Secure the entire application with Fingerprint or Face ID authentication.
    *   **Fallback Security:** PIN/Password protection if biometrics fail.
    *   **"Skip Login" Option:** User-configurable convenience for trusted environments.
*   **Cloud Synchronization:**
    *   **Google Drive Integration:** Seamlessly sync encrypted data to the user's personal Google Drive.
    *   **Multi-Device Sync:** Keep notes and tasks updated between Android, Desktop, and Web versions.
    *   **Conflict Resolution:** Intelligent handling of data versions to prevent data loss during sync.
*   **Offline First:** The app is fully functional without internet. Changes queue up and sync automatically when connectivity is restored.

## 7. Technical Foundation
*   **Cross-Platform Core:** Built with **React** and **Vite** for rapid development and high performance.
*   **Native Power:** Uses **Capacitor** for Android/iOS native access and **Electron** for Desktop integration.
*   **Local Database:** Utilizes **IndexedDB** for high-performance, structured local storage of thousands of notes.
