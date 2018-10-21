SystemJS.config({
  baseURL:'https://unpkg.com/',
  defaultExtension: true,
  meta: {
    '*.jsx': {
      'babelOptions': {
        react: true
      }
    }
  },
  map: {
    'plugin-babel': 'systemjs-plugin-babel@latest/plugin-babel.js',
    'systemjs-babel-build': 'systemjs-plugin-babel@latest/systemjs-babel-browser.js',
    'react': 'react@16.4.2/umd/react.development.js',
    'react-dom': 'react-dom@16.4.2/umd/react-dom.development.js',
    'antd': 'antd@3.10.1/dist/antd-with-locales.js'
  },
  transpiler: 'plugin-babel'
});

SystemJS.import('./App.jsx')
  .catch(console.error.bind(console));