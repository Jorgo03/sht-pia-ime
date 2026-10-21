// app.json holds the whole config; this file only adjusts it per command and
// per environment.
//
// `ios.icon` is an object (light, dark and tinted icons for iOS 18+). Native
// builds (prebuild, EAS Build, `expo run:ios`) turn that into the three icons.
// But Expo's dev server and `expo export` resolve every image in the manifest
// to a URL, and an object makes that step throw ("The 'paths[1]' argument must
// be of type string"): it then gives up on ALL of them, so Expo Go gets no
// iconUrl and keeps showing whatever icon it cached earlier. For those two
// commands, serve the light icon as a plain path instead.
//
// Android maps (docs/LAUNCH_TASKS.md F9): react-native-maps draws Google Maps
// on Android, which needs an API key in the Android manifest or the map stays
// blank in a release build. The key comes from GOOGLE_MAPS_ANDROID_API_KEY
// (an EAS environment variable, never committed) and is written to
// android.config.googleMaps.apiKey, which Expo's prebuild turns into the
// manifest entry. Without the variable nothing is added: Expo Go and iOS
// (Apple Maps) do not need it. The key ships inside the app, so it must be
// restricted in Google Cloud to this package and the signing certificates.
const COMMANDS_THAT_SERVE_A_MANIFEST = ['start', 'export'];

function withAndroidMapsKey(config, key) {
  if (!key) return config;
  const android = config.android ?? {};
  return {
    ...config,
    android: { ...android, config: { ...android.config, googleMaps: { apiKey: key } } },
  };
}

module.exports = ({ config }) => {
  const withKey = withAndroidMapsKey(config, (process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '').trim());
  const command = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
  const icon = withKey.ios?.icon;
  if (!COMMANDS_THAT_SERVE_A_MANIFEST.includes(command) || !icon || typeof icon !== 'object') {
    return withKey;
  }
  return { ...withKey, ios: { ...withKey.ios, icon: icon.light } };
};
