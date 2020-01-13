# Spck-Embed

[Spck Editor](https://spck.io) is an embeddable online code editor, optimized for the web and building web projects. This library builds is a wrapper around the `iframe` messaging interface provided by the editor and allows you to control the editor for your needs.

Use cases for this library include:
- Embedding editable demos in your website
- Creating edtor tools (i.e. minifiers, beautifiers, formatters, source-mapping, etc.)
- Creating interactive tutorials

*If you like this project please leave a star. Your support is greatly appreciated.*

## Getting Started

You have two options to install the library:
#### 1. Install with [bower](http://bower.io):
```bower install spck-embed```

#### 2. Install with [npm](https://www.npmjs.com):
```npm install spck-embed```

#### 3. Load the library directly from the web:
```<script src="https://embed.spck.io/embed/spck-embed.min.js"></script>```

## Usage

#### 1. Create an `iframe` element:

```html
<!--Vanilla editor, no files, no preview-->
<iframe id="editor" src="https://embed.spck.io/" frameBorder="0" width="600" height="360"></iframe>
<!--Load library-->
<script src="https://embed.spck.io/embed/spck-embed.min.js"></script>
```

```html
<!--With files, but no preview-->
<iframe id="editor" src="https://embed.spck.io/?files=1" frameBorder="0" width="600" height="360"></iframe>
<!--Load library-->
<script src="https://embed.spck.io/embed/spck-embed.min.js"></script>
```

```html
<!--With files, and preview-->
<iframe id="editor" src="https://embed.spck.io/?files=1&preview=1" frameBorder="0" width="600" height="360"></iframe>
<!--Load library-->
<script src="https://embed.spck.io/embed/spck-embed.min.js"></script>
```

### 2. Connect. You have the following options:

#### Browser Global

```javascript
// Connect by passing an HTML id to the iframe
var editor = new SpckEditor('#editor');
// Or by passing an HTML element
var editor = new SpckEditor(document.getElementById('editor'));
// Or with any query selector
var editor = new SpckEditor(document.getElementById('iframe'));

// Connect and handle with a callback
editor.connect(function (connected) {
  // Number of tries it took to connect
  console.log(connected.tries)

  editor.send({
    project: 'Simple Project',  // Project name
    open: 'index.js',  // Open file
    files: [  // Create following files
      {path: 'index.js', text: 'console.log("entry point")'}
    ]
  }, function () {
    // Success
  }, function () {
    // Failure
  })
}, function () {
  // Handle connection failure
  console.log('connection failed')
}, {
  maxTries: 20,  // Maximum number of attempts to wait for iframe to load
  interval: 500  // Interval between attempts
});

// Or handle with a promise
editor.connect()
  .then(() => {
    // Control the editor
    return editor.send({
      project: 'Simple Project',  // Project name
      open: 'index.js',  // Open file
      files: [  // Create following files
        {path: 'index.js', text: 'console.log("entry point")'}
      ]
    })
  })
  .catch(() => console.log('failure'))

// Or handle using async/await
await editor.connect()
// Control the editor
await editor.send({
  project: 'Simple Project',  // Project name
  open: 'index.js',  // Open file
  files: [  // Create following files
    {path: 'index.js', text: 'console.log("entry point")'}
  ]
})
```

#### AMD
```javascript
define(['SpckEditor'] , function (SpckEditor) {
  var editor = new SpckEditor('#editor');
  // Do stuff with editor here
});
```

#### CommonJS
```javascript
var SpckEditor = require('SpckEditor');
var editor = new SpckEditor('#editor');
// Do stuff with editor here
```

#### ES2015 Modules (after npm install)
```javascript
import {SpckEditor} from 'spck-embed';

var editor = new SpckEditor('#editor');
// Do stuff with editor here
```


## API Reference

### URL

Certain cosmetic features can be set by the iframe's `src` url by using query parameters.

|URL Parameter|Optional|Description|
|:--- |:--- |:--- |
|`files`|Yes|If present, will display a side menu for file management.|
|`preview`|Yes|If present, will display a Run button for previewing code output.|
|`theme`|Yes|Changes the editor theme. Options: chrome, xcode, ayu-light, dracula, monokai, ayu-mirage.|
|`project`|Yes|The name of the project to create.|
#### Example

```html
<iframe src="https://embed.spck.io/?files=1&preview=1&theme=dracula"></iframe>
```

### constructor

```javascript
new SpckEditor(element, origin)
```

|Parameter|Optional|Description|
|:--- |:--- |:--- |
|`element`|No|Either a CSS selector string or the `iframe` HTMLElement to connect to.|
|`origin`|Yes|String to specify another domain origin for the editor. (*Defaults to `https://embed.spck.io`*)|

### Methods

#### connect
```javascript
connect(opts: {
  maxTries: Number,
  interval: Number
}): Promise
```

|Parameter|Optional|Description|
|:--- |:--- |:--- |
|`opts.maxTries`|Yes|Maximum attempts to establish connection with iframe. (*default: 20*)|
|`opts.interval`|Yes|Time to wait between attempts to connect. (*default: 500ms*)|

#### send
```javascript
send(msg: {
  project: String,
  clearProjects: Boolean | [String]
  files: [{path: String, text: String?, url: String?}],
  appendFiles: Boolean,
  open: String,
  editor: {
    mode: String,
    text: String,
    fontSize: String,
    tabSize: Number,
    position: {row: Number, column: Number},
    gutter: Boolean
  }
}): Promise
```

|Parameter|Optional|Description|
|:--- |:--- |:--- |
|`msg.project`|Yes|Specifies the project name, projects are namespaced by domain. The same project name from different domains will not overwrite each other.|
|`msg.clearProjects`|Yes|If true, clear all projects in the domain; or if an array of project names, then delete the list of projects.|
|`msg.files`|Yes|List of files to create in the project, if `url` is specified instead of `text`, the contents will be fetched instead.|
|`msg.appendFiles`|Yes|Keep existing project files, append/overwrite the files.|
|`msg.open`|Yes|Opens this file in the project.|
|`msg.editor`|Yes|Configures the editor window directly.|

#### Example

```javascript
editor.send({
  files: [
    {
      path: 'src/index.html',
      text: '...'
    }, {
      path: 'src/index.js',
      text: '...'
    }
  ],
  // Keep existing files in the project, append/overwrite new files
  appendFiles: false,
  // Open this file
  open: 'index.js',
  // Create a project
  project: 'ProjectA',
  editor: {
    // Sets the language mode
    mode: 'javascript' // 'typescript, javascript, css, less, scss, html, etc.',
    // Sets the editor current text
    text: '...',
    // Sets the editor font size
    fontSize: '12px',
    // Sets the editor tab size
    tabSize: 2,
    // Show line numbers or not
    gutter: true
  }
})
```

#### on
```javascript
editor.on(handlers: {
  textChange: Function,
  positionChange: Function,
  selectionChange: Function,
  fileOpen: Function,
  projectOpen: Function,
  projectClose: Function,
  blur: Function,
  focus: Function
})
```

|Parameter|Optional|Description|
|:--- |:--- |:--- |
|`handlers.textChange`|Yes|Detect whenever the editor text is changed.|
|`handlers.positionChange`|Yes|Detect when the cursor position is changed.|
|`handlers.selectionChange`|Yes|Detect when the text selection is changed.|
|`handlers.fileOpen`|Yes|Detect when a new file is opened.|
|`handlers.projectOpen`|Yes|Detect when a project is opened.|
|`handlers.projectClose`|Yes|Detect when a project is closed.|
|`handlers.blur`|Yes|Detect when editor blurs focus.|
|`handlers.focus`|Yes|Detect when editor focuses.|

#### getMode
```javascript
getMode(): Promise<String>
```

#### getPosition
```javascript
getPosition(): Promise<{row: Number, coluumn: Number}>
```

#### getTabSize
```javascript
getTabSize(): Promise<Number>
```

#### getText
```javascript
getText(): Promise<String>
```

#### getTheme
```javascript
getTheme(): Promise<String>
```
