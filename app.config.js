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
//
// Free Apple ID sideloading (SIDELOAD_FREE=1, .github/workflows/ios-sideload.yml):
// a free account cannot sign the push-notification or Sign in with Apple
// capabilities, so Sideloadly refuses an app that asks for them. That build
// leaves out the two plugins that add them. The app already copes: push
// registration reports 'failed', and Apple sign-in shows the usual error.
const COMMANDS_THAT_SERVE_A_MANIFEST = ['start', 'export'];
const PLUGINS_A_FREE_ACCOUNT_CANNOT_SIGN = ['expo-apple-authentication', 'expo-notifications'];

// Expo also applies these packages' plugins on its own because they are
// installed, so leaving them out of the list is not enough: the entitlements
// are deleted again as the very last step.
const ENTITLEMENTS_A_FREE_ACCOUNT_CANNOT_SIGN = [
  'aps-environment',
  'com.apple.developer.applesignin',
  'com.apple.developer.associated-domains',
];

function withoutPaidEntitlements(config) {
  const { withEntitlementsPlist } = require('expo/config-plugins');
  return withEntitlementsPlist(config, (mod) => {
    for (const key of ENTITLEMENTS_A_FREE_ACCOUNT_CANNOT_SIGN) delete mod.modResults[key];
    return mod;
  });
}

function withoutPaidCapabilities(config) {
  const name = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);
  return {
    ...config,
    ios: { ...config.ios, usesAppleSignIn: false, associatedDomains: undefined },
    plugins: [
      ...(config.plugins ?? []).filter((p) => !PLUGINS_A_FREE_ACCOUNT_CANNOT_SIGN.includes(name(p))),
      withoutPaidEntitlements,
    ],
  };
}

function withAndroidMapsKey(config, key) {
  if (!key) return config;
  const android = config.android ?? {};
  return {
    ...config,
    android: { ...android, config: { ...android.config, googleMaps: { apiKey: key } } },
  };
}

// Shared website links open the app (AUDIT-008): iOS universal links and
// Android verified app links for the screens the app answers itself. Off until
// APP_LINK_DOMAIN (e.g. shtepia.al, no scheme) is set for the build; the
// website must then serve the files from scripts/write-app-links.cjs, which
// also holds the same path list.
const APP_LINK_PATHS = ['/property', '/user', '/agent'];

function withAppLinks(config, domain) {
  if (!domain) return config;
  if (!/^[a-z0-9-]+(.[a-z0-9-]+)+$/.test(domain)) {
    throw new Error(`APP_LINK_DOMAIN must be a bare host name such as shtepia.al, not "${domain}"`);
  }
  const hosts = domain.startsWith('www.') ? [domain] : [domain, `www.${domain}`];
  return {
    ...config,
    ios: { ...config.ios, associatedDomains: hosts.map((h) => `applinks:${h}`) },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: hosts.flatMap((host) => APP_LINK_PATHS.map((pathPrefix) => ({ scheme: 'https', host, pathPrefix }))),
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
}

module.exports = ({ config }) => {
  const linked = withAppLinks(config, (process.env.APP_LINK_DOMAIN ?? '').trim().toLowerCase());
  const mapped = withAndroidMapsKey(linked, (process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '').trim());
  const withKey = process.env.SIDELOAD_FREE === '1' ? withoutPaidCapabilities(mapped) : mapped;
  const command = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
  const icon = withKey.ios?.icon;
  if (!COMMANDS_THAT_SERVE_A_MANIFEST.includes(command) || !icon || typeof icon !== 'object') {
    return withKey;
  }
  return { ...withKey, ios: { ...withKey.ios, icon: icon.light } };
};
