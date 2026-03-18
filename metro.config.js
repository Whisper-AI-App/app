const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add .bin extension for bundled model assets (whisper-base GGUF)
config.resolver.assetExts.push("bin");

module.exports = config;
