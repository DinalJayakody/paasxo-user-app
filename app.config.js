// Extends app.json. Only adds the Google Maps key for Android, read from the
// environment at build/prebuild time so it is never committed:
//   GOOGLE_MAPS_ANDROID_API_KEY=... npx expo run:android
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } },
    },
  };
};
