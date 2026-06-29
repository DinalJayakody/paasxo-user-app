const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// On web, alias react-native-maps to a no-op stub so the web bundle doesn't
// try to import native-only modules (codegenNativeCommands, etc.).
const webMapsStub = path.resolve(__dirname, 'src/mocks/react-native-maps-web.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { filePath: webMapsStub, type: 'sourceFile' };
  }
  // Fall through to the default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
