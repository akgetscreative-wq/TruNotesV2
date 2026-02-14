#!/bin/bash

# TruNotes AI Setup Script
# This script sets up llama.cpp as a Git submodule for the AI feature

echo "🤖 TruNotes AI Setup"
echo "===================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the TruNotes project root"
    exit 1
fi

echo "📦 Adding llama.cpp as a Git submodule..."
git submodule add https://github.com/ggerganov/llama.cpp android/llama.cpp

echo "📥 Initializing submodule..."
git submodule update --init --recursive

echo "✏️  Updating CMakeLists.txt to point to llama.cpp..."
# Update the CMakeLists.txt path
sed -i 's|add_subdirectory(../../../../../../ build-llama)|add_subdirectory(../../llama.cpp llama-build)|g' android/app/src/main/cpp/CMakeLists.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. cd android"
echo "2. ./gradlew assembleDebug"
echo "3. Check for successful native library build"
echo ""
echo "If you prefer using npm package instead:"
echo "  npm install llama.rn"
echo "  (Then update the implementation to use llama.rn)"
