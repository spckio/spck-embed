# Spck-Embed

[Spck Editor](https://spck.io) is an embeddable online code editor, optimized for the web and building web projects. This library is a wrapper around the `iframe` messaging interface provided by the editor and allows you to control the editor for your needs.

Use cases for this library include:
- Embedding editable demos in your website
- Creating editor tools (i.e. minifiers, beautifiers, formatters, source-mapping, etc.)
- Creating interactive tutorials

*If you like this project please leave a star. Your support is greatly appreciated.*

## Getting Started

Install the corrected wrapper from this repository with `npm install /path/to/createjsapp/embed`, or use the script served by the embedded editor.

The registry package `spck-embed@0.2.0` predates these fixes.

Load the library from your deployed embed build:
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
var editor = new SpckEditor('iframe');

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
var {SpckEditor} = require('spck-embed');
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
|`files`|Yes|Enables the files menu when present, unless set to `0`. Hidden by default.|
|`preview`|Yes|Enables preview when present, unless set to `0`. Hidden by default.|
|`theme`|Yes|Changes the editor theme. Options: chrome, xcode, ayu-light, dracula, monokai, ayu-mirage, one-light, one-dark, github-dark.|
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
  open: String | [String],
  editor: {
    mode: String,
    text: String,
    fontSize: String,
    tabSize: Number,
    position: {row: Number, column: Number},
    gutter: Boolean,
    theme: String
  }
}): Promise<{success: true}>
```

`send()` resolves after all requested operations complete and rejects with an `Error` when processing fails. Call `connect()` first. The API supports promises only; callback-style overloads are not supported.

Projects are stored under a separate root for each parent origin, including its scheme and port. Existing projects in the old shared root are not migrated. Project and file paths must remain inside this root.

|Parameter|Optional|Description|
|:--- |:--- |:--- |
|`msg.project`|Yes|Specifies the project name, projects are namespaced by domain. The same project name from different domains will not overwrite each other.|
|`msg.clearProjects`|Yes|If true, clear all projects in the domain; or if an array of project names, then delete the list of projects.|
|`msg.files`|Yes|List of files to create in the project, if `url` is specified instead of `text`, the contents will be fetched instead.|
|`msg.appendFiles`|Yes|Keep existing project files, append/overwrite the files.|
|`msg.open`|Yes|Opens a project-relative file, or an array of files (the first becomes active).|
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
  appendFiles: true,
  // Open this file
  open: 'src/index.js',
  // Create a project
  project: 'ProjectA',
  editor: {
    // Sets the language mode
    mode: 'javascript', // 'typescript, javascript, css, less, scss, html, etc.',
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
|`handlers.textChange`|Yes|Receives `(text, path)` when text changes; `path` is the full internal path or `null` for a blank session.|
|`handlers.positionChange`|Yes|Receives `{row, column}` when the cursor moves. Coordinates are zero-based.|
|`handlers.selectionChange`|Yes|Receives `{selectedText, selectionRanges}`, with ranges containing `start` and `end` positions.|
|`handlers.fileOpen`|Yes|Receives the full internal file path when a file is opened.|
|`handlers.projectOpen`|Yes|Receives the project object, including its `dir`, when a project is opened.|
|`handlers.projectClose`|Yes|Detect when a project is closed.|
|`handlers.blur`|Yes|Detect when editor blurs focus.|
|`handlers.focus`|Yes|Detect when editor focuses.|

#### getMode
```javascript
getMode(): Promise<String>
```

#### getPosition
```javascript
getPosition(): Promise<{row: Number, column: Number}>
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
