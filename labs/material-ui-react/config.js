SystemJS.config({
  baseURL:'https://unpkg.com/',
  defaultExtension: 'true',
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
    'prop-types': 'prop-types@15.6/prop-types.js',
    'classnames': 'classnames@2.2.6/index.js',
    '@material-ui/core': '@material-ui/core@3.2.2/umd/material-ui.development.js',
    '@material-ui/icons': '@material-ui/icons@3.0.1/index.js',
  },
  transpiler: 'plugin-babel'
});

SystemJS.import('./App.jsx')
  .catch(console.error.bind(console));