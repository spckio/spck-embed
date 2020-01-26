!function(e){if("object"==typeof module&&"object"==typeof module.exports){var s=e(require,exports);void 0!==s&&(module.exports=s)}else"function"==typeof define&&define.amd&&define(["require","exports","./parser/cssParser","./services/cssCompletion","./services/cssHover","./services/cssNavigation","./services/cssCodeActions","./services/cssValidation","./parser/scssParser","./services/scssCompletion","./parser/lessParser","./services/lessCompletion","./services/cssFolding","./languageFacts/facts","./services/cssSelectionRange","./cssLanguageTypes","vscode-languageserver-types"],e)}((function(e,s){"use strict";function n(e){for(var n in e)s.hasOwnProperty(n)||(s[n]=e[n])}Object.defineProperty(s,"__esModule",{value:!0});var i=e("./parser/cssParser"),o=e("./services/cssCompletion"),t=e("./services/cssHover"),r=e("./services/cssNavigation"),c=e("./services/cssCodeActions"),a=e("./services/cssValidation"),d=e("./parser/scssParser"),l=e("./services/scssCompletion"),S=e("./parser/lessParser"),g=e("./services/lessCompletion"),u=e("./services/cssFolding"),v=e("./languageFacts/facts"),C=e("./services/cssSelectionRange");function f(e,s,n,i,o,t){return{configure:function(e){t.configure(e),s.configure(e)},doValidation:t.doValidation.bind(t),parseStylesheet:e.parseStylesheet.bind(e),doComplete:s.doComplete.bind(s),setCompletionParticipants:s.setCompletionParticipants.bind(s),doHover:n.doHover.bind(n),findDefinition:i.findDefinition.bind(i),findReferences:i.findReferences.bind(i),findDocumentHighlights:i.findDocumentHighlights.bind(i),findDocumentLinks:i.findDocumentLinks.bind(i),findDocumentSymbols:i.findDocumentSymbols.bind(i),doCodeActions:o.doCodeActions.bind(o),doCodeActions2:o.doCodeActions2.bind(o),findColorSymbols:function(e,s){return i.findDocumentColors(e,s).map((function(e){return e.range}))},findDocumentColors:i.findDocumentColors.bind(i),getColorPresentations:i.getColorPresentations.bind(i),doRename:i.doRename.bind(i),getFoldingRanges:u.getFoldingRanges,getSelectionRanges:C.getSelectionRanges}}function p(e){e&&e.customDataProviders&&v.cssDataManager.addDataProviders(e.customDataProviders)}n(e("./cssLanguageTypes")),n(e("vscode-languageserver-types")),s.getCSSLanguageService=function(e){return p(e),f(new i.Parser,new o.CSSCompletion,new t.CSSHover,new r.CSSNavigation,new c.CSSCodeActions,new a.CSSValidation)},s.getSCSSLanguageService=function(e){return p(e),f(new d.SCSSParser,new l.SCSSCompletion,new t.CSSHover,new r.CSSNavigation,new c.CSSCodeActions,new a.CSSValidation)},s.getLESSLanguageService=function(e){return p(e),f(new S.LESSParser,new g.LESSCompletion,new t.CSSHover,new r.CSSNavigation,new c.CSSCodeActions,new a.CSSValidation)}}));