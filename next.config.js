module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(mp3)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            publicPath: '/_next/static/audio/', // The path where the audio files will be served
            outputPath: 'static/audio/', // The local directory where the audio files will be stored
            name: '[name].[hash].[ext]',
          },
        },
      ],
    });

    return config;
  },
};
