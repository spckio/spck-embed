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
    'react': 'react@16.4.2/umd/react.production.min.js',
    'react-dom': 'react-dom@16.4.2/umd/react-dom.production.min.js'
  },
  transpiler: 'plugin-babel'
});

SystemJS.import('./app.jsx')
  .catch(console.error.bind(console));