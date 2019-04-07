(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.buffer = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)
},{"base64-js":2,"buffer":1,"ieee754":3}],2:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}]},{},[1])(1)
});

!function(n,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):n.Dexie=t()}(this,function(){"use strict";function n(n,t){return"object"!=typeof t?n:(In(t).forEach(function(e){n[e]=t[e]}),n)}function t(n,t){return Bn.call(n,t)}function e(n,t){"function"==typeof t&&(t=t(Tn(n))),In(t).forEach(function(e){r(n,e,t[e])})}function r(e,r,i,o){Fn(e,r,n(i&&t(i,"get")&&"function"==typeof i.get?{get:i.get,set:i.set,configurable:!0}:{value:i,configurable:!0,writable:!0},o))}function i(n){return{from:function(t){return n.prototype=Object.create(t.prototype),r(n.prototype,"constructor",n),{extend:e.bind(null,n.prototype)}}}}function o(n,t){var e,r=Nn(n,t);return r||(e=Tn(n))&&o(e,t)}function u(n,t,e){return Mn.call(n,t,e)}function a(n,t){return t(n)}function c(n){if(!n)throw new Error("Assertion Failed")}function s(n){Kn.setImmediate?setImmediate(n):setTimeout(n,0)}function f(n,t){return n.reduce(function(n,e,r){var i=t(e,r);return i&&(n[i[0]]=i[1]),n},{})}function l(n,t){return function(){try{n.apply(this,arguments)}catch(n){t(n)}}}function h(n,t,e){try{n.apply(null,e)}catch(n){t&&t(n)}}function d(n,e){if(t(n,e))return n[e];if(!e)return n;if("string"!=typeof e){for(var r=[],i=0,o=e.length;i<o;++i){var u=d(n,e[i]);r.push(u)}return r}var a=e.indexOf(".");if(-1!==a){var c=n[e.substr(0,a)];return void 0===c?void 0:d(c,e.substr(a+1))}}function v(n,t,e){if(n&&void 0!==t&&!("isFrozen"in Object&&Object.isFrozen(n)))if("string"!=typeof t&&"length"in t){c("string"!=typeof e&&"length"in e);for(var r=0,i=t.length;r<i;++r)v(n,t[r],e[r])}else{var o=t.indexOf(".");if(-1!==o){var u=t.substr(0,o),a=t.substr(o+1);if(""===a)void 0===e?delete n[u]:n[u]=e;else{var s=n[u];s||(s=n[u]={}),v(s,a,e)}}else void 0===e?delete n[t]:n[t]=e}}function p(n,t){"string"==typeof t?v(n,t,void 0):"length"in t&&[].map.call(t,function(t){v(n,t,void 0)})}function y(n){var e={};for(var r in n)t(n,r)&&(e[r]=n[r]);return e}function m(n){return qn.apply([],n)}function g(n){if(!n||"object"!=typeof n)return n;var e;if(Cn(n)){e=[];for(var r=0,i=n.length;r<i;++r)e.push(g(n[r]))}else if(Rn.indexOf(n.constructor)>=0)e=n;else{e=n.constructor?Object.create(n.constructor.prototype):{};for(var o in n)t(n,o)&&(e[o]=g(n[o]))}return e}function b(n,e,r,i){return r=r||{},i=i||"",In(n).forEach(function(o){if(t(e,o)){var u=n[o],a=e[o];"object"==typeof u&&"object"==typeof a&&u&&a&&""+u.constructor==""+a.constructor?b(u,a,r,i+o+"."):u!==a&&(r[i+o]=e[o])}else r[i+o]=void 0}),In(e).forEach(function(o){t(n,o)||(r[i+o]=e[o])}),r}function w(n){var t,e,r,i;if(1===arguments.length){if(Cn(n))return n.slice();if(this===zn&&"string"==typeof n)return[n];if(i=Vn(n)){for(e=[];r=i.next(),!r.done;)e.push(r.value);return e}if(null==n)return[n];if("number"==typeof(t=n.length)){for(e=new Array(t);t--;)e[t]=n[t];return e}return[n]}for(t=arguments.length,e=new Array(t);t--;)e[t]=arguments[t];return e}function _(n,t){Ln=n,Wn=t}function k(){if(Qn)try{throw k.arguments,new Error}catch(n){return n}return new Error}function x(n,t){var e=n.stack;return e?(t=t||0,0===e.indexOf(n.name)&&(t+=(n.name+n.message).split("\n").length),e.split("\n").slice(t).filter(Wn).map(function(n){return"\n"+n}).join("")):""}function j(n,t){return function(){return console.warn(n+" is deprecated. See https://github.com/dfahlander/Dexie.js/wiki/Deprecations. "+x(k(),1)),t.apply(this,arguments)}}function P(n,t){this._e=k(),this.name=n,this.message=t}function E(n,t){return n+". Errors: "+t.map(function(n){return n.toString()}).filter(function(n,t,e){return e.indexOf(n)===t}).join("\n")}function A(n,t,e,r){this._e=k(),this.failures=t,this.failedKeys=r,this.successCount=e}function O(n,t){this._e=k(),this.name="BulkError",this.failures=t,this.message=E(n,t)}function S(n,t){if(!n||n instanceof P||n instanceof TypeError||n instanceof SyntaxError||!n.name||!nt[n.name])return n;var e=new nt[n.name](t||n.message,n);return"stack"in n&&r(e,"stack",{get:function(){return this.inner.stack}}),e}function D(){}function I(n){return n}function C(n,t){return null==n||n===I?t:function(e){return t(n(e))}}function K(n,t){return function(){n.apply(this,arguments),t.apply(this,arguments)}}function T(n,t){return n===D?t:function(){var e=n.apply(this,arguments);void 0!==e&&(arguments[0]=e);var r=this.onsuccess,i=this.onerror;this.onsuccess=null,this.onerror=null;var o=t.apply(this,arguments);return r&&(this.onsuccess=this.onsuccess?K(r,this.onsuccess):r),i&&(this.onerror=this.onerror?K(i,this.onerror):i),void 0!==o?o:e}}function B(n,t){return n===D?t:function(){n.apply(this,arguments);var e=this.onsuccess,r=this.onerror;this.onsuccess=this.onerror=null,t.apply(this,arguments),e&&(this.onsuccess=this.onsuccess?K(e,this.onsuccess):e),r&&(this.onerror=this.onerror?K(r,this.onerror):r)}}function F(t,e){return t===D?e:function(r){var i=t.apply(this,arguments);n(r,i);var o=this.onsuccess,u=this.onerror;this.onsuccess=null,this.onerror=null;var a=e.apply(this,arguments);return o&&(this.onsuccess=this.onsuccess?K(o,this.onsuccess):o),u&&(this.onerror=this.onerror?K(u,this.onerror):u),void 0===i?void 0===a?void 0:a:n(i,a)}}function N(n,t){return n===D?t:function(){return!1!==t.apply(this,arguments)&&n.apply(this,arguments)}}function M(n,t){return n===D?t:function(){var e=n.apply(this,arguments);if(e&&"function"==typeof e.then){for(var r=this,i=arguments.length,o=new Array(i);i--;)o[i]=arguments[i];return e.then(function(){return t.apply(r,o)})}return t.apply(this,arguments)}}function q(n){if("object"!=typeof this)throw new TypeError("Promises must be constructed via new");this._listeners=[],this.onuncatched=D,this._lib=!1;var t=this._PSD=xt;if(Ln&&(this._stackHolder=k(),this._prev=null,this._numPrev=0),"function"!=typeof n){if(n!==et)throw new TypeError("Not a function");return this._state=arguments[1],this._value=arguments[2],void(!1===this._state&&V(this,this._value))}this._state=null,this._value=null,++t.ref,U(this,n)}function R(n,t,e,r,i){this.onFulfilled="function"==typeof n?n:null,this.onRejected="function"==typeof t?t:null,this.resolve=e,this.reject=r,this.psd=i}function U(n,t){try{t(function(t){if(null===n._state){if(t===n)throw new TypeError("A promise cannot be resolved with itself.");var e=n._lib&&J();t&&"function"==typeof t.then?U(n,function(n,e){t instanceof q?t._then(n,e):t.then(n,e)}):(n._state=!0,n._value=t,z(n)),e&&Y()}},V.bind(null,n))}catch(t){V(n,t)}}function V(n,t){if(bt.push(t),null===n._state){var e=n._lib&&J();t=_t(t),n._state=!1,n._value=t,Ln&&null!==t&&"object"==typeof t&&!t._promise&&h(function(){var e=o(t,"stack");t._promise=n,r(t,"stack",{get:function(){return dt?e&&(e.get?e.get.apply(t):e.value):n.stack}})}),Z(n),z(n),e&&Y()}}function z(n){var t=n._listeners;n._listeners=[];for(var e=0,r=t.length;e<r;++e)L(n,t[e]);var i=n._PSD;--i.ref||i.finalize(),0===Pt&&(++Pt,pt(function(){0==--Pt&&$()},[]))}function L(n,t){if(null===n._state)return void n._listeners.push(t);var e=n._state?t.onFulfilled:t.onRejected;if(null===e)return(n._state?t.resolve:t.reject)(n._value);++t.psd.ref,++Pt,pt(W,[e,n,t])}function W(n,t,e){try{wt=t;var r,i=t._value;t._state?r=n(i):(bt.length&&(bt=[]),r=n(i),-1===bt.indexOf(i)&&nn(t)),e.resolve(r)}catch(n){e.reject(n)}finally{wt=null,0==--Pt&&$(),--e.psd.ref||e.psd.finalize()}}function Q(n,t,e){if(t.length===e)return t;var r="";if(!1===n._state){var i,o,u=n._value;null!=u?(i=u.name||"Error",o=u.message||u,r=x(u,0)):(i=u,o=""),t.push(i+(o?": "+o:"")+r)}return Ln&&(r=x(n._stackHolder,2),r&&-1===t.indexOf(r)&&t.push(r),n._prev&&Q(n._prev,t,e)),t}function H(n,t){var e=t?t._numPrev+1:0;e<rt&&(n._prev=t,n._numPrev=e)}function G(){J()&&Y()}function J(){var n=yt;return yt=!1,mt=!1,n}function Y(){var n,t,e;do{for(;jt.length>0;)for(n=jt,jt=[],e=n.length,t=0;t<e;++t){var r=n[t];r[0].apply(null,r[1])}}while(jt.length>0);yt=!0,mt=!0}function $(){var n=gt;gt=[],n.forEach(function(n){n._PSD.onunhandled.call(null,n._value,n)});for(var t=Et.slice(0),e=t.length;e;)t[--e]()}function X(n){function t(){n(),Et.splice(Et.indexOf(t),1)}Et.push(t),++Pt,pt(function(){0==--Pt&&$()},[])}function Z(n){gt.some(function(t){return t._value===n._value})||gt.push(n)}function nn(n){for(var t=gt.length;t;)if(gt[--t]._value===n._value)return void gt.splice(t,1)}function tn(n){return new q(et,!1,n)}function en(n,t){var e=xt;return function(){var r=J(),i=xt;try{return fn(e,!0),n.apply(this,arguments)}catch(n){t&&t(n)}finally{fn(i,!1),r&&Y()}}}function rn(t,e,r,i){var o=xt,u=Object.create(o);u.parent=o,u.ref=0,u.global=!1,u.id=++Tt;var a=kt.env;u.env=ht?{Promise:q,PromiseProp:{value:q,configurable:!0,writable:!0},all:q.all,race:q.race,resolve:q.resolve,reject:q.reject,nthen:pn(a.nthen,u),gthen:pn(a.gthen,u)}:{},e&&n(u,e),++o.ref,u.finalize=function(){--this.parent.ref||this.parent.finalize()};var c=hn(u,t,r,i);return 0===u.ref&&u.finalize(),c}function on(){return St.id||(St.id=++Dt),++St.awaits,St.echoes+=it,St.id}function un(n){!St.awaits||n&&n!==St.id||(0==--St.awaits&&(St.id=0),St.echoes=St.awaits*it)}function an(n){return St.echoes&&n&&n.constructor===ft?(on(),n.then(function(n){return un(),n},function(n){return un(),Ft(n)})):n}function cn(n){++Kt,St.echoes&&0!=--St.echoes||(St.echoes=St.id=0),It.push(xt),fn(n,!0)}function sn(){var n=It[It.length-1];It.pop(),fn(n,!1)}function fn(n,t){var e=xt;if((t?!St.echoes||Ct++&&n===xt:!Ct||--Ct&&n===xt)||dn(t?cn.bind(null,n):sn),n!==xt&&(xt=n,e===kt&&(kt.env=ln()),ht)){var r=kt.env.Promise,i=n.env;at.then=i.nthen,r.prototype.then=i.gthen,(e.global||n.global)&&(Object.defineProperty(Kn,"Promise",i.PromiseProp),r.all=i.all,r.race=i.race,r.resolve=i.resolve,r.reject=i.reject)}}function ln(){var n=Kn.Promise;return ht?{Promise:n,PromiseProp:Object.getOwnPropertyDescriptor(Kn,"Promise"),all:n.all,race:n.race,resolve:n.resolve,reject:n.reject,nthen:at.then,gthen:n.prototype.then}:{}}function hn(n,t,e,r,i){var o=xt;try{return fn(n,!0),t(e,r,i)}finally{fn(o,!1)}}function dn(n){st.call(ut,n)}function vn(n,t,e){return"function"!=typeof n?n:function(){var r=xt;e&&on(),fn(t,!0);try{return n.apply(this,arguments)}finally{fn(r,!1)}}}function pn(n,t){return function(e,r){return n.call(this,vn(e,t,!1),vn(r,t,!1))}}function yn(t,e){var r;try{r=e.onuncatched(t)}catch(n){}if(!1!==r)try{var i,o={promise:e,reason:t};if(Kn.document&&document.createEvent?(i=document.createEvent("Event"),i.initEvent(Bt,!0,!0),n(i,o)):Kn.CustomEvent&&(i=new CustomEvent(Bt,{detail:o}),n(i,o)),i&&Kn.dispatchEvent&&(dispatchEvent(i),!Kn.PromiseRejectionEvent&&Kn.onunhandledrejection))try{Kn.onunhandledrejection(i)}catch(n){}i.defaultPrevented||console.warn("Unhandled rejection: "+(t.stack||t))}catch(n){}}function mn(n){function t(n,t,o){if("object"==typeof n)return e(n);t||(t=N),o||(o=D);var u={subscribers:[],fire:o,subscribe:function(n){-1===u.subscribers.indexOf(n)&&(u.subscribers.push(n),u.fire=t(u.fire,n))},unsubscribe:function(n){u.subscribers=u.subscribers.filter(function(t){return t!==n}),u.fire=u.subscribers.reduce(t,o)}};return r[n]=i[n]=u,u}function e(n){In(n).forEach(function(e){var r=n[e];if(Cn(r))t(e,n[e][0],n[e][1]);else{if("asap"!==r)throw new Zn.InvalidArgument("Invalid event config");var i=t(e,I,function(){for(var n=arguments.length,t=new Array(n);n--;)t[n]=arguments[n];i.subscribers.forEach(function(n){s(function(){n.apply(null,t)})})})}})}var r={},i=function(t,e){if(e){for(var i=arguments.length,o=new Array(i-1);--i;)o[i-1]=arguments[i];return r[t].subscribe.apply(null,o),n}if("string"==typeof t)return r[t]};i.addEventType=t;for(var o=1,u=arguments.length;o<u;++o)t(arguments[o]);return i}function gn(i,o){function s(n){this._cfg={version:n,storesSource:null,dbschema:{},tables:{},contentUpgrade:null},this.stores({})}function p(n,t,e){var r=nt._createTransaction(Xn,Wn,Un);r.create(t),r._completion.catch(e);var i=r._reject.bind(r);rn(function(){xt.trans=r,0===n?(In(Un).forEach(function(n){P(t,n,Un[n].primKey,Un[n].indexes)}),q.follow(function(){return nt.on.populate.fire(r)}).catch(i)):_(n,r,t).catch(i)})}function _(n,t,e){function r(){return i.length?q.resolve(i.shift()(t.idbtrans)).then(r):q.resolve()}var i=[],o=Vn.filter(function(t){return t._cfg.version===n})[0];if(!o)throw new Zn.Upgrade("Dexie specification of currently installed DB version is missing");Un=nt._dbSchema=o._cfg.dbschema;var u=!1;return Vn.filter(function(t){return t._cfg.version>n}).forEach(function(n){i.push(function(){var r=Un,i=n._cfg.dbschema;vn(r,e),vn(i,e),Un=nt._dbSchema=i;var o=x(r,i);if(o.add.forEach(function(n){P(e,n[0],n[1].primKey,n[1].indexes)}),o.change.forEach(function(n){if(n.recreate)throw new Zn.Upgrade("Not yet support for changing primary key");var t=e.objectStore(n.name);n.add.forEach(function(n){K(t,n)}),n.change.forEach(function(n){t.deleteIndex(n.name),K(t,n)}),n.del.forEach(function(n){t.deleteIndex(n)})}),n._cfg.contentUpgrade)return u=!0,q.follow(function(){n._cfg.contentUpgrade(t)})}),i.push(function(t){u&&Wt||S(n._cfg.dbschema,t)})}),r().then(function(){E(Un,e)})}function x(n,t){var e={del:[],add:[],change:[]};for(var r in n)t[r]||e.del.push(r);for(r in t){var i=n[r],o=t[r];if(i){var u={name:r,def:o,recreate:!1,del:[],add:[],change:[]};if(i.primKey.src!==o.primKey.src)u.recreate=!0,e.change.push(u);else{var a=i.idxByName,c=o.idxByName;for(var s in a)c[s]||u.del.push(s);for(s in c){var f=a[s],l=c[s];f?f.src!==l.src&&u.change.push(l):u.add.push(l)}(u.del.length>0||u.add.length>0||u.change.length>0)&&e.change.push(u)}}else e.add.push([r,o])}return e}function P(n,t,e,r){var i=n.db.createObjectStore(t,e.keyPath?{keyPath:e.keyPath,autoIncrement:e.auto}:{autoIncrement:e.auto});return r.forEach(function(n){K(i,n)}),i}function E(n,t){In(n).forEach(function(e){t.db.objectStoreNames.contains(e)||P(t,e,n[e].primKey,n[e].indexes)})}function S(n,t){for(var e=0;e<t.db.objectStoreNames.length;++e){var r=t.db.objectStoreNames[e];null==n[r]&&t.db.deleteObjectStore(r)}}function K(n,t){n.createIndex(t.name,t.keyPath,{unique:t.unique,multiEntry:t.multi})}function N(n,t,e){if($n||xt.letThrough){var r=nt._createTransaction(n,t,Un);try{r.create()}catch(n){return Ft(n)}return r._promise(n,function(n,t){return rn(function(){return xt.trans=r,e(n,t,r)})}).then(function(n){return r._completion.then(function(){return n})})}if(!Jn){if(!Mn)return Ft(new Zn.DatabaseClosed);nt.open().catch(D)}return tt.then(function(){return N(n,t,e)})}function R(n,t,e){var r=arguments.length;if(r<2)throw new Zn.InvalidArgument("Too few arguments");for(var i=new Array(r-1);--r;)i[r-1]=arguments[r];return e=i.pop(),[n,m(i),e]}function U(n,t,e){this.name=n,this.schema=t,this._tx=e,this.hook=Qn[n]?Qn[n].hook:mn(null,{creating:[T,D],reading:[C,I],updating:[F,D],deleting:[B,D]})}function V(n,t,e){return(e?jn:kn)(function(e){n.push(e),t&&t()})}function z(n,t,e,r,i){return new q(function(o,u){var a=e.length,c=a-1;if(0===a)return o();if(r){var s,f=jn(u),l=_n(null);h(function(){for(var r=0;r<a;++r){s={onsuccess:null,onerror:null};var u=e[r];i.call(s,u[0],u[1],t);var h=n.delete(u[0]);h._hookCtx=s,h.onerror=f,h.onsuccess=r===c?_n(o):l}},function(n){throw s.onerror&&s.onerror(n),n})}else for(var d=0;d<a;++d){var v=n.delete(e[d]);v.onerror=kn(u),d===c&&(v.onsuccess=en(function(){return o()}))}})}function L(n,t,e,r){var i=this;this.db=nt,this.mode=n,this.storeNames=t,this.idbtrans=null,this.on=mn(this,"complete","error","abort"),this.parent=r||null,this.active=!0,this._reculock=0,this._blockedFuncs=[],this._resolve=null,this._reject=null,this._waitingFor=null,this._waitingQueue=null,this._spinCount=0,this._completion=new q(function(n,t){i._resolve=n,i._reject=t}),this._completion.then(function(){i.active=!1,i.on.complete.fire()},function(n){var t=i.active;return i.active=!1,i.on.error.fire(n),i.parent?i.parent._reject(n):t&&i.idbtrans&&i.idbtrans.abort(),Ft(n)})}function W(n,t,e){this._ctx={table:n,index:":id"===t?null:t,or:e}}function Q(n,t){var e=null,r=null;if(t)try{e=t()}catch(n){r=n}var i=n._ctx,o=i.table;this._ctx={table:o,index:i.index,isPrimKey:!i.index||o.schema.primKey.keyPath&&i.index===o.schema.primKey.name,range:e,keysOnly:!1,dir:"next",unique:"",algorithm:null,filter:null,replayFilter:null,justLimit:!0,isMatch:null,offset:0,limit:1/0,error:r,or:i.or,valueMapper:o.hook.reading.fire}}function H(n,t){return!(n.filter||n.algorithm||n.or)&&(t?n.justLimit:!n.replayFilter)}function G(n,t){return n._cfg.version-t._cfg.version}function J(n,t,e){t.forEach(function(t){var i=e[t];n.forEach(function(n){t in n||(n===L.prototype||n instanceof L?r(n,t,{get:function(){return this.table(t)}}):n[t]=new U(t,i))})})}function Y(n){n.forEach(function(n){for(var t in n)n[t]instanceof U&&delete n[t]})}function $(n,t,e,r,i,o){var u=o?function(n,t,r){return e(o(n),t,r)}:e,a=en(u,i);n.onerror||(n.onerror=kn(i)),n.onsuccess=t?l(function(){var e=n.result;if(e){var o=function(){e.continue()};t(e,function(n){o=n},r,i)&&a(e.value,e,function(n){o=n}),o()}else r()},i):l(function(){var t=n.result;if(t){var e=function(){t.continue()};a(t.value,t,function(n){e=n}),e()}else r()},i)}function X(n){var t=[];return n.split(",").forEach(function(n){n=n.trim();var e=n.replace(/([&*]|\+\+)/g,""),r=/^\[/.test(e)?e.match(/^\[(.*)\]$/)[1].split("+"):e;t.push(new An(e,r||null,/\&/.test(n),/\*/.test(n),/\+\+/.test(n),Cn(r),/\./.test(n)))}),t}function Z(n,t){return qn.cmp(n,t)}function nn(n,t){return Z(n,t)<0?n:t}function tn(n,t){return Z(n,t)>0?n:t}function an(n,t){return qn.cmp(n,t)}function cn(n,t){return qn.cmp(t,n)}function sn(n,t){return n<t?-1:n===t?0:1}function fn(n,t){return n>t?-1:n===t?0:1}function ln(n,t){return n?t?function(){return n.apply(this,arguments)&&t.apply(this,arguments)}:n:t}function dn(){if(nt.verno=Hn.version/10,nt._dbSchema=Un={},Wn=u(Hn.objectStoreNames,0),0!==Wn.length){var n=Hn.transaction(Sn(Wn),"readonly");Wn.forEach(function(t){for(var e=n.objectStore(t),r=e.keyPath,i=r&&"string"==typeof r&&-1!==r.indexOf("."),o=new An(r,r||"",!1,!1,!!e.autoIncrement,r&&"string"!=typeof r,i),u=[],a=0;a<e.indexNames.length;++a){var c=e.index(e.indexNames[a]);r=c.keyPath,i=r&&"string"==typeof r&&-1!==r.indexOf(".");var s=new An(c.name,r,!!c.unique,!!c.multiEntry,!1,r&&"string"!=typeof r,i);u.push(s)}Un[t]=new On(t,o,u,{})}),J([Qn],In(Un),Un)}}function vn(n,t){for(var e=t.db.objectStoreNames,r=0;r<e.length;++r){var i=e[r],o=t.objectStore(i);Tn="getAll"in o;for(var a=0;a<o.indexNames.length;++a){var c=o.indexNames[a],s=o.index(c).keyPath,f="string"==typeof s?s:"["+u(s).join("+")+"]";if(n[i]){var l=n[i].idxByName[f];l&&(l.name=c)}}}/Safari/.test(navigator.userAgent)&&!/(Chrome\/|Edge\/)/.test(navigator.userAgent)&&Kn.WorkerGlobalScope&&Kn instanceof Kn.WorkerGlobalScope&&[].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1]<604&&(Tn=!1)}function pn(n){nt.on("blocked").fire(n),zt.filter(function(n){return n.name===nt.name&&n!==nt&&!n._vcFired}).map(function(t){return t.on("versionchange").fire(n)})}var yn,bn,Tn,Bn=gn.dependencies,Fn=n({addons:gn.addons,autoOpen:!0,indexedDB:Bn.indexedDB,IDBKeyRange:Bn.IDBKeyRange},o),Nn=Fn.addons,Mn=Fn.autoOpen,qn=Fn.indexedDB,Rn=Fn.IDBKeyRange,Un=this._dbSchema={},Vn=[],Wn=[],Qn={},Hn=null,Gn=null,Jn=!1,Yn=null,$n=!1,Xn="readwrite",nt=this,tt=new q(function(n){yn=n}),et=new q(function(n,t){bn=t}),rt=!0,it=!!Dn(qn);this.version=function(n){if(Hn||Jn)throw new Zn.Schema("Cannot add version when database is open");this.verno=Math.max(this.verno,n);var t=Vn.filter(function(t){return t._cfg.version===n})[0];return t||(t=new s(n),Vn.push(t),Vn.sort(G),rt=!1,t)},n(s.prototype,{stores:function(t){this._cfg.storesSource=this._cfg.storesSource?n(this._cfg.storesSource,t):t;var e={};Vn.forEach(function(t){n(e,t._cfg.storesSource)});var r=this._cfg.dbschema={};return this._parseStoresSpec(e,r),Un=nt._dbSchema=r,Y([Qn,nt,L.prototype]),J([Qn,nt,L.prototype,this._cfg.tables],In(r),r),Wn=In(r),this},upgrade:function(n){return this._cfg.contentUpgrade=n,this},_parseStoresSpec:function(n,t){In(n).forEach(function(e){if(null!==n[e]){var r={},i=X(n[e]),o=i.shift();if(o.multi)throw new Zn.Schema("Primary key cannot be multi-valued");o.keyPath&&v(r,o.keyPath,o.auto?0:o.keyPath),i.forEach(function(n){if(n.auto)throw new Zn.Schema("Only primary key can be marked as autoIncrement (++)");if(!n.keyPath)throw new Zn.Schema("Index must have a name and cannot be an empty string");v(r,n.keyPath,n.compound?n.keyPath.map(function(){return""}):"")}),t[e]=new On(e,o,i,r)}})}}),this._allTables=Qn,this._createTransaction=function(n,t,e,r){return new L(n,t,e,r)},this._whenReady=function(n){return $n||xt.letThrough?n():new q(function(n,t){if(!Jn){if(!Mn)return void t(new Zn.DatabaseClosed);nt.open().catch(D)}tt.then(n,t)}).then(n)},this.verno=0,this.open=function(){if(Jn||Hn)return tt.then(function(){return Gn?Ft(Gn):nt});Ln&&(et._stackHolder=k()),Jn=!0,Gn=null,$n=!1;var n=yn,t=null;return q.race([et,new q(function(n,e){if(!qn)throw new Zn.MissingAPI("indexedDB API not found. If using IE10+, make sure to run your code on a server URL (not locally). If using old Safari versions, make sure to include indexedDB polyfill.");var r=rt?qn.open(i):qn.open(i,Math.round(10*nt.verno));if(!r)throw new Zn.MissingAPI("IndexedDB API not available");r.onerror=kn(e),r.onblocked=en(pn),r.onupgradeneeded=en(function(n){if(t=r.transaction,rt&&!nt._allowEmptyDB){r.onerror=Pn,t.abort(),r.result.close();var o=qn.deleteDatabase(i);o.onsuccess=o.onerror=en(function(){e(new Zn.NoSuchDatabase("Database "+i+" doesnt exist"))})}else{t.onerror=kn(e);p((n.oldVersion>Math.pow(2,62)?0:n.oldVersion)/10,t,e)}},e),r.onsuccess=en(function(){if(t=null,Hn=r.result,zt.push(nt),rt)dn();else if(Hn.objectStoreNames.length>0)try{vn(Un,Hn.transaction(Sn(Hn.objectStoreNames),"readonly"))}catch(n){}Hn.onversionchange=en(function(n){nt._vcFired=!0,nt.on("versionchange").fire(n)}),it||"__dbnames"===i||Ot.dbnames.put({name:i}).catch(D),n()},e)})]).then(function(){return Yn=[],q.resolve(gn.vip(nt.on.ready.fire)).then(function n(){if(Yn.length>0){var t=Yn.reduce(M,D);return Yn=[],q.resolve(gn.vip(t)).then(n)}})}).finally(function(){Yn=null}).then(function(){return Jn=!1,nt}).catch(function(n){try{t&&t.abort()}catch(n){}return Jn=!1,nt.close(),Gn=n,Ft(Gn)}).finally(function(){$n=!0,n()})},this.close=function(){var n=zt.indexOf(nt);if(n>=0&&zt.splice(n,1),Hn){try{Hn.close()}catch(n){}Hn=null}Mn=!1,Gn=new Zn.DatabaseClosed,Jn&&bn(Gn),tt=new q(function(n){yn=n}),et=new q(function(n,t){bn=t})},this.delete=function(){var n=arguments.length>0;return new q(function(t,e){function r(){nt.close();var n=qn.deleteDatabase(i);n.onsuccess=en(function(){it||Ot.dbnames.delete(i).catch(D),t()}),n.onerror=kn(e),n.onblocked=pn}if(n)throw new Zn.InvalidArgument("Arguments not allowed in db.delete()");Jn?tt.then(r):r()})},this.backendDB=function(){return Hn},this.isOpen=function(){return null!==Hn},this.hasBeenClosed=function(){return Gn&&Gn instanceof Zn.DatabaseClosed},this.hasFailed=function(){return null!==Gn},this.dynamicallyOpened=function(){return rt},this.name=i,e(this,{tables:{get:function(){return In(Qn).map(function(n){return Qn[n]})}}}),this.on=mn(this,"populate","blocked","versionchange",{ready:[M,D]}),this.on.ready.subscribe=a(this.on.ready.subscribe,function(n){return function(t,e){gn.vip(function(){$n?(Gn||q.resolve().then(t),e&&n(t)):Yn?(Yn.push(t),e&&n(t)):(n(t),e||n(function n(){nt.on.ready.unsubscribe(t),nt.on.ready.unsubscribe(n)}))})}}),this.transaction=function(){var n=R.apply(this,arguments);return this._transaction.apply(this,n)},this._transaction=function(n,t,e){function r(){return q.resolve().then(function(){var t=xt.transless||xt,r=nt._createTransaction(n,u,Un,i),o={trans:r,transless:t};i?r.idbtrans=i.idbtrans:r.create(),e.constructor===lt&&on();var a,c=q.follow(function(){if(a=e.call(r,r))if(a.constructor===ft){var n=un.bind(null,null);a.then(n,n)}else"function"==typeof a.next&&"function"==typeof a.throw&&(a=En(a))},o);return(a&&"function"==typeof a.then?q.resolve(a).then(function(n){return r.active?n:Ft(new Zn.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn"))}):c.then(function(){return a})).then(function(n){return i&&r._resolve(),r._completion.then(function(){return n})}).catch(function(n){return r._reject(n),Ft(n)})})}var i=xt.trans;i&&i.db===nt&&-1===n.indexOf("!")||(i=null);var o=-1!==n.indexOf("?");n=n.replace("!","").replace("?","");try{var u=t.map(function(n){var t=n instanceof U?n.name:n;if("string"!=typeof t)throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");return t});if("r"==n||"readonly"==n)n="readonly";else{if("rw"!=n&&n!=Xn)throw new Zn.InvalidArgument("Invalid transaction mode: "+n);n=Xn}if(i){if("readonly"===i.mode&&n===Xn){if(!o)throw new Zn.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");i=null}i&&u.forEach(function(n){if(i&&-1===i.storeNames.indexOf(n)){if(!o)throw new Zn.SubTransaction("Table "+n+" not included in parent transaction.");i=null}}),o&&i&&!i.active&&(i=null)}}catch(n){return i?i._promise(null,function(t,e){e(n)}):Ft(n)}return i?i._promise(n,r,"lock"):xt.trans?hn(xt.transless,function(){return nt._whenReady(r)}):nt._whenReady(r)},this.table=function(n){if(!t(Qn,n))throw new Zn.InvalidTable("Table "+n+" does not exist");return Qn[n]},e(U.prototype,{_trans:function(n,t,e){var r=this._tx||xt.trans;return r&&r.db===nt?r===xt.trans?r._promise(n,t,e):rn(function(){return r._promise(n,t,e)},{trans:r,transless:xt.transless||xt}):N(n,[this.name],t)},_idbstore:function(n,t,e){function r(n,e,r){if(-1===r.storeNames.indexOf(i))throw new Zn.NotFound("Table"+i+" not part of transaction");return t(n,e,r.idbtrans.objectStore(i),r)}var i=this.name;return this._trans(n,r,e)},get:function(n,t){if(n&&n.constructor===Object)return this.where(n).first(t);var e=this;return this._idbstore("readonly",function(t,r,i){var o=i.get(n);o.onerror=kn(r),o.onsuccess=en(function(){t(e.hook.reading.fire(o.result))},r)}).then(t)},where:function(n){if("string"==typeof n)return new W(this,n);if(Cn(n))return new W(this,"["+n.join("+")+"]");var t=In(n);if(1===t.length)return this.where(t[0]).equals(n[t[0]]);var e=this.schema.indexes.concat(this.schema.primKey).filter(function(n){return n.compound&&t.every(function(t){return n.keyPath.indexOf(t)>=0})&&n.keyPath.every(function(n){return t.indexOf(n)>=0})})[0];if(e&&qt!==Mt)return this.where(e.name).equals(e.keyPath.map(function(t){return n[t]}));e||console.warn("The query "+JSON.stringify(n)+" on "+this.name+" would benefit of a compound index ["+t.join("+")+"]");var r=this.schema.idxByName,i=t.reduce(function(t,e){return[t[0]||r[e],t[0]||!r[e]?ln(t[1],function(t){return""+d(t,e)==""+n[e]}):t[1]]},[null,null]),o=i[0];return o?this.where(o.name).equals(n[o.keyPath]).filter(i[1]):e?this.filter(i[1]):this.where(t).equals("")},count:function(n){return this.toCollection().count(n)},offset:function(n){return this.toCollection().offset(n)},limit:function(n){return this.toCollection().limit(n)},reverse:function(){return this.toCollection().reverse()},filter:function(n){return this.toCollection().and(n)},each:function(n){return this.toCollection().each(n)},toArray:function(n){return this.toCollection().toArray(n)},orderBy:function(n){return new Q(new W(this,Cn(n)?"["+n.join("+")+"]":n))},toCollection:function(){return new Q(new W(this))},mapToClass:function(n,e){this.schema.mappedClass=n;var r=Object.create(n.prototype);e&&wn(r,e),this.schema.instanceTemplate=r;var i=function(e){if(!e)return e;var r=Object.create(n.prototype);for(var i in e)if(t(e,i))try{r[i]=e[i]}catch(n){}return r};return this.schema.readHook&&this.hook.reading.unsubscribe(this.schema.readHook),this.schema.readHook=i,this.hook("reading",i),n},defineClass:function(n){return this.mapToClass(gn.defineClass(n),n)},bulkDelete:function(n){return this.hook.deleting.fire===D?this._idbstore(Xn,function(t,e,r,i){t(z(r,i,n,!1,D))}):this.where(":id").anyOf(n).delete().then(function(){})},bulkPut:function(n,t){var e=this;return this._idbstore(Xn,function(r,i,o){if(!o.keyPath&&!e.schema.primKey.auto&&!t)throw new Zn.InvalidArgument("bulkPut() with non-inbound keys requires keys array in second argument");if(o.keyPath&&t)throw new Zn.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");if(t&&t.length!==n.length)throw new Zn.InvalidArgument("Arguments objects and keys must have the same length");if(0===n.length)return r();var u,a,c=function(n){0===s.length?r(n):i(new O(e.name+".bulkPut(): "+s.length+" of "+l+" operations failed",s))},s=[],l=n.length,h=e;if(e.hook.creating.fire===D&&e.hook.updating.fire===D){a=V(s);for(var v=0,p=n.length;v<p;++v)u=t?o.put(n[v],t[v]):o.put(n[v]),u.onerror=a;u.onerror=V(s,c),u.onsuccess=xn(c)}else{var y=t||o.keyPath&&n.map(function(n){return d(n,o.keyPath)}),m=y&&f(y,function(t,e){return null!=t&&[t,n[e]]});(y?h.where(":id").anyOf(y.filter(function(n){return null!=n})).modify(function(){this.value=m[this.primKey],m[this.primKey]=null}).catch(A,function(n){s=n.failures}).then(function(){for(var e=[],r=t&&[],i=y.length-1;i>=0;--i){var o=y[i];(null==o||m[o])&&(e.push(n[i]),t&&r.push(o),null!=o&&(m[o]=null))}return e.reverse(),t&&r.reverse(),h.bulkAdd(e,r)}).then(function(n){var t=y[y.length-1];return null!=t?t:n}):h.bulkAdd(n)).then(c).catch(O,function(n){s=s.concat(n.failures),c()}).catch(i)}},"locked")},bulkAdd:function(n,t){var e=this,r=this.hook.creating.fire;return this._idbstore(Xn,function(i,o,u,a){function c(n){0===p.length?i(n):o(new O(e.name+".bulkAdd(): "+p.length+" of "+y+" operations failed",p))}if(!u.keyPath&&!e.schema.primKey.auto&&!t)throw new Zn.InvalidArgument("bulkAdd() with non-inbound keys requires keys array in second argument");if(u.keyPath&&t)throw new Zn.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");if(t&&t.length!==n.length)throw new Zn.InvalidArgument("Arguments objects and keys must have the same length");if(0===n.length)return i();var s,f,l,p=[],y=n.length;if(r!==D){var m,b=u.keyPath;f=V(p,null,!0),l=_n(null),h(function(){for(var e=0,i=n.length;e<i;++e){m={onerror:null,onsuccess:null};var o=t&&t[e],c=n[e],h=t?o:b?d(c,b):void 0,p=r.call(m,h,c,a);null==h&&null!=p&&(b?(c=g(c),v(c,b,p)):o=p),s=null!=o?u.add(c,o):u.add(c),s._hookCtx=m,e<i-1&&(s.onerror=f,m.onsuccess&&(s.onsuccess=l))}},function(n){throw m.onerror&&m.onerror(n),n}),s.onerror=V(p,c,!0),s.onsuccess=_n(c)}else{f=V(p);for(var w=0,_=n.length;w<_;++w)s=t?u.add(n[w],t[w]):u.add(n[w]),s.onerror=f;s.onerror=V(p,c),s.onsuccess=xn(c)}})},add:function(n,t){var e=this.hook.creating.fire;return this._idbstore(Xn,function(r,i,o,u){var a={onsuccess:null,onerror:null};if(e!==D){var c=null!=t?t:o.keyPath?d(n,o.keyPath):void 0,s=e.call(a,c,n,u);null==c&&null!=s&&(o.keyPath?v(n,o.keyPath,s):t=s)}try{var f=null!=t?o.add(n,t):o.add(n);f._hookCtx=a,f.onerror=jn(i),f.onsuccess=_n(function(t){var e=o.keyPath;e&&v(n,e,t),r(t)})}catch(n){throw a.onerror&&a.onerror(n),n}})},put:function(n,t){var e=this,r=this.hook.creating.fire,i=this.hook.updating.fire;if(r!==D||i!==D){var o=this.schema.primKey.keyPath,u=void 0!==t?t:o&&d(n,o);return null==u?this.add(n):(n=g(n),this._trans(Xn,function(){return e.where(":id").equals(u).modify(function(){this.value=n}).then(function(r){return 0===r?e.add(n,t):u})},"locked"))}return this._idbstore(Xn,function(e,r,i){var o=void 0!==t?i.put(n,t):i.put(n);o.onerror=kn(r),o.onsuccess=en(function(t){var r=i.keyPath;r&&v(n,r,t.target.result),e(o.result)})})},delete:function(n){return this.hook.deleting.subscribers.length?this.where(":id").equals(n).delete():this._idbstore(Xn,function(t,e,r){var i=r.delete(n);i.onerror=kn(e),i.onsuccess=en(function(){t(i.result)})})},clear:function(){return this.hook.deleting.subscribers.length?this.toCollection().delete():this._idbstore(Xn,function(n,t,e){var r=e.clear();r.onerror=kn(t),r.onsuccess=en(function(){n(r.result)})})},update:function(n,t){if("object"!=typeof t||Cn(t))throw new Zn.InvalidArgument("Modifications must be an object.");if("object"!=typeof n||Cn(n))return this.where(":id").equals(n).modify(t);In(t).forEach(function(e){v(n,e,t[e])})
;var e=d(n,this.schema.primKey.keyPath);return void 0===e?Ft(new Zn.InvalidArgument("Given object does not contain its primary key")):this.where(":id").equals(e).modify(t)}}),e(L.prototype,{_lock:function(){return c(!xt.global),++this._reculock,1!==this._reculock||xt.global||(xt.lockOwnerFor=this),this},_unlock:function(){if(c(!xt.global),0==--this._reculock)for(xt.global||(xt.lockOwnerFor=null);this._blockedFuncs.length>0&&!this._locked();){var n=this._blockedFuncs.shift();try{hn(n[1],n[0])}catch(n){}}return this},_locked:function(){return this._reculock&&xt.lockOwnerFor!==this},create:function(n){var t=this;if(!this.mode)return this;if(c(!this.idbtrans),!n&&!Hn)switch(Gn&&Gn.name){case"DatabaseClosedError":throw new Zn.DatabaseClosed(Gn);case"MissingAPIError":throw new Zn.MissingAPI(Gn.message,Gn);default:throw new Zn.OpenFailed(Gn)}if(!this.active)throw new Zn.TransactionInactive;return c(null===this._completion._state),n=this.idbtrans=n||Hn.transaction(Sn(this.storeNames),this.mode),n.onerror=en(function(e){Pn(e),t._reject(n.error)}),n.onabort=en(function(e){Pn(e),t.active&&t._reject(new Zn.Abort(n.error)),t.active=!1,t.on("abort").fire(e)}),n.oncomplete=en(function(){t.active=!1,t._resolve()}),this},_promise:function(n,t,e){var r=this;if(n===Xn&&this.mode!==Xn)return Ft(new Zn.ReadOnly("Transaction is readonly"));if(!this.active)return Ft(new Zn.TransactionInactive);if(this._locked())return new q(function(i,o){r._blockedFuncs.push([function(){r._promise(n,t,e).then(i,o)},xt])});if(e)return rn(function(){var n=new q(function(n,e){r._lock();var i=t(n,e,r);i&&i.then&&i.then(n,e)});return n.finally(function(){return r._unlock()}),n._lib=!0,n});var i=new q(function(n,e){var i=t(n,e,r);i&&i.then&&i.then(n,e)});return i._lib=!0,i},_root:function(){return this.parent?this.parent._root():this},waitFor:function(n){var t=this._root();if(n=q.resolve(n),t._waitingFor)t._waitingFor=t._waitingFor.then(function(){return n});else{t._waitingFor=n,t._waitingQueue=[];var e=t.idbtrans.objectStore(t.storeNames[0]);!function n(){for(++t._spinCount;t._waitingQueue.length;)t._waitingQueue.shift()();t._waitingFor&&(e.get(-1/0).onsuccess=n)}()}var r=t._waitingFor;return new q(function(e,i){n.then(function(n){return t._waitingQueue.push(en(e.bind(null,n)))},function(n){return t._waitingQueue.push(en(i.bind(null,n)))}).finally(function(){t._waitingFor===r&&(t._waitingFor=null)})})},abort:function(){this.active&&this._reject(new Zn.Abort),this.active=!1},tables:{get:j("Transaction.tables",function(){return Qn})},table:function(n){return new U(n,nt.table(n).schema,this)}}),e(W.prototype,function(){function n(n,t,e){var r=n instanceof W?new Q(n):n;return r._ctx.error=e?new e(t):new TypeError(t),r}function t(n){return new Q(n,function(){return Rn.only("")}).limit(0)}function e(n){return"next"===n?function(n){return n.toUpperCase()}:function(n){return n.toLowerCase()}}function r(n){return"next"===n?function(n){return n.toLowerCase()}:function(n){return n.toUpperCase()}}function i(n,t,e,r,i,o){for(var u=Math.min(n.length,r.length),a=-1,c=0;c<u;++c){var s=t[c];if(s!==r[c])return i(n[c],e[c])<0?n.substr(0,c)+e[c]+e.substr(c+1):i(n[c],r[c])<0?n.substr(0,c)+r[c]+e.substr(c+1):a>=0?n.substr(0,a)+t[a]+e.substr(a+1):null;i(n[c],s)<0&&(a=c)}return u<r.length&&"next"===o?n+e.substr(n.length):u<n.length&&"prev"===o?n.substr(0,e.length):a<0?null:n.substr(0,a)+r[a]+e.substr(a+1)}function o(t,o,u,a){function c(n){s=e(n),f=r(n),l="next"===n?sn:fn;var t=u.map(function(n){return{lower:f(n),upper:s(n)}}).sort(function(n,t){return l(n.lower,t.lower)});h=t.map(function(n){return n.upper}),d=t.map(function(n){return n.lower}),v=n,p="next"===n?"":a}var s,f,l,h,d,v,p,y=u.length;if(!u.every(function(n){return"string"==typeof n}))return n(t,Vt);c("next");var m=new Q(t,function(){return Rn.bound(h[0],d[y-1]+a)});m._ondirectionchange=function(n){c(n)};var g=0;return m._addAlgorithm(function(n,t,e){var r=n.key;if("string"!=typeof r)return!1;var u=f(r);if(o(u,d,g))return!0;for(var a=null,c=g;c<y;++c){var s=i(r,u,h[c],d[c],l,v);null===s&&null===a?g=c+1:(null===a||l(a,s)>0)&&(a=s)}return t(null!==a?function(){n.continue(a+p)}:e),!1}),m}return{between:function(e,r,i,o){i=!1!==i,o=!0===o;try{return Z(e,r)>0||0===Z(e,r)&&(i||o)&&(!i||!o)?t(this):new Q(this,function(){return Rn.bound(e,r,!i,!o)})}catch(t){return n(this,Ut)}},equals:function(n){return new Q(this,function(){return Rn.only(n)})},above:function(n){return new Q(this,function(){return Rn.lowerBound(n,!0)})},aboveOrEqual:function(n){return new Q(this,function(){return Rn.lowerBound(n)})},below:function(n){return new Q(this,function(){return Rn.upperBound(n,!0)})},belowOrEqual:function(n){return new Q(this,function(){return Rn.upperBound(n)})},startsWith:function(t){return"string"!=typeof t?n(this,Vt):this.between(t,t+Mt,!0,!0)},startsWithIgnoreCase:function(n){return""===n?this.startsWith(n):o(this,function(n,t){return 0===n.indexOf(t[0])},[n],Mt)},equalsIgnoreCase:function(n){return o(this,function(n,t){return n===t[0]},[n],"")},anyOfIgnoreCase:function(){var n=w.apply(zn,arguments);return 0===n.length?t(this):o(this,function(n,t){return-1!==t.indexOf(n)},n,"")},startsWithAnyOfIgnoreCase:function(){var n=w.apply(zn,arguments);return 0===n.length?t(this):o(this,function(n,t){return t.some(function(t){return 0===n.indexOf(t)})},n,Mt)},anyOf:function(){var e=w.apply(zn,arguments),r=an;try{e.sort(r)}catch(t){return n(this,Ut)}if(0===e.length)return t(this);var i=new Q(this,function(){return Rn.bound(e[0],e[e.length-1])});i._ondirectionchange=function(n){r="next"===n?an:cn,e.sort(r)};var o=0;return i._addAlgorithm(function(n,t,i){for(var u=n.key;r(u,e[o])>0;)if(++o===e.length)return t(i),!1;return 0===r(u,e[o])||(t(function(){n.continue(e[o])}),!1)}),i},notEqual:function(n){return this.inAnyRange([[Rt,n],[n,qt]],{includeLowers:!1,includeUppers:!1})},noneOf:function(){var t=w.apply(zn,arguments);if(0===t.length)return new Q(this);try{t.sort(an)}catch(t){return n(this,Ut)}var e=t.reduce(function(n,t){return n?n.concat([[n[n.length-1][1],t]]):[[Rt,t]]},null);return e.push([t[t.length-1],qt]),this.inAnyRange(e,{includeLowers:!1,includeUppers:!1})},inAnyRange:function(e,r){function i(n,t){for(var e=0,r=n.length;e<r;++e){var i=n[e];if(Z(t[0],i[1])<0&&Z(t[1],i[0])>0){i[0]=nn(i[0],t[0]),i[1]=tn(i[1],t[1]);break}}return e===r&&n.push(t),n}function o(n,t){return f(n[0],t[0])}function u(n){return!h(n)&&!d(n)}if(0===e.length)return t(this);if(!e.every(function(n){return void 0!==n[0]&&void 0!==n[1]&&an(n[0],n[1])<=0}))return n(this,"First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower",Zn.InvalidArgument);var a,c=!r||!1!==r.includeLowers,s=r&&!0===r.includeUppers,f=an;try{a=e.reduce(i,[]),a.sort(o)}catch(t){return n(this,Ut)}var l=0,h=s?function(n){return an(n,a[l][1])>0}:function(n){return an(n,a[l][1])>=0},d=c?function(n){return cn(n,a[l][0])>0}:function(n){return cn(n,a[l][0])>=0},v=h,p=new Q(this,function(){return Rn.bound(a[0][0],a[a.length-1][1],!c,!s)});return p._ondirectionchange=function(n){"next"===n?(v=h,f=an):(v=d,f=cn),a.sort(o)},p._addAlgorithm(function(n,t,e){for(var r=n.key;v(r);)if(++l===a.length)return t(e),!1;return!!u(r)||0!==Z(r,a[l][1])&&0!==Z(r,a[l][0])&&(t(function(){f===an?n.continue(a[l][0]):n.continue(a[l][1])}),!1)}),p},startsWithAnyOf:function(){var e=w.apply(zn,arguments);return e.every(function(n){return"string"==typeof n})?0===e.length?t(this):this.inAnyRange(e.map(function(n){return[n,n+Mt]})):n(this,"startsWithAnyOf() only works with strings")}}}),e(Q.prototype,function(){function e(n,t){n.filter=ln(n.filter,t)}function r(n,t,e){var r=n.replayFilter;n.replayFilter=r?function(){return ln(r(),t())}:t,n.justLimit=e&&!r}function i(n,t){n.isMatch=ln(n.isMatch,t)}function o(n,t){if(n.isPrimKey)return t;var e=n.table.schema.idxByName[n.index];if(!e)throw new Zn.Schema("KeyPath "+n.index+" on object store "+t.name+" is not indexed");return t.index(e.name)}function u(n,t){var e=o(n,t);return n.keysOnly&&"openKeyCursor"in e?e.openKeyCursor(n.range||null,n.dir+n.unique):e.openCursor(n.range||null,n.dir+n.unique)}function a(n,e,r,i,o){var a=n.replayFilter?ln(n.filter,n.replayFilter()):n.filter;n.or?function(){function c(){2==++l&&r()}function s(n,r,o){if(!a||a(r,o,c,i)){var u=r.primaryKey,s=""+u;"[object ArrayBuffer]"===s&&(s=""+new Uint8Array(u)),t(f,s)||(f[s]=!0,e(n,r,o))}}var f={},l=0;n.or._iterate(s,c,i,o),$(u(n,o),n.algorithm,s,c,i,!n.keysOnly&&n.valueMapper)}():$(u(n,o),ln(n.algorithm,a),e,r,i,!n.keysOnly&&n.valueMapper)}return{_read:function(n,t){var e=this._ctx;return e.error?e.table._trans(null,Ft.bind(null,e.error)):e.table._idbstore("readonly",n).then(t)},_write:function(n){var t=this._ctx;return t.error?t.table._trans(null,Ft.bind(null,t.error)):t.table._idbstore(Xn,n,"locked")},_addAlgorithm:function(n){var t=this._ctx;t.algorithm=ln(t.algorithm,n)},_iterate:function(n,t,e,r){return a(this._ctx,n,t,e,r)},clone:function(t){var e=Object.create(this.constructor.prototype),r=Object.create(this._ctx);return t&&n(r,t),e._ctx=r,e},raw:function(){return this._ctx.valueMapper=null,this},each:function(n){var t=this._ctx;return this._read(function(e,r,i){a(t,n,e,r,i)})},count:function(n){var t=this._ctx;if(H(t,!0))return this._read(function(n,e,r){var i=o(t,r),u=t.range?i.count(t.range):i.count();u.onerror=kn(e),u.onsuccess=function(e){n(Math.min(e.target.result,t.limit))}},n);var e=0;return this._read(function(n,r,i){a(t,function(){return++e,!1},function(){n(e)},r,i)},n)},sortBy:function(n,t){function e(n,t){return t?e(n[i[t]],t-1):n[o]}function r(n,t){var r=e(n,u),i=e(t,u);return r<i?-a:r>i?a:0}var i=n.split(".").reverse(),o=i[0],u=i.length-1,a="next"===this._ctx.dir?1:-1;return this.toArray(function(n){return n.sort(r)}).then(t)},toArray:function(n){var t=this._ctx;return this._read(function(n,e,r){if(Tn&&"next"===t.dir&&H(t,!0)&&t.limit>0){var i=t.table.hook.reading.fire,u=o(t,r),c=t.limit<1/0?u.getAll(t.range,t.limit):u.getAll(t.range);c.onerror=kn(e),c.onsuccess=xn(i===I?n:function(t){try{n(t.map(i))}catch(n){e(n)}})}else{var s=[];a(t,function(n){s.push(n)},function(){n(s)},e,r)}},n)},offset:function(n){var t=this._ctx;return n<=0?this:(t.offset+=n,H(t)?r(t,function(){var t=n;return function(n,e){return 0===t||(1===t?(--t,!1):(e(function(){n.advance(t),t=0}),!1))}}):r(t,function(){var t=n;return function(){return--t<0}}),this)},limit:function(n){return this._ctx.limit=Math.min(this._ctx.limit,n),r(this._ctx,function(){var t=n;return function(n,e,r){return--t<=0&&e(r),t>=0}},!0),this},until:function(n,t){return e(this._ctx,function(e,r,i){return!n(e.value)||(r(i),t)}),this},first:function(n){return this.limit(1).toArray(function(n){return n[0]}).then(n)},last:function(n){return this.reverse().first(n)},filter:function(n){return e(this._ctx,function(t){return n(t.value)}),i(this._ctx,n),this},and:function(n){return this.filter(n)},or:function(n){return new W(this._ctx.table,n,this)},reverse:function(){return this._ctx.dir="prev"===this._ctx.dir?"next":"prev",this._ondirectionchange&&this._ondirectionchange(this._ctx.dir),this},desc:function(){return this.reverse()},eachKey:function(n){var t=this._ctx;return t.keysOnly=!t.isMatch,this.each(function(t,e){n(e.key,e)})},eachUniqueKey:function(n){return this._ctx.unique="unique",this.eachKey(n)},eachPrimaryKey:function(n){var t=this._ctx;return t.keysOnly=!t.isMatch,this.each(function(t,e){n(e.primaryKey,e)})},keys:function(n){var t=this._ctx;t.keysOnly=!t.isMatch;var e=[];return this.each(function(n,t){e.push(t.key)}).then(function(){return e}).then(n)},primaryKeys:function(n){var t=this._ctx;if(Tn&&"next"===t.dir&&H(t,!0)&&t.limit>0)return this._read(function(n,e,r){var i=o(t,r),u=t.limit<1/0?i.getAllKeys(t.range,t.limit):i.getAllKeys(t.range);u.onerror=kn(e),u.onsuccess=xn(n)}).then(n);t.keysOnly=!t.isMatch;var e=[];return this.each(function(n,t){e.push(t.primaryKey)}).then(function(){return e}).then(n)},uniqueKeys:function(n){return this._ctx.unique="unique",this.keys(n)},firstKey:function(n){return this.limit(1).keys(function(n){return n[0]}).then(n)},lastKey:function(n){return this.reverse().firstKey(n)},distinct:function(){var n=this._ctx,r=n.index&&n.table.schema.idxByName[n.index];if(!r||!r.multi)return this;var i={};return e(this._ctx,function(n){var e=n.primaryKey.toString(),r=t(i,e);return i[e]=!0,!r}),this},modify:function(e){var r=this,i=this._ctx,o=i.table.hook,u=o.updating.fire,a=o.deleting.fire;return this._write(function(i,o,c,s){function f(n,e){function r(n){return E.push(n),O.push(i.primKey),p(),!0}S=e.primaryKey;var i={primKey:e.primaryKey,value:n,onsuccess:null,onerror:null};if(!1!==m.call(i,n,i)){var o=!t(i,"value");++x,h(function(){var n=o?e.delete():e.update(i.value);n._hookCtx=i,n.onerror=jn(r),n.onsuccess=_n(function(){++j,p()})},r)}else i.onsuccess&&i.onsuccess(i.value)}function l(n){return n&&(E.push(n),O.push(S)),o(new A("Error modifying one or more objects",E,j,O))}function p(){P&&j+E.length===x&&(E.length>0?l():i(j))}var m;if("function"==typeof e)m=u===D&&a===D?e:function(n){var r=g(n);if(!1===e.call(this,n,this))return!1;if(t(this,"value")){var i=b(r,this.value),o=u.call(this,i,this.primKey,r,s);o&&(n=this.value,In(o).forEach(function(t){v(n,t,o[t])}))}else a.call(this,this.primKey,n,s)};else if(u===D){var w=In(e),_=w.length;m=function(n){for(var t=!1,r=0;r<_;++r){var i=w[r],o=e[i];d(n,i)!==o&&(v(n,i,o),t=!0)}return t}}else{var k=e;e=y(k),m=function(t){var r=!1,i=u.call(this,e,this.primKey,g(t),s);return i&&n(e,i),In(e).forEach(function(n){var i=e[n];d(t,n)!==i&&(v(t,n,i),r=!0)}),i&&(e=y(k)),r}}var x=0,j=0,P=!1,E=[],O=[],S=null;r.clone().raw()._iterate(f,function(){P=!0,p()},l,c)})},delete:function(){var n=this,t=this._ctx,e=t.range,r=t.table.hook.deleting.fire,i=r!==D;if(!i&&H(t)&&(t.isPrimKey&&!Qt||!e))return this._write(function(n,t,r){var i=kn(t),o=e?r.count(e):r.count();o.onerror=i,o.onsuccess=function(){var u=o.result;h(function(){var t=e?r.delete(e):r.clear();t.onerror=i,t.onsuccess=function(){return n(u)}},function(n){return t(n)})}});var o=i?2e3:1e4;return this._write(function(e,u,a,c){var s=0,f=n.clone({keysOnly:!t.isMatch&&!i}).distinct().limit(o).raw(),l=[],h=function(){return f.each(i?function(n,t){l.push([t.primaryKey,t.value])}:function(n,t){l.push(t.primaryKey)}).then(function(){return i?l.sort(function(n,t){return an(n[0],t[0])}):l.sort(an),z(a,c,l,i,r)}).then(function(){var n=l.length;return s+=n,l=[],n<o?s:h()})};e(h())})}}}),n(this,{Collection:Q,Table:U,Transaction:L,Version:s,WhereClause:W}),function(){nt.on("versionchange",function(n){n.newVersion>0?console.warn("Another connection wants to upgrade database '"+nt.name+"'. Closing db now to resume the upgrade."):console.warn("Another connection wants to delete database '"+nt.name+"'. Closing db now to resume the delete request."),nt.close()}),nt.on("blocked",function(n){!n.newVersion||n.newVersion<n.oldVersion?console.warn("Dexie.delete('"+nt.name+"') was blocked"):console.warn("Upgrade '"+nt.name+"' blocked by other connection holding version "+n.oldVersion/10)})}(),Nn.forEach(function(n){n(nt)})}function bn(n){if("function"==typeof n)return new n;if(Cn(n))return[bn(n[0])];if(n&&"object"==typeof n){var t={};return wn(t,n),t}return n}function wn(n,t){return In(t).forEach(function(e){var r=bn(t[e]);n[e]=r}),n}function _n(n){return en(function(t){var e=t.target,r=e._hookCtx,i=r.value||e.result,o=r&&r.onsuccess;o&&o(i),n&&n(i)},n)}function kn(n){return en(function(t){return Pn(t),n(t.target.error),!1})}function xn(n){return en(function(t){n(t.target.result)})}function jn(n){return en(function(t){var e=t.target,r=e.error,i=e._hookCtx,o=i&&i.onerror;return o&&o(r),Pn(t),n(r),!1})}function Pn(n){n.stopPropagation&&n.stopPropagation(),n.preventDefault&&n.preventDefault()}function En(n){function t(n){return function(t){var e=n(t),r=e.value;return e.done?r:r&&"function"==typeof r.then?r.then(i,o):Cn(r)?q.all(r).then(i,o):i(r)}}var e=function(t){return n.next(t)},r=function(t){return n.throw(t)},i=t(e),o=t(r);return t(e)()}function An(n,t,e,r,i,o,u){this.name=n,this.keyPath=t,this.unique=e,this.multi=r,this.auto=i,this.compound=o,this.dotted=u;var a="string"==typeof t?t:t&&"["+[].join.call(t,"+")+"]";this.src=(e?"&":"")+(r?"*":"")+(i?"++":"")+a}function On(n,t,e,r){this.name=n,this.primKey=t||new An,this.indexes=e||[new An],this.instanceTemplate=r,this.mappedClass=null,this.idxByName=f(e,function(n){return[n.name,n]})}function Sn(n){return 1===n.length?n[0]:n}function Dn(n){var t=n&&(n.getDatabaseNames||n.webkitGetDatabaseNames);return t&&t.bind(n)}var In=Object.keys,Cn=Array.isArray,Kn="undefined"!=typeof self?self:"undefined"!=typeof window?window:global,Tn=Object.getPrototypeOf,Bn={}.hasOwnProperty,Fn=Object.defineProperty,Nn=Object.getOwnPropertyDescriptor,Mn=[].slice,qn=[].concat,Rn="Boolean,String,Date,RegExp,Blob,File,FileList,ArrayBuffer,DataView,Uint8ClampedArray,ImageData,Map,Set".split(",").concat(m([8,16,32,64].map(function(n){return["Int","Uint","Float"].map(function(t){return t+n+"Array"})}))).filter(function(n){return Kn[n]}).map(function(n){return Kn[n]}),Un="undefined"!=typeof Symbol&&Symbol.iterator,Vn=Un?function(n){var t;return null!=n&&(t=n[Un])&&t.apply(n)}:function(){return null},zn={},Ln="undefined"!=typeof location&&/^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href),Wn=function(){return!0},Qn=!new Error("").stack,Hn=["Modify","Bulk","OpenFailed","VersionChange","Schema","Upgrade","InvalidTable","MissingAPI","NoSuchDatabase","InvalidArgument","SubTransaction","Unsupported","Internal","DatabaseClosed","PrematureCommit","ForeignAwait"],Gn=["Unknown","Constraint","Data","TransactionInactive","ReadOnly","Version","NotFound","InvalidState","InvalidAccess","Abort","Timeout","QuotaExceeded","Syntax","DataClone"],Jn=Hn.concat(Gn),Yn={VersionChanged:"Database version changed by other database connection",DatabaseClosed:"Database has been closed",Abort:"Transaction aborted",TransactionInactive:"Transaction has already completed or failed"};i(P).from(Error).extend({stack:{get:function(){return this._stack||(this._stack=this.name+": "+this.message+x(this._e,2))}},toString:function(){return this.name+": "+this.message}}),i(A).from(P),i(O).from(P);var $n=Jn.reduce(function(n,t){return n[t]=t+"Error",n},{}),Xn=P,Zn=Jn.reduce(function(n,t){function e(n,e){this._e=k(),this.name=r,n?"string"==typeof n?(this.message=n,this.inner=e||null):"object"==typeof n&&(this.message=n.name+" "+n.message,this.inner=n):(this.message=Yn[t]||r,this.inner=null)}var r=t+"Error";return i(e).from(Xn),n[t]=e,n},{});Zn.Syntax=SyntaxError,Zn.Type=TypeError,Zn.Range=RangeError;var nt=Gn.reduce(function(n,t){return n[t+"Error"]=Zn[t],n},{}),tt=Jn.reduce(function(n,t){return-1===["Syntax","Type","Range"].indexOf(t)&&(n[t+"Error"]=Zn[t]),n},{});tt.ModifyError=A,tt.DexieError=P,tt.BulkError=O;var et={},rt=100,it=7,ot=function(){try{return new Function("let F=async ()=>{},p=F();return [p,Object.getPrototypeOf(p),Promise.resolve(),F.constructor];")()}catch(t){var n=Kn.Promise;return n?[n.resolve(),n.prototype,n.resolve()]:[]}}(),ut=ot[0],at=ot[1],ct=ot[2],st=at&&at.then,ft=ut&&ut.constructor,lt=ot[3],ht=!!ct,dt=!1,vt=ct?function(){ct.then(G)}:Kn.setImmediate?setImmediate.bind(null,G):Kn.MutationObserver?function(){var n=document.createElement("div");new MutationObserver(function(){G(),n=null}).observe(n,{attributes:!0}),n.setAttribute("i","1")}:function(){setTimeout(G,0)},pt=function(n,t){jt.push([n,t]),mt&&(vt(),mt=!1)},yt=!0,mt=!0,gt=[],bt=[],wt=null,_t=I,kt={id:"global",global:!0,ref:0,unhandleds:[],onunhandled:yn,pgp:!1,env:{},finalize:function(){this.unhandleds.forEach(function(n){try{yn(n[0],n[1])}catch(n){}})}},xt=kt,jt=[],Pt=0,Et=[],At={get:function(){function n(n,r){var i=this,o=!t.global&&(t!==xt||e!==Kt);o&&un();var u=new q(function(e,u){L(i,new R(vn(n,t,o),vn(r,t,o),e,u,t))});return Ln&&H(u,this),u}var t=xt,e=Kt;return n.prototype=et,n},set:function(n){r(this,"then",n&&n.prototype===et?At:{get:function(){return n},set:At.set})}};e(q.prototype,{then:At,_then:function(n,t){L(this,new R(null,null,n,t,xt))},catch:function(n){if(1===arguments.length)return this.then(null,n);var t=arguments[0],e=arguments[1];return"function"==typeof t?this.then(null,function(n){return n instanceof t?e(n):tn(n)}):this.then(null,function(n){return n&&n.name===t?e(n):tn(n)})},finally:function(n){return this.then(function(t){return n(),t},function(t){return n(),tn(t)})},stack:{get:function(){if(this._stack)return this._stack;try{dt=!0;var n=Q(this,[],20),t=n.join("\nFrom previous: ");return null!==this._state&&(this._stack=t),t}finally{dt=!1}}},timeout:function(n,t){var e=this;return n<1/0?new q(function(r,i){var o=setTimeout(function(){return i(new Zn.Timeout(t))},n);e.then(r,i).finally(clearTimeout.bind(null,o))}):this}}),"undefined"!=typeof Symbol&&Symbol.toStringTag&&r(q.prototype,Symbol.toStringTag,"Promise"),kt.env=ln(),e(q,{all:function(){var n=w.apply(null,arguments).map(an);return new q(function(t,e){0===n.length&&t([]);var r=n.length;n.forEach(function(i,o){return q.resolve(i).then(function(e){n[o]=e,--r||t(n)},e)})})},resolve:function(n){if(n instanceof q)return n;if(n&&"function"==typeof n.then)return new q(function(t,e){n.then(t,e)});var t=new q(et,!0,n);return H(t,wt),t},reject:tn,race:function(){var n=w.apply(null,arguments).map(an);return new q(function(t,e){n.map(function(n){return q.resolve(n).then(t,e)})})},PSD:{get:function(){return xt},set:function(n){return xt=n}},newPSD:rn,usePSD:hn,scheduler:{get:function(){return pt},set:function(n){pt=n}},rejectionMapper:{get:function(){return _t},set:function(n){_t=n}},follow:function(n,t){return new q(function(e,r){return rn(function(t,e){var r=xt;r.unhandleds=[],r.onunhandled=e,r.finalize=K(function(){var n=this;X(function(){0===n.unhandleds.length?t():e(n.unhandleds[0])})},r.finalize),n()},t,e,r)})}});var Ot,St={awaits:0,echoes:0,id:0},Dt=0,It=[],Ct=0,Kt=0,Tt=0,Bt="unhandledrejection",Ft=q.reject,Nt="2.0.4",Mt=String.fromCharCode(65535),qt=function(){try{return IDBKeyRange.only([[]]),[[]]}catch(n){return Mt}}(),Rt=-1/0,Ut="Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.",Vt="String expected.",zt=[],Lt="undefined"!=typeof navigator&&/(MSIE|Trident|Edge)/.test(navigator.userAgent),Wt=Lt,Qt=Lt,Ht=function(n){return!/(dexie\.js|dexie\.min\.js)/.test(n)};return _(Ln,Ht),e(gn,tt),e(gn,{delete:function(n){var t=new gn(n),e=t.delete();return e.onblocked=function(n){return t.on("blocked",n),this},e},exists:function(n){return new gn(n).open().then(function(n){return n.close(),!0}).catch(gn.NoSuchDatabaseError,function(){return!1})},getDatabaseNames:function(n){var t=Dn(gn.dependencies.indexedDB);return t?new q(function(n,e){var r=t();r.onsuccess=function(t){n(u(t.target.result,0))},r.onerror=kn(e)}).then(n):Ot.dbnames.toCollection().primaryKeys(n)},defineClass:function(){function t(t){t&&n(this,t)}return t},applyStructure:wn,ignoreTransaction:function(n){return xt.trans?hn(xt.transless,n):n()},vip:function(n){return rn(function(){return xt.letThrough=!0,n()})},async:function(n){return function(){try{var t=En(n.apply(this,arguments));return t&&"function"==typeof t.then?t:q.resolve(t)}catch(n){return Ft(n)}}},spawn:function(n,t,e){try{var r=En(n.apply(e,t||[]));return r&&"function"==typeof r.then?r:q.resolve(r)}catch(n){return Ft(n)}},currentTransaction:{get:function(){return xt.trans||null}},waitFor:function(n,t){var e=q.resolve("function"==typeof n?gn.ignoreTransaction(n):n).timeout(t||6e4);return xt.trans?xt.trans.waitFor(e):e},Promise:q,debug:{get:function(){return Ln},set:function(n){_(n,"dexie"===n?function(){return!0}:Ht)}},derive:i,extend:n,props:e,override:a,Events:mn,getByKeyPath:d,setByKeyPath:v,delByKeyPath:p,shallowClone:y,deepClone:g,getObjectDiff:b,asap:s,maxKey:qt,minKey:Rt,addons:[],connections:zt,MultiModifyError:Zn.Modify,errnames:$n,IndexSpec:An,TableSchema:On,dependencies:function(){try{return{indexedDB:Kn.indexedDB||Kn.mozIndexedDB||Kn.webkitIndexedDB||Kn.msIndexedDB,IDBKeyRange:Kn.IDBKeyRange||Kn.webkitIDBKeyRange}}catch(n){return{indexedDB:null,IDBKeyRange:null}}}(),semVer:Nt,version:Nt.split(".").map(function(n){return parseInt(n)}).reduce(function(n,t,e){return n+t/Math.pow(10,2*e)}),default:gn,Dexie:gn}),q.rejectionMapper=S,Ot=new gn("__dbnames"),Ot.version(1).stores({dbnames:"name"}),function(){try{void 0!==typeof localStorage&&void 0!==Kn.document&&(JSON.parse(localStorage.getItem("Dexie.DatabaseNames")||"[]").forEach(function(n){return Ot.dbnames.put({name:n}).catch(D)}),localStorage.removeItem("Dexie.DatabaseNames"))}catch(n){}}(),gn});
//# sourceMappingURL=dexie.min.js.map
/*
 * [js-sha1]{@link https://github.com/emn178/js-sha1}
 *
 * @version 0.6.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
!function(){"use strict";function t(t){t?(f[0]=f[16]=f[1]=f[2]=f[3]=f[4]=f[5]=f[6]=f[7]=f[8]=f[9]=f[10]=f[11]=f[12]=f[13]=f[14]=f[15]=0,this.blocks=f):this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],this.h0=1732584193,this.h1=4023233417,this.h2=2562383102,this.h3=271733878,this.h4=3285377520,this.block=this.start=this.bytes=this.hBytes=0,this.finalized=this.hashed=!1,this.first=!0}var h="object"==typeof window?window:{},s=!h.JS_SHA1_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;s&&(h=global);var i=!h.JS_SHA1_NO_COMMON_JS&&"object"==typeof module&&module.exports,e="function"==typeof define&&define.amd,r="0123456789abcdef".split(""),o=[-2147483648,8388608,32768,128],n=[24,16,8,0],a=["hex","array","digest","arrayBuffer"],f=[],u=function(h){return function(s){return new t(!0).update(s)[h]()}},c=function(){var h=u("hex");s&&(h=p(h)),h.create=function(){return new t},h.update=function(t){return h.create().update(t)};for(var i=0;i<a.length;++i){var e=a[i];h[e]=u(e)}return h},p=function(t){var h=eval("require('crypto')"),s=eval("require('buffer').Buffer"),i=function(i){if("string"==typeof i)return h.createHash("sha1").update(i,"utf8").digest("hex");if(i.constructor===ArrayBuffer)i=new Uint8Array(i);else if(void 0===i.length)return t(i);return h.createHash("sha1").update(new s(i)).digest("hex")};return i};t.prototype.update=function(t){if(!this.finalized){var s="string"!=typeof t;s&&t.constructor===h.ArrayBuffer&&(t=new Uint8Array(t));for(var i,e,r=0,o=t.length||0,a=this.blocks;r<o;){if(this.hashed&&(this.hashed=!1,a[0]=this.block,a[16]=a[1]=a[2]=a[3]=a[4]=a[5]=a[6]=a[7]=a[8]=a[9]=a[10]=a[11]=a[12]=a[13]=a[14]=a[15]=0),s)for(e=this.start;r<o&&e<64;++r)a[e>>2]|=t[r]<<n[3&e++];else for(e=this.start;r<o&&e<64;++r)(i=t.charCodeAt(r))<128?a[e>>2]|=i<<n[3&e++]:i<2048?(a[e>>2]|=(192|i>>6)<<n[3&e++],a[e>>2]|=(128|63&i)<<n[3&e++]):i<55296||i>=57344?(a[e>>2]|=(224|i>>12)<<n[3&e++],a[e>>2]|=(128|i>>6&63)<<n[3&e++],a[e>>2]|=(128|63&i)<<n[3&e++]):(i=65536+((1023&i)<<10|1023&t.charCodeAt(++r)),a[e>>2]|=(240|i>>18)<<n[3&e++],a[e>>2]|=(128|i>>12&63)<<n[3&e++],a[e>>2]|=(128|i>>6&63)<<n[3&e++],a[e>>2]|=(128|63&i)<<n[3&e++]);this.lastByteIndex=e,this.bytes+=e-this.start,e>=64?(this.block=a[16],this.start=e-64,this.hash(),this.hashed=!0):this.start=e}return this.bytes>4294967295&&(this.hBytes+=this.bytes/4294967296<<0,this.bytes=this.bytes%4294967296),this}},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,h=this.lastByteIndex;t[16]=this.block,t[h>>2]|=o[3&h],this.block=t[16],h>=56&&(this.hashed||this.hash(),t[0]=this.block,t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.hBytes<<3|this.bytes>>>29,t[15]=this.bytes<<3,this.hash()}},t.prototype.hash=function(){var t,h,s=this.h0,i=this.h1,e=this.h2,r=this.h3,o=this.h4,n=this.blocks;for(t=16;t<80;++t)h=n[t-3]^n[t-8]^n[t-14]^n[t-16],n[t]=h<<1|h>>>31;for(t=0;t<20;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i&e|~i&r)+o+1518500249+n[t]<<0)<<5|o>>>27)+(s&(i=i<<30|i>>>2)|~s&e)+r+1518500249+n[t+1]<<0)<<5|r>>>27)+(o&(s=s<<30|s>>>2)|~o&i)+e+1518500249+n[t+2]<<0)<<5|e>>>27)+(r&(o=o<<30|o>>>2)|~r&s)+i+1518500249+n[t+3]<<0)<<5|i>>>27)+(e&(r=r<<30|r>>>2)|~e&o)+s+1518500249+n[t+4]<<0,e=e<<30|e>>>2;for(;t<40;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i^e^r)+o+1859775393+n[t]<<0)<<5|o>>>27)+(s^(i=i<<30|i>>>2)^e)+r+1859775393+n[t+1]<<0)<<5|r>>>27)+(o^(s=s<<30|s>>>2)^i)+e+1859775393+n[t+2]<<0)<<5|e>>>27)+(r^(o=o<<30|o>>>2)^s)+i+1859775393+n[t+3]<<0)<<5|i>>>27)+(e^(r=r<<30|r>>>2)^o)+s+1859775393+n[t+4]<<0,e=e<<30|e>>>2;for(;t<60;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i&e|i&r|e&r)+o-1894007588+n[t]<<0)<<5|o>>>27)+(s&(i=i<<30|i>>>2)|s&e|i&e)+r-1894007588+n[t+1]<<0)<<5|r>>>27)+(o&(s=s<<30|s>>>2)|o&i|s&i)+e-1894007588+n[t+2]<<0)<<5|e>>>27)+(r&(o=o<<30|o>>>2)|r&s|o&s)+i-1894007588+n[t+3]<<0)<<5|i>>>27)+(e&(r=r<<30|r>>>2)|e&o|r&o)+s-1894007588+n[t+4]<<0,e=e<<30|e>>>2;for(;t<80;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i^e^r)+o-899497514+n[t]<<0)<<5|o>>>27)+(s^(i=i<<30|i>>>2)^e)+r-899497514+n[t+1]<<0)<<5|r>>>27)+(o^(s=s<<30|s>>>2)^i)+e-899497514+n[t+2]<<0)<<5|e>>>27)+(r^(o=o<<30|o>>>2)^s)+i-899497514+n[t+3]<<0)<<5|i>>>27)+(e^(r=r<<30|r>>>2)^o)+s-899497514+n[t+4]<<0,e=e<<30|e>>>2;this.h0=this.h0+s<<0,this.h1=this.h1+i<<0,this.h2=this.h2+e<<0,this.h3=this.h3+r<<0,this.h4=this.h4+o<<0},t.prototype.hex=function(){this.finalize();var t=this.h0,h=this.h1,s=this.h2,i=this.h3,e=this.h4;return r[t>>28&15]+r[t>>24&15]+r[t>>20&15]+r[t>>16&15]+r[t>>12&15]+r[t>>8&15]+r[t>>4&15]+r[15&t]+r[h>>28&15]+r[h>>24&15]+r[h>>20&15]+r[h>>16&15]+r[h>>12&15]+r[h>>8&15]+r[h>>4&15]+r[15&h]+r[s>>28&15]+r[s>>24&15]+r[s>>20&15]+r[s>>16&15]+r[s>>12&15]+r[s>>8&15]+r[s>>4&15]+r[15&s]+r[i>>28&15]+r[i>>24&15]+r[i>>20&15]+r[i>>16&15]+r[i>>12&15]+r[i>>8&15]+r[i>>4&15]+r[15&i]+r[e>>28&15]+r[e>>24&15]+r[e>>20&15]+r[e>>16&15]+r[e>>12&15]+r[e>>8&15]+r[e>>4&15]+r[15&e]},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,h=this.h1,s=this.h2,i=this.h3,e=this.h4;return[t>>24&255,t>>16&255,t>>8&255,255&t,h>>24&255,h>>16&255,h>>8&255,255&h,s>>24&255,s>>16&255,s>>8&255,255&s,i>>24&255,i>>16&255,i>>8&255,255&i,e>>24&255,e>>16&255,e>>8&255,255&e]},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(20),h=new DataView(t);return h.setUint32(0,this.h0),h.setUint32(4,this.h1),h.setUint32(8,this.h2),h.setUint32(12,this.h3),h.setUint32(16,this.h4),t};var y=c();i?module.exports=y:(h.sha1=y,e&&define(function(){return y}))}();
var ProjectStore = createStore();

window.addEventListener ('unhandledrejection', function (event) {
  event.preventDefault();
  var reason = event.reason;
  if (reason && reason.name === 'InvalidStateError') {
    ProjectStore = createStore();
  }
  console.warn('Unhandled promise rejection:', (reason && (reason.stack || reason)));
});

function createStore() {
  var store = new Dexie("ProjectStore");
  store.version(1).stores({
    projects: "pid, name, hash, repo",
    files: "id, &path, &fid, type, hash",
    folders: "id, &path, hash",
    data: "fid",
    libraries: "url",
    sessions: "pid",
    meta: "key"
  });
  return store;
}


var GitFileSystem = new GitFileSystemClass();

function GitFileSystemClass() {
  var store = ProjectStore;
  var self = this;
  var delayedReleases = {};
  self._readFile = true;
  self.readFile = _noop;
  self.rmdir = _noop;
  self.stat = _noop;
  self.unlink = _noop;
  self.writeFile = _noop;
  self.exists = exists;
  self.read = read;
  self.write = write;
  self.mkdir = mkdir;
  self.rm = rm;
  self.readdir = readdir;
  self.readdirDeep = readdirDeep;
  self.lstat = lstat;
  self.writelink = writelink;
  self.readlink = readlink;
  self.lock = lock;
  self.unlock = unlock;

  /**
   * Return true if a file exists, false if it doesn't exist.
   * Rethrows errors that aren't related to file existence.
   */
  function exists(filepath) {
    return store.files.get({path: filepath}).then(function (file) {
      if (file && !file.deleted) {
        return true;
      } else {
        return store.folders.get({path: filepath}).then(function (folder) {
          return folder && !folder.deleted;
        })
      }
    });
  }

  /**
   * Return the contents of a file if it exists, otherwise returns null.
   */
  function read(filepath, options) {
    options = options || {};
    return store.files.get({path: filepath}).then(function (file) {
      if (file) {
        var encoding = options.encoding;
        return store.data.get(file.fid).then(function (data) {
          var text = (data && data.text) || '';
          var dataEncoding = (data && data.encoding) || '';
          if (dataEncoding) {
            if (!encoding) {
              return Buffer.from(text, dataEncoding);
            } else {
              return Buffer.from(text, dataEncoding).toString(encoding);
            }
          } else {
            if (encoding === 'utf8') {
              return text;
            } else if (encoding) {
              return Buffer.from(text).toString(encoding);
            } else {
              return Buffer.from(text);
            }
          }
        });
      } else {
        return null;
      }
    })
  }

  /**
   * Make a directory (or series of nested directories) without throwing an error if it already exists.
   */
  function mkdir(filepath) {
    var folders = filepath.split('/');
    return folders.reduce(function (promise, name, index, array) {
      if (index === 0) {
        return promise;
      } else {
        var folderPath = array.slice(0, index + 1).join('/');
        return promise.then(function () {
          return store.folders.get({path: folderPath})
            .then(function (folder) {
              if (!folder) {
                return _mkdir(folderPath);
              }
              else if (folder.deleted) {
                return store.folders.update(folder.id, { deleted: false });
              }
            });
        });
      }
    }, Promise.resolve());
  }

  /**
   * Write a file (creating missing directories if need be) without throwing errors.
   */
  function write(filepath, contents, options) {
    options = options || {};
    return mkdir(_dirname(filepath)).then(function () {
      var data = {};
      var buffer = Buffer.from(contents);
      var writtenFile;
      return store.files.get({path: filepath})
        .then(function (file) {
          var hash = hashGitBlob(buffer);
          var time = Date.now();
          if (!file) {
            var id = data.fid = _id();
            writtenFile = {
              id: id,
              fid: id,
              path: filepath,
              hash: hash,
              remoteHash: hash,
              remotePath: filepath,
              ctimeMs: time,
              mtimeMs: time
            };
            return store.files.put(writtenFile);
          }
          else {
            var ctime = file.ctimeMs || time;
            data.fid = file.fid;
            writtenFile = {
              id: file.id,
              fid: file.fid,
              path: filepath,
              deleted: false,
              hash: hash,
              remoteHash: hash,
              remotePath: filepath,
              ctimeMs: ctime,
              mtimeMs: time
            };
            return store.files.update(file.id, {
              deleted: false,
              hash: hash,
              remoteHash: hash,
              remotePath: filepath,
              ctimeMs: ctime,
              mtimeMs: time
            });
          }
        })
        .then(function () {
          if (_isArrayBuffer(contents)) {
            // Quite good support: https://html5test.com/compare/browser/ie-10/chrome-30/chrome-40/firefox-30/safari-10.0.html
            data.remoteText = data.text = toArrayBuffer(buffer);
            data.remoteEncoding = data.encoding = 'binary';
          } else if (typeof contents === 'string') {
            data.remoteText = data.text = contents;
          }
          return store.data.put(data);
        })
        .then(function (result) {
          GlobalEmitter.emit("::write", { file: writtenFile });
          return result;
        });
    });
  }

  /**
   * Delete a file without throwing an error if it is already deleted.
   */
  function rm(filepath) {
    return store.files.get({path: filepath})
      .then(function (file) {
        if (file) {
          GlobalEmitter.emit("::remove", { file: file });
          return store.files.update(file.id, {
            deleted: true,
            ctimeMs: Date.now(),
            remotePath: null,
            remoteHash: null
          })
            .then(function () {
              return rmEmptyParent(filepath);
            });
        } else {
          return rmdir(filepath);
        }
      });
  }

  /**
   * Assume removing a directory.
   */
  function rmdir(filepath) {
    return store.folders.get({path: filepath})
      .then(function (folder) {
        if (folder) {
          GlobalEmitter.emit("::remove", { folder: folder });
          return store.folders.update(folder.id, {deleted: true})
            .then(function () {
              return Promise.all([
                store.files.where("path").startsWith(filepath + '/').modify(
                  {deleted: true, ctimeMs: Date.now(), remotePath: null, remoteHash: null}),
                store.folders.where("path").startsWith(filepath + '/').modify(
                  {deleted: true})
              ]);
            })
            .then(function () {
              return rmEmptyParent(filepath);
            });
        }
      });
  }

  function rmEmptyParent(filepath) {
    // if parent is left empty (contains no descendent files, delete it
    var parent = filepath.slice(0, filepath.lastIndexOf('/'));
    return store.files
      .where("path").startsWith(parent + '/')
      .and(function (file) {
        return !file.deleted;
      }).toArray()
      .then(function (files) {
        if (files.length === 0) {
          // start recursion (delete parent's parent if that is left empty)
          return rmdir(parent);
        }
      });
  }

  /**
   * Read a directory without throwing an error is the directory doesn't exist
   */
  function readdir(filepath) {
    return _readdirDeep(filepath, true).then(function (paths) {
      var l = filepath.length + 1;  // +1 for trailing slash
      return paths
        .map(function (path) {
          return path.slice(l);
        })
        .filter(function (path) {
          // Do not return children of children
          return path.indexOf('/') === -1;
        })
        .sort(compareStrings);
    });
  }

  /**
   * Return a flat list of all the files nested inside a directory
   */
  function readdirDeep(filepath) {
    return _readdirDeep(filepath, false);
  }

  function _readdirDeep(filepath, includeDirs) {
    filepath = normalizePath(filepath) + '/';
    return Promise.resolve(
      includeDirs ? store.folders.where("path").startsWith(filepath).toArray() : []
    ).then(function (folders) {
      return store.files.where("path").startsWith(filepath).toArray().then(function (files) {
        var children = [];
        if (folders) children = children.concat(folders);
        if (files) children = children.concat(files);

        return children
          .filter(function (child) {
            // Do not return marked deleted children
            return !child.deleted;
          })
          .map(function (child) {
            return child.path;
          });
      });
    });
  }

  /**
   * Return the Stats of a file/symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existance.
   */
  function lstat(filepath) {
    filepath = normalizePath(filepath);
    // Check if is root folder
    if (filepath.indexOf('/') === -1) return new Stats(FileType.DIRECTORY, 0);
    return store.files.get({path: filepath}).then(function (file) {
      if (file) {
        return new Stats(FileType.FILE, 1, null, 0, file.mtimeMs, file.ctimeMs);
      }
      else {
        return store.folders.get({path: filepath}).then(function (folder) {
          if (folder) {
            return new Stats(FileType.DIRECTORY, 0);
          } else {
            return null;
          }
        });
      }
    });

  }

  /**
   * Reads the contents of a symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existance.
   */
  function readlink(filename) {
  }

  /**
   * Write the contents of buffer to a symlink.
   */
  function writelink(filename, buffer) {
  }

  function lock(filename, triesLeft) {
    triesLeft = triesLeft === undefined ? 3 : triesLeft;
    // check to see if we still have it
    if (delayedReleases[filename]) {
      clearTimeout(delayedReleases[filename]);
      delete delayedReleases[filename];
      return;
    }
    if (triesLeft === 0) {
      throw new GitError(E.AcquireLockFileFail, { filename: filename })
    }
    return _mkdir(filename + '.lock')
      .catch(function () {
        return new Promise(function (resolve, reject) {
          setTimeout(function () {
            lock(filename, triesLeft - 1).then(resolve, reject);
          }, 100);
        });
      })
  }

  function unlock(filename, delayRelease) {
    delayRelease = delayRelease || 50;
    if (delayedReleases[filename]) {
      throw new GitError(E.DoubleReleaseLockFileFail, { filename: filename })
    }
    // Basically, we lie and say it was deleted ASAP.
    // But really we wait a bit to see if you want to acquire it again.
    delayedReleases.set(
      filename,
      setTimeout(function () {
        delete delayedReleases[filename];
        return store.folders.where("path").equals(filename).modify({deleted: true});
      }, delayRelease)
    )
  }

  /**
   * Generates a random ID.
   */
  function _id() {
    // From http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function hashGitBlob(buffer) {
    return sha1(Buffer.concat([
      Buffer.from('blob ' + buffer.buffer.byteLength.toString() + '\x00'),
      buffer
    ]));
  }

  function compareStrings(a, b) {
    // https://stackoverflow.com/a/40355107/2168416
    return -(a < b) || +(a > b)
  }

  /**
   * Remove any '.' in the path. For example: 'Path/.' -> 'Path'
   * @param {string} path
   */
  function normalizePath(path) {
    if (path.indexOf('\u0000') >= 0) {
      throw new Error('Path must be a string without null bytes.');
    } else if (path === '') {
      throw new Error('Path must not be empty.');
    }
    return path.split('/').filter(function (part) {
      return part !== '' && part !== '.';
    }).join('/');
  }

  function _dirname(path) {
    var last = path.lastIndexOf('/');
    if (last === -1) return '.';
    if (last === 0) return '/';
    return path.slice(0, last);
  }

  function _mkdir(path) {
    return store.folders.add({
      id: _id(),
      path: path
    });
  }

  function _noop() { }

  function _isArrayBuffer(value) {
    return value && value.buffer instanceof ArrayBuffer && value.byteLength !== undefined;
  }
}

/**
 * Indicates the type of the given file. Applied to 'mode'.
 */
var FileType = {
  FILE: 0x8000,
  DIRECTORY: 0x4000,
  SYMLINK: 0xA000
};

/**
 * Provides information about a particular entry in the file system.
 * @param itemType Type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
 * @param size Size of the item in bytes. For directories/symlinks,
 *   this is normally the size of the struct that represents the item.
 * @param mode Unix-style file mode (e.g. 0o644)
 * @param atimeMs time of last access, in milliseconds since epoch
 * @param mtimeMs time of last modification, in milliseconds since epoch
 * @param ctimeMs time of last time file status was changed, in milliseconds since epoch
 * @param birthtimeMs time of file creation, in milliseconds since epoch
 */
function Stats(
  itemType,
  size,
  mode,
  atimeMs,
  mtimeMs,
  ctimeMs,
  birthtimeMs
) {
  var self = this;
  self.size = size;

  var currentTime = 0;
  if (typeof (atimeMs) !== 'number') {
    currentTime = Date.now();
    atimeMs = currentTime;
  }
  if (typeof (mtimeMs) !== 'number') {
    if (!currentTime) {
      currentTime = Date.now();
    }
    mtimeMs = currentTime;
  }
  if (typeof (ctimeMs) !== 'number') {
    if (!currentTime) {
      currentTime = Date.now();
    }
    ctimeMs = currentTime;
  }
  if (typeof (birthtimeMs) !== 'number') {
    if (!currentTime) {
      currentTime = Date.now();
    }
    birthtimeMs = currentTime;
  }

  self.atimeMs = atimeMs;
  self.ctimeMs = ctimeMs;
  self.mtimeMs = mtimeMs;
  self.birthtimeMs = birthtimeMs;
  self.uid = 0;
  self.gid = 0;
  self.ino = 0;

  if (!mode) {
    switch (itemType) {
      case FileType.FILE:
        self.mode = 0x1a4;
        break;
      case FileType.DIRECTORY:
      default:
        self.mode = 0x1ff;
    }
  } else {
    self.mode = mode;
  }

  // Check if mode also includes top-most bits, which indicate the file's type.
  if (self.mode < 0x1000) {
    self.mode |= itemType;
  }

  Object.defineProperties(self, {
    atime: {
      get: function () {
        return new Date(self.atimeMs);
      }
    },
    mtime: {
      get: function () {
        return new Date(self.mtimeMs);
      }
    },
    ctime: {
      get: function () {
        return new Date(self.ctimeMs);
      }
    },
    birthtime: {
      get: function () {
        return new Date(self.birthtimeMs);
      }
    }
  });

  self.isFile = isFile;
  self.isDirectory = isDirectory;
  self.isSymbolicLink = isSymbolicLink;
  self.toBuffer = toBuffer;
  self.chmod = chmod;


  function toBuffer() {
    var buffer = Buffer.alloc(32);
    buffer.writeUInt32LE(self.size, 0);
    buffer.writeUInt32LE(self.mode, 4);
    buffer.writeDoubleLE(self.atime.getTime(), 8);
    buffer.writeDoubleLE(self.mtime.getTime(), 16);
    buffer.writeDoubleLE(self.ctime.getTime(), 24);
    return buffer;
  }

  /**
   * @return [Boolean] True if this item is a file.
   */
  function isFile() {
    return (self.mode & 0xF000) === FileType.FILE;
  }

  /**
   * @return [Boolean] True if this item is a directory.
   */
  function isDirectory() {
    return (self.mode & 0xF000) === FileType.DIRECTORY;
  }

  /**
   * @return [Boolean] True if this item is a symbolic link (only valid through lstat)
   */
  function isSymbolicLink() {
    return (self.mode & 0xF000) === FileType.SYMLINK;
  }

  /**
   * Change the mode of the file. We use this helper function to prevent messing
   * up the type of the file, which is encoded in mode.
   */
  function chmod(mode) {
    this.mode = (self.mode & 0xF000) | mode;
  }
}

/*
The MIT License

Copyright (c) 2016 John Hiesey

Permission is hereby granted, free of charge,
to any person obtaining a copy of this software and
associated documentation files (the "Software"), to
deal in the Software without restriction, including
without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom
the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
function toArrayBuffer(buf) {
  if (buf instanceof Uint8Array) {
		// If the buffer isn't a subarray, return the underlying ArrayBuffer
		if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
			return buf.buffer
		} else if (typeof buf.buffer.slice === 'function') {
			// Otherwise we need to get a proper copy
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
		}
	}

	if (Buffer.isBuffer(buf)) {
		// This is the slow version that will work with any Buffer
		// implementation (even in old browsers)
		var arrayCopy = new Uint8Array(buf.length)
		var len = buf.length
		for (var i = 0; i < len; i++) {
			arrayCopy[i] = buf[i]
		}
		return arrayCopy.buffer
	} else {
		throw new Error('Argument must be a Buffer')
	}
}

var fetch3 = self.fetch;
function fetch2(url, options) {
  options.headers = options.headers || {}
  if (options.body && options.body.byteLength) {
    options.headers['X-Request-Body'] = encodeURIComponent(options.body.toString('base64'));
  }
  options.headers['X-Proxy-To'] = url;
  return fetch3('/proxy', options); 
}
self.fetch = fetch2;