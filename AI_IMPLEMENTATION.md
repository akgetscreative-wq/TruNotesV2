# TruNotes AI Feature Implementation

## Overview
This document outlines the AI feature integration into TruNotes, following the PocketPal AI architecture for maximum efficiency and stability on Android.

## ✅ Completed Steps

### 1. UI Integration
- ✅ Created `AIView.tsx` with multi-tab interface (Chat, Models, Settings)
- ✅ Added AI navigation to Sidebar with Brain icon
- ✅ Added AI quick action card to Dashboard
- ✅ Integrated AI view into main App routing

### 2. Native C++ Engine
- ✅ Created `android/app/src/main/cpp/` directory
- ✅ Copied `llama-android.cpp` from llama.cpp Android example
- ✅ Copied `CMakeLists.txt` for native build configuration
- ✅ Configured `build.gradle` with:
  - NDK target architectures: `arm64-v8a`, `x86_64`
  - CMake external native build setup

### 3. Java Bridge (AIBridge.java)
- ✅ Created `AIBridge.java` Capacitor plugin with:
  - `System.loadLibrary("llama")` for native library loading
  - `loadModel()` with mmap and threading parameters
  - `downloadModel()` using Android DownloadManager
  - `generate()` with token streaming via `notifyListeners()`
  - `getLastModelPath()` / `saveLastModelPath()` using SharedPreferences (autoload)

### 4. TypeScript Integration
- ✅ Created `AIBridge.ts` Capacitor plugin wrapper
- ✅ Added event listener for real-time token streaming
- ✅ Plugin registered in `MainActivity.java`

## ⚠️ Known Issues & Next Steps

### Critical: llama.cpp Source Code Required
The current `CMakeLists.txt` references llama.cpp source at:
```cmake
add_subdirectory(../../../../../../ build-llama)
```

**Solutions:**
1. **Option A - Git Submodule** (Recommended for PocketPal approach):
   ```bash
   cd d:\TruNotesv2
   git submodule add https://github.com/ggerganov/llama.cpp
   ```
   Then update CMakeLists.txt:
   ```cmake
   add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../../../../../llama.cpp llama-build)
   ```

2. **Option B - Use llama.rn** (React Native binding):
   ```bash
   npm install llama.rn
   ```
   This provides pre-built binaries but requires different integration.

3. **Option C - Manual Build**:
   - Download llama.cpp source
   - Place in project root or android/
   - Update CMakeLists.txt path accordingly

### Implementation Checklist
- [ ] Choose llama.cpp integration method (A, B, or C above)
- [ ] Connect native methods in AIBridge.java to actual JNI calls
- [ ] Implement JNI bridge methods (C++ ↔ Java)
- [ ] Test model download via DownloadManager
- [ ] Test model loading with mmap enabled
- [ ] Verify memory usage stays stable (no RAM crashes)
- [ ] Test real-time token streaming
- [ ] Implement autoload on app startup
- [ ] Add error handling and recovery

## Architecture Highlights

### Zero-Copy Memory Mapping
```java
boolean useMmap = true;  // Prevents RAM issues by mapping file directly
```

### Threading Configuration
```java
int threads = 4;  // Optimized for mobile (PocketPal uses 4-6)
```

### Real-Time Communication Flow
```
React (UI) → AIBridge.ts → AIBridge.java → C++ Engine
                                              ↓
React (UI) ← Token Events ← notifyListeners ← C++ Callback
```

### Download & Persistence
- **DownloadManager**: Background downloads with progress
- **SharedPreferences**: Store last loaded model path
- **Auto-Load**: On app start, check for previously loaded model

## File Structure
```
d:\TruNotesv2\
├── src\features\AI\
│   ├── AIView.tsx          # Main UI with Chat/Models/Settings
│   └── AIBridge.ts         # TypeScript plugin wrapper
├── android\app\src\main\
│   ├── cpp\
│   │   ├── llama-android.cpp    # C++ JNI implementation
│   │   └── CMakeLists.txt       # CMake build config
│   └── java\com\trunotes\v2\
│       ├── MainActivity.java    # Plugin registration
│       └── plugins\
│           └── AIBridge.java    # Java Capacitor plugin
└── android\app\build.gradle     # NDK & CMake config
```

## Testing on Android

1. **Build the native library**:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

2. **Run on device**:
   ```bash
   npx cap run android
   ```

3. **Check logs for library loading**:
   ```bash
   adb logcat | grep -E "AIBridge|llama"
   ```

## References
- PocketPal AI: Structure inspiration for mobile AI
- llama.cpp: Core inference engine
- llama.rn: React Native bindings (optional)
- Android DownloadManager: Model download handling
- SharedPreferences: Persistence layer

## Notes
- Memory mapping (`use_mmap = true`) is **critical** for avoiding OOM crashes
- Thread count should match device capabilities (typically 4-6 for mobile)
- Models should be in GGUF format
- Recommended model size: < 4GB for mobile devices
