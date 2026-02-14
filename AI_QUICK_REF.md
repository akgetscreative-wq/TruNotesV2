# 🚀 TruNotes AI - Quick Reference

## Build Commands

```bash
# Open in Android Studio
# File → Open → d:\TruNotesv2\android

# Build from command line (requires Java setup)
cd d:\TruNotesv2\android
.\gradlew.bat assembleDebug

# Run on device
npx cap run android

# Check logs
adb logcat | grep -E "AIBridge|llama"
```

## File Locations

| What | Where |
|------|-------|
| UI Component | `src/features/AI/AIView.tsx` |
| TS Plugin | `src/features/AI/AIBridge.ts` |
| Java Plugin | `android/app/src/main/java/com/trunotes/v2/plugins/AIBridge.java` |
| C++ Bridge | `android/app/src/main/cpp/llama-android.cpp` |
| llama.cpp | `android/llama.cpp/` (submodule) |
| Build Config | `android/app/build.gradle` |
| CMake | `android/app/src/main/cpp/CMakeLists.txt` |

## Architecture

```
React Native (TSX)
    ↓
AIBridge.ts (Capacitor Plugin)
    ↓
AIBridge.java (Android)
    ↓
llama-android.cpp (JNI)
    ↓
llama.cpp (C++ Engine)
```

## Key Features

- ✅ Memory-mapped model loading (use_mmap = true)
- ✅ Mobile-optimized threading (4-6 threads)
- ✅ Background downloads (DownloadManager)
- ✅ Autoload persistence (SharedPreferences)
- ✅ Real-time token streaming (notifyListeners)

## Test Models

| Model | Size | URL |
|-------|------|-----|
| TinyLlama 1.1B | ~600MB | [HuggingFace](https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF) |
| Phi-2 | ~1.6GB | [HuggingFace](https://huggingface.co/TheBloke/phi-2-GGUF) |

**Format**: Use Q4_K_M quantization

## Common Issues

| Problem | Solution |
|---------|----------|
| NDK not found | Install via Android Studio SDK Manager |
| CMake error | Install CMake 3.22.1+ via SDK Manager |
| Library not found | Check `libllama-android.so` in build outputs |
| Build fails | Clean project, invalidate caches, rebuild |

## Documentation

- **FINAL_SETUP.md** - Complete setup guide
- **AI_IMPLEMENTATION.md** - Technical details
- **BUILD_GUIDE.md** - Build instructions
- **AI_STATUS.md** - Implementation status

---

**Status**: 95% Complete - Ready for Android Studio build  
**Next Step**: Build in Android Studio → Test on device
