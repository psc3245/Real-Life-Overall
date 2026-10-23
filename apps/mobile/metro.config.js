// The web app uses a newer React than React Native allows, so npm keeps this app's React in
// apps/mobile/node_modules while react-native is hoisted to the root. Pin every `react` import to
// this app's copy so the bundle has exactly one React.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const reactDir = path.dirname(require.resolve("react/package.json", { paths: [__dirname] }));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return context.resolveRequest(
      context,
      path.join(reactDir, moduleName.slice("react".length)),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
