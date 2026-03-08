name: Build Android APK

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      # ── 1. Checkout ────────────────────────────────────────────────────────
      - name: Checkout repository
        uses: actions/checkout@v4

      # ── 2. Setup Java ──────────────────────────────────────────────────────
      - name: Set up Java 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      # ── 3. Setup Node.js ───────────────────────────────────────────────────
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # ── 4. Install dependencies ────────────────────────────────────────────
      - name: Install dependencies
        run: npm install

      # ── 5. Build Vite app ─────────────────────────────────────────────────
      - name: Build web app
        run: npm run build
        env:
          VITE_BASE_URL: /
          VITE_NOTIFICATION_SERVER_URL: ${{ secrets.VITE_NOTIFICATION_SERVER_URL }}
          VITE_WEBHOOK_SECRET: ${{ secrets.VITE_WEBHOOK_SECRET }}

      # ── 6. Add Android platform ───────────────────────────────────────────
      - name: Add Android platform
        run: npx cap add android

      # ── 7. Inject google-services.json ────────────────────────────────────
      - name: Inject google-services.json
        run: |
          echo '${{ secrets.GOOGLE_SERVICES_JSON }}' > android/app/google-services.json
          echo "✅ google-services.json injected"

      # ── 8. Inject app icons ───────────────────────────────────────────────
      - name: Inject app icons
        run: |
          cp -r android-resources/res/mipmap-mdpi/*      android/app/src/main/res/mipmap-mdpi/
          cp -r android-resources/res/mipmap-hdpi/*      android/app/src/main/res/mipmap-hdpi/
          cp -r android-resources/res/mipmap-xhdpi/*     android/app/src/main/res/mipmap-xhdpi/
          cp -r android-resources/res/mipmap-xxhdpi/*    android/app/src/main/res/mipmap-xxhdpi/
          cp -r android-resources/res/mipmap-xxxhdpi/*   android/app/src/main/res/mipmap-xxxhdpi/
          cp -r android-resources/res/mipmap-anydpi-v26/* android/app/src/main/res/mipmap-anydpi-v26/
          echo "✅ Icons injected"

      # ── 9. Inject splash screen ───────────────────────────────────────────
      - name: Inject splash screen
        run: |
          mkdir -p android/app/src/main/res/drawable
          cp android-resources/res/drawable/splash.png android/app/src/main/res/drawable/splash.png
          echo "✅ Splash screen injected"

      # ── 10. Sync Capacitor ────────────────────────────────────────────────
      - name: Sync Capacitor
        run: npx cap sync android

      # ── 11. Decode keystore ───────────────────────────────────────────────
      - name: Decode keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/tg-admin-release.keystore
          echo "✅ Keystore decoded"

      # ── 12. Make Gradle wrapper executable ───────────────────────────────
      - name: Make gradlew executable
        run: chmod +x android/gradlew

      # ── 13. Build release APK ─────────────────────────────────────────────
      - name: Build release APK
        working-directory: android
        run: ./gradlew assembleRelease --no-daemon
        env:
          KEYSTORE_PATH: tg-admin-release.keystore
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}

      # ── 14. Sign APK ──────────────────────────────────────────────────────
      - name: Sign APK
        run: |
          $JAVA_HOME/bin/jarsigner \
            -verbose \
            -sigalg SHA256withRSA \
            -digestalg SHA-256 \
            -keystore android/app/tg-admin-release.keystore \
            -storepass "${{ secrets.KEYSTORE_PASSWORD }}" \
            -keypass "${{ secrets.KEY_PASSWORD }}" \
            android/app/build/outputs/apk/release/app-release-unsigned.apk \
            "${{ secrets.KEY_ALIAS }}"
          echo "✅ APK signed"

      # ── 15. Align APK ─────────────────────────────────────────────────────
      - name: Zipalign APK
        run: |
          ${ANDROID_HOME}/build-tools/$(ls ${ANDROID_HOME}/build-tools | tail -1)/zipalign \
            -v 4 \
            android/app/build/outputs/apk/release/app-release-unsigned.apk \
            android/app/build/outputs/apk/release/tg-admin-release.apk
          echo "✅ APK aligned"

      # ── 16. Upload APK ────────────────────────────────────────────────────
      - name: Upload release APK
        uses: actions/upload-artifact@v4
        with:
          name: tg-admin-release-${{ github.run_number }}
          path: android/app/build/outputs/apk/release/tg-admin-release.apk
          retention-days: 30

      # ── 17. Print APK info ────────────────────────────────────────────────
      - name: Print APK info
        run: |
          APK=android/app/build/outputs/apk/release/tg-admin-release.apk
          echo "✅ Release APK built and signed!"
          echo "📦 Size: $(du -sh $APK | cut -f1)"
          echo "📥 Download from Actions → this run → Artifacts"
