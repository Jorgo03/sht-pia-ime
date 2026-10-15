// app.json holds the whole config; this file only adjusts it per command.
//
// `ios.icon` is an object (light, dark and tinted icons for iOS 18+). Native
// builds (prebuild, EAS Build, `expo run:ios`) turn that into the three icons.
// But Expo's dev server and `expo export` resolve every image in the manifest
// to a URL, and an object makes that step throw ("The 'paths[1]' argument must
// be of type string"): it then gives up on ALL of them, so Expo Go gets no
// iconUrl and keeps showing whatever icon it cached earlier. For those two
// commands, serve the light icon as a plain path instead.
const COMMANDS_THAT_SERVE_A_MANIFEST = ['start', 'export'];

module.exports = ({ config }) => {
  const command = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
  const icon = config.ios?.icon;
  if (!COMMANDS_THAT_SERVE_A_MANIFEST.includes(command) || !icon || typeof icon !== 'object') {
    return config;
  }
  return { ...config, ios: { ...config.ios, icon: icon.light } };
};
