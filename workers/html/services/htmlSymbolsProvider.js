!function(e){if("object"==typeof module&&"object"==typeof module.exports){var t=e(require,exports);void 0!==t&&(module.exports=t)}else"function"==typeof define&&define.amd&&define(["require","exports","vscode-languageserver-types"],e)}(function(e,t){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var c=e("vscode-languageserver-types");t.findDocumentSymbols=function(t,e){var o=[];return e.roots.forEach(function(e){!function t(o,e,n,r){var i=function(e){var t=e.tag;if(e.attributes){var o=e.attributes.id,n=e.attributes.class;o&&(t+="#"+o.replace(/[\"\']/g,"")),n&&(t+=n.replace(/[\"\']/g,"").split(/\s+/).map(function(e){return"."+e}).join(""))}return t}(e),a=c.Location.create(o.uri,c.Range.create(o.positionAt(e.start),o.positionAt(e.end))),u={name:i,location:a,containerName:n,kind:c.SymbolKind.Field};r.push(u),e.children.forEach(function(e){t(o,e,i,r)})}(t,e,"",o)}),o}});