/* Entrada exclusiva de la APK. esbuild empaqueta el puente nativo durante la compilación. */
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
window.RAIET_NATIVE = Object.freeze({
  enabled: Capacitor.isNativePlatform(),
  biometric: NativeBiometric,
  app: App,
  browser: Browser
});
