const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      popup: './src/popup/index.tsx',
      background: './src/background/service-worker.ts',
      content: './src/content/video-monitor.ts',
      history: './src/history/index.tsx'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/popup.html',
        filename: 'popup.html',
        chunks: ['popup']
      }),
      new HtmlWebpackPlugin({
        template: './public/history.html',
        filename: 'history.html',
        chunks: ['history']
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/manifest.json', to: 'manifest.json' },
          { from: 'public/icon128.png', to: 'icon128.png' },
          { from: 'public/icon.svg', to: 'icon.svg' },
          { from: 'public/styles.css', to: 'styles.css' }
        ]
      })
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    }
  };
}; 