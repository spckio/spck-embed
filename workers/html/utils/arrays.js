!function(e){if("object"==typeof module&&"object"==typeof module.exports){var r=e(require,exports);void 0!==r&&(module.exports=r)}else"function"==typeof define&&define.amd&&define(["require","exports"],e)}(function(e,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.findFirst=function(e,r){var t=0,o=e.length;if(0===o)return 0;for(;t<o;){var n=Math.floor((t+o)/2);r(e[n])?o=n:t=n+1}return t},r.binarySearch=function(e,r,t){for(var o=0,n=e.length-1;o<=n;){var f=(o+n)/2|0,i=t(e[f],r);if(i<0)o=f+1;else{if(!(0<i))return f;n=f-1}}return-(o+1)}});