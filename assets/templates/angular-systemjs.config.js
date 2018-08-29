var angularVersion = '@6.0.7';

System.config({
  transpiler: 'ts',
  typescriptOptions: {
    emitDecoratorMetadata: true,
    experimentalDecorators: true
  },
  packages: {
    ".": {
      main: './main.ts',
      defaultExtension: 'ts'
    },
    rxjs: {
        main: 'index.js',
        defaultExtension: 'js'
    },
    "rxjs/operators": {
        main: 'index.js',
        defaultExtension: 'js'
    }
  },
  meta: {
    'typescript': { 'exports': 'ts' }
  },
  paths: {
    'npm:': 'https://unpkg.com/'
  },
  map: {
    '@angular/core':                     'npm:@angular/core' + angularVersion + '/bundles/core.umd.js',
    '@angular/common':                   'npm:@angular/common' + angularVersion + '/bundles/common.umd.js',
    '@angular/compiler':                 'npm:@angular/compiler' + angularVersion + '/bundles/compiler.umd.js',
    '@angular/forms':                    'npm:@angular/forms' + angularVersion + '/bundles/forms.umd.js',
    '@angular/http':                     'npm:@angular/http' + angularVersion + '/bundles/http.umd.js',
    '@angular/router':                   'npm:@angular/router' + angularVersion + '/bundles/router.umd.js',
    '@angular/platform-browser':         'npm:@angular/platform-browser' + angularVersion + '/bundles/platform-browser.umd.js',
    '@angular/platform-browser-dynamic': 'npm:@angular/platform-browser-dynamic' + angularVersion + '/bundles/platform-browser-dynamic.umd.js',
    'rxjs':                              'npm:rxjs@6.2.1',
    'rxjs-compat':                       'npm:rxjs-compat@6.2.1',
    'ts':                                'npm:plugin-typescript@8.0.0/lib/plugin.js',
    'typescript':                        'npm:typescript@2.9.2/lib/typescript.js'
  }
});

System.import('./main')
  .catch(console.error.bind(console));
