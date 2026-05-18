import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export async function getCurrentPosition(opts?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
}): Promise<GeoPosition> {
  if (Capacitor.isNativePlatform()) {
    await Geolocation.requestPermissions();
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: opts?.enableHighAccuracy ?? true,
      timeout: opts?.timeout ?? 10_000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      reject,
      { enableHighAccuracy: opts?.enableHighAccuracy ?? true, timeout: opts?.timeout ?? 10_000 },
    );
  });
}
