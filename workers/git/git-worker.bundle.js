(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.buffer = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{"base64-js":2,"ieee754":3}],2:[function(require,module,exports){
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

(function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):e.Dexie=t()})(this,function(){"use strict";var m=function(){return(m=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var i in t=arguments[n])Object.prototype.hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e}).apply(this,arguments)},_=Object.keys,p=Array.isArray,h="undefined"!=typeof self?self:"undefined"!=typeof window?window:global;function s(t,n){return"object"!=typeof n||_(n).forEach(function(e){t[e]=n[e]}),t}"undefined"==typeof Promise||h.Promise||(h.Promise=Promise);var i=Object.getPrototypeOf,n={}.hasOwnProperty;function c(e,t){return n.call(e,t)}function r(t,n){"function"==typeof n&&(n=n(i(t))),_(n).forEach(function(e){u(t,e,n[e])})}var o=Object.defineProperty;function u(e,t,n,r){o(e,t,s(n&&c(n,"get")&&"function"==typeof n.get?{get:n.get,set:n.set,configurable:!0}:{value:n,configurable:!0,writable:!0},r))}function a(t){return{from:function(e){return t.prototype=Object.create(e.prototype),u(t.prototype,"constructor",t),{extend:r.bind(null,t.prototype)}}}}var l=Object.getOwnPropertyDescriptor;var f=[].slice;function d(e,t,n){return f.call(e,t,n)}function y(e,t){return t(e)}function v(e){if(!e)throw new Error("Assertion Failed")}function g(e){h.setImmediate?setImmediate(e):setTimeout(e,0)}function w(e,t){if(c(e,t))return e[t];if(!t)return e;if("string"!=typeof t){for(var n=[],r=0,i=t.length;r<i;++r){var o=w(e,t[r]);n.push(o)}return n}var u=t.indexOf(".");if(-1!==u){var a=e[t.substr(0,u)];return void 0===a?void 0:w(a,t.substr(u+1))}}function k(e,t,n){if(e&&void 0!==t&&!("isFrozen"in Object&&Object.isFrozen(e)))if("string"!=typeof t&&"length"in t){v("string"!=typeof n&&"length"in n);for(var r=0,i=t.length;r<i;++r)k(e,t[r],n[r])}else{var o=t.indexOf(".");if(-1!==o){var u=t.substr(0,o),a=t.substr(o+1);if(""===a)void 0===n?p(e)&&!isNaN(parseInt(u))?e.splice(u,1):delete e[u]:e[u]=n;else{var s=e[u];s||(s=e[u]={}),k(s,a,n)}}else void 0===n?p(e)&&!isNaN(parseInt(t))?e.splice(t,1):delete e[t]:e[t]=n}}function b(e){var t={};for(var n in e)c(e,n)&&(t[n]=e[n]);return t}var t=[].concat;function x(e){return t.apply([],e)}var O="Boolean,String,Date,RegExp,Blob,File,FileList,ArrayBuffer,DataView,Uint8ClampedArray,ImageData,Map,Set".split(",").concat(x([8,16,32,64].map(function(t){return["Int","Uint","Float"].map(function(e){return e+t+"Array"})}))).filter(function(e){return h[e]}).map(function(e){return h[e]});function P(e){if(!e||"object"!=typeof e)return e;var t;if(p(e)){t=[];for(var n=0,r=e.length;n<r;++n)t.push(P(e[n]))}else if(0<=O.indexOf(e.constructor))t=e;else for(var i in t=e.constructor?Object.create(e.constructor.prototype):{},e)c(e,i)&&(t[i]=P(e[i]));return t}function E(r,i,o,u){return o=o||{},u=u||"",_(r).forEach(function(e){if(c(i,e)){var t=r[e],n=i[e];"object"==typeof t&&"object"==typeof n&&t&&n&&""+t.constructor==""+n.constructor?E(t,n,o,u+e+"."):t!==n&&(o[u+e]=i[e])}else o[u+e]=void 0}),_(i).forEach(function(e){c(r,e)||(o[u+e]=i[e])}),o}var j="undefined"!=typeof Symbol&&Symbol.iterator,K=j?function(e){var t;return null!=e&&(t=e[j])&&t.apply(e)}:function(){return null},C={};function A(e){var t,n,r,i;if(1===arguments.length){if(p(e))return e.slice();if(this===C&&"string"==typeof e)return[e];if(i=K(e)){for(n=[];!(r=i.next()).done;)n.push(r.value);return n}if(null==e)return[e];if("number"!=typeof(t=e.length))return[e];for(n=new Array(t);t--;)n[t]=e[t];return n}for(t=arguments.length,n=new Array(t);t--;)n[t]=arguments[t];return n}var S="undefined"!=typeof location&&/^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);function I(e,t){S=e,D=t}var D=function(){return!0},e=!new Error("").stack;function T(){if(e)try{throw new Error}catch(e){return e}return new Error}function B(e,t){var n=e.stack;return n?(t=t||0,0===n.indexOf(e.name)&&(t+=(e.name+e.message).split("\n").length),n.split("\n").slice(t).filter(D).map(function(e){return"\n"+e}).join("")):""}var R=["Unknown","Constraint","Data","TransactionInactive","ReadOnly","Version","NotFound","InvalidState","InvalidAccess","Abort","Timeout","QuotaExceeded","Syntax","DataClone"],F=["Modify","Bulk","OpenFailed","VersionChange","Schema","Upgrade","InvalidTable","MissingAPI","NoSuchDatabase","InvalidArgument","SubTransaction","Unsupported","Internal","DatabaseClosed","PrematureCommit","ForeignAwait"].concat(R),q={VersionChanged:"Database version changed by other database connection",DatabaseClosed:"Database has been closed",Abort:"Transaction aborted",TransactionInactive:"Transaction has already completed or failed"};function M(e,t){this._e=T(),this.name=e,this.message=t}function N(e,t){return e+". Errors: "+Object.keys(t).map(function(e){return t[e].toString()}).filter(function(e,t,n){return n.indexOf(e)===t}).join("\n")}function U(e,t,n,r){this._e=T(),this.failures=t,this.failedKeys=r,this.successCount=n,this.message=N(e,t)}function V(e,t){this._e=T(),this.name="BulkError",this.failures=t,this.message=N(e,t)}a(M).from(Error).extend({stack:{get:function(){return this._stack||(this._stack=this.name+": "+this.message+B(this._e,2))}},toString:function(){return this.name+": "+this.message}}),a(U).from(M),a(V).from(M);var W=F.reduce(function(e,t){return e[t]=t+"Error",e},{}),z=M,L=F.reduce(function(e,n){var r=n+"Error";function t(e,t){this._e=T(),this.name=r,e?"string"==typeof e?(this.message=e+(t?"\n "+t:""),this.inner=t||null):"object"==typeof e&&(this.message=e.name+" "+e.message,this.inner=e):(this.message=q[n]||r,this.inner=null)}return a(t).from(z),e[n]=t,e},{});L.Syntax=SyntaxError,L.Type=TypeError,L.Range=RangeError;var Y=R.reduce(function(e,t){return e[t+"Error"]=L[t],e},{});var G=F.reduce(function(e,t){return-1===["Syntax","Type","Range"].indexOf(t)&&(e[t+"Error"]=L[t]),e},{});function H(){}function Q(e){return e}function X(t,n){return null==t||t===Q?n:function(e){return n(t(e))}}function J(e,t){return function(){e.apply(this,arguments),t.apply(this,arguments)}}function $(i,o){return i===H?o:function(){var e=i.apply(this,arguments);void 0!==e&&(arguments[0]=e);var t=this.onsuccess,n=this.onerror;this.onsuccess=null,this.onerror=null;var r=o.apply(this,arguments);return t&&(this.onsuccess=this.onsuccess?J(t,this.onsuccess):t),n&&(this.onerror=this.onerror?J(n,this.onerror):n),void 0!==r?r:e}}function Z(n,r){return n===H?r:function(){n.apply(this,arguments);var e=this.onsuccess,t=this.onerror;this.onsuccess=this.onerror=null,r.apply(this,arguments),e&&(this.onsuccess=this.onsuccess?J(e,this.onsuccess):e),t&&(this.onerror=this.onerror?J(t,this.onerror):t)}}function ee(o,u){return o===H?u:function(e){var t=o.apply(this,arguments);s(e,t);var n=this.onsuccess,r=this.onerror;this.onsuccess=null,this.onerror=null;var i=u.apply(this,arguments);return n&&(this.onsuccess=this.onsuccess?J(n,this.onsuccess):n),r&&(this.onerror=this.onerror?J(r,this.onerror):r),void 0===t?void 0===i?void 0:i:s(t,i)}}function te(e,t){return e===H?t:function(){return!1!==t.apply(this,arguments)&&e.apply(this,arguments)}}function ne(i,o){return i===H?o:function(){var e=i.apply(this,arguments);if(e&&"function"==typeof e.then){for(var t=this,n=arguments.length,r=new Array(n);n--;)r[n]=arguments[n];return e.then(function(){return o.apply(t,r)})}return o.apply(this,arguments)}}G.ModifyError=U,G.DexieError=M,G.BulkError=V;var re={},ie=100,oe=7,ue=function(){try{return new Function("let F=async ()=>{},p=F();return [p,Object.getPrototypeOf(p),Promise.resolve(),F.constructor];")()}catch(e){var t=h.Promise;return t?[t.resolve(),t.prototype,t.resolve()]:[]}}(),ae=ue[0],se=ue[1],ce=ue[2],le=se&&se.then,fe=ae&&ae.constructor,he=ue[3],pe=!!ce,de=!1,ye=ce?function(){ce.then(Re)}:h.setImmediate?setImmediate.bind(null,Re):h.MutationObserver?function(){var e=document.createElement("div");new MutationObserver(function(){Re(),e=null}).observe(e,{attributes:!0}),e.setAttribute("i","1")}:function(){setTimeout(Re,0)},ve=function(e,t){Pe.push([e,t]),ge&&(ye(),ge=!1)},me=!0,ge=!0,be=[],_e=[],we=null,ke=Q,xe={id:"global",global:!0,ref:0,unhandleds:[],onunhandled:ot,pgp:!1,env:{},finalize:function(){this.unhandleds.forEach(function(e){try{ot(e[0],e[1])}catch(e){}})}},Oe=xe,Pe=[],Ee=0,je=[];function Ke(e){if("object"!=typeof this)throw new TypeError("Promises must be constructed via new");this._listeners=[],this.onuncatched=H,this._lib=!1;var t=this._PSD=Oe;if(S&&(this._stackHolder=T(),this._prev=null,this._numPrev=0),"function"!=typeof e){if(e!==re)throw new TypeError("Not a function");return this._state=arguments[1],this._value=arguments[2],void(!1===this._state&&Se(this,this._value))}this._state=null,this._value=null,++t.ref,function t(r,e){try{e(function(n){if(null===r._state){if(n===r)throw new TypeError("A promise cannot be resolved with itself.");var e=r._lib&&Fe();n&&"function"==typeof n.then?t(r,function(e,t){n instanceof Ke?n._then(e,t):n.then(e,t)}):(r._state=!0,r._value=n,Ie(r)),e&&qe()}},Se.bind(null,r))}catch(e){Se(r,e)}}(this,e)}var Ce={get:function(){var u=Oe,t=Ye;function e(n,r){var i=this,o=!u.global&&(u!==Oe||t!==Ye);o&&Xe();var e=new Ke(function(e,t){De(i,new Ae(nt(n,u,o),nt(r,u,o),e,t,u))});return S&&Be(e,this),e}return e.prototype=re,e},set:function(e){u(this,"then",e&&e.prototype===re?Ce:{get:function(){return e},set:Ce.set})}};function Ae(e,t,n,r,i){this.onFulfilled="function"==typeof e?e:null,this.onRejected="function"==typeof t?t:null,this.resolve=n,this.reject=r,this.psd=i}function Se(t,n){if(_e.push(n),null===t._state){var e=t._lib&&Fe();n=ke(n),t._state=!1,t._value=n,S&&null!==n&&"object"==typeof n&&!n._promise&&function(e,t,n){try{e.apply(null,n)}catch(e){t&&t(e)}}(function(){var e=function e(t,n){var r;return l(t,n)||(r=i(t))&&e(r,n)}(n,"stack");n._promise=t,u(n,"stack",{get:function(){return de?e&&(e.get?e.get.apply(n):e.value):t.stack}})}),function(t){be.some(function(e){return e._value===t._value})||be.push(t)}(t),Ie(t),e&&qe()}}function Ie(e){var t=e._listeners;e._listeners=[];for(var n=0,r=t.length;n<r;++n)De(e,t[n]);var i=e._PSD;--i.ref||i.finalize(),0===Ee&&(++Ee,ve(function(){0==--Ee&&Me()},[]))}function De(e,t){if(null!==e._state){var n=e._state?t.onFulfilled:t.onRejected;if(null===n)return(e._state?t.resolve:t.reject)(e._value);++t.psd.ref,++Ee,ve(Te,[n,e,t])}else e._listeners.push(t)}function Te(e,t,n){try{var r,i=(we=t)._value;t._state?r=e(i):(_e.length&&(_e=[]),r=e(i),-1===_e.indexOf(i)&&function(e){var t=be.length;for(;t;)if(be[--t]._value===e._value)return be.splice(t,1)}(t)),n.resolve(r)}catch(e){n.reject(e)}finally{we=null,0==--Ee&&Me(),--n.psd.ref||n.psd.finalize()}}function Be(e,t){var n=t?t._numPrev+1:0;n<ie&&(e._prev=t,e._numPrev=n)}function Re(){Fe()&&qe()}function Fe(){var e=me;return ge=me=!1,e}function qe(){var e,t,n;do{for(;0<Pe.length;)for(e=Pe,Pe=[],n=e.length,t=0;t<n;++t){var r=e[t];r[0].apply(null,r[1])}}while(0<Pe.length);ge=me=!0}function Me(){var e=be;be=[],e.forEach(function(e){e._PSD.onunhandled.call(null,e._value,e)});for(var t=je.slice(0),n=t.length;n;)t[--n]()}function Ne(e){return new Ke(re,!1,e)}function Ue(n,r){var i=Oe;return function(){var e=Fe(),t=Oe;try{return Ze(i,!0),n.apply(this,arguments)}catch(e){r&&r(e)}finally{Ze(t,!1),e&&qe()}}}r(Ke.prototype,{then:Ce,_then:function(e,t){De(this,new Ae(null,null,e,t,Oe))},catch:function(e){if(1===arguments.length)return this.then(null,e);var t=e,n=arguments[1];return"function"==typeof t?this.then(null,function(e){return e instanceof t?n(e):Ne(e)}):this.then(null,function(e){return e&&e.name===t?n(e):Ne(e)})},finally:function(t){return this.then(function(e){return t(),e},function(e){return t(),Ne(e)})},stack:{get:function(){if(this._stack)return this._stack;try{de=!0;var e=function e(t,n,r){if(n.length===r)return n;var i="";if(!1===t._state){var o,u,a=t._value;null!=a?(o=a.name||"Error",u=a.message||a,i=B(a,0)):(o=a,u=""),n.push(o+(u?": "+u:"")+i)}S&&((i=B(t._stackHolder,2))&&-1===n.indexOf(i)&&n.push(i),t._prev&&e(t._prev,n,r));return n}(this,[],20).join("\nFrom previous: ");return null!==this._state&&(this._stack=e),e}finally{de=!1}}},timeout:function(r,i){var o=this;return r<1/0?new Ke(function(e,t){var n=setTimeout(function(){return t(new L.Timeout(i))},r);o.then(e,t).finally(clearTimeout.bind(null,n))}):this}}),"undefined"!=typeof Symbol&&Symbol.toStringTag&&u(Ke.prototype,Symbol.toStringTag,"Promise"),xe.env=et(),r(Ke,{all:function(){var o=A.apply(null,arguments).map(Je);return new Ke(function(n,r){0===o.length&&n([]);var i=o.length;o.forEach(function(e,t){return Ke.resolve(e).then(function(e){o[t]=e,--i||n(o)},r)})})},resolve:function(n){if(n instanceof Ke)return n;if(n&&"function"==typeof n.then)return new Ke(function(e,t){n.then(e,t)});var e=new Ke(re,!0,n);return Be(e,we),e},reject:Ne,race:function(){var e=A.apply(null,arguments).map(Je);return new Ke(function(t,n){e.map(function(e){return Ke.resolve(e).then(t,n)})})},PSD:{get:function(){return Oe},set:function(e){return Oe=e}},newPSD:He,usePSD:tt,scheduler:{get:function(){return ve},set:function(e){ve=e}},rejectionMapper:{get:function(){return ke},set:function(e){ke=e}},follow:function(r,n){return new Ke(function(e,t){return He(function(t,n){var e=Oe;e.unhandleds=[],e.onunhandled=n,e.finalize=J(function(){var e=this;(function(t){je.push(function e(){t();je.splice(je.indexOf(e),1)}),++Ee,ve(function(){0==--Ee&&Me()},[])})(function(){0===e.unhandleds.length?t():n(e.unhandleds[0])})},e.finalize),r()},n,e,t)})}});var Ve={awaits:0,echoes:0,id:0},We=0,ze=[],Le=0,Ye=0,Ge=0;function He(e,t,n,r){var i=Oe,o=Object.create(i);o.parent=i,o.ref=0,o.global=!1,o.id=++Ge;var u=xe.env;o.env=pe?{Promise:Ke,PromiseProp:{value:Ke,configurable:!0,writable:!0},all:Ke.all,race:Ke.race,resolve:Ke.resolve,reject:Ke.reject,nthen:rt(u.nthen,o),gthen:rt(u.gthen,o)}:{},t&&s(o,t),++i.ref,o.finalize=function(){--this.parent.ref||this.parent.finalize()};var a=tt(o,e,n,r);return 0===o.ref&&o.finalize(),a}function Qe(){return Ve.id||(Ve.id=++We),++Ve.awaits,Ve.echoes+=oe,Ve.id}function Xe(e){!Ve.awaits||e&&e!==Ve.id||(0==--Ve.awaits&&(Ve.id=0),Ve.echoes=Ve.awaits*oe)}function Je(e){return Ve.echoes&&e&&e.constructor===fe?(Qe(),e.then(function(e){return Xe(),e},function(e){return Xe(),ut(e)})):e}function $e(){var e=ze[ze.length-1];ze.pop(),Ze(e,!1)}function Ze(e,t){var n=Oe;if((t?!Ve.echoes||Le++&&e===Oe:!Le||--Le&&e===Oe)||function(e){le.call(ae,e)}(t?function(e){++Ye,Ve.echoes&&0!=--Ve.echoes||(Ve.echoes=Ve.id=0),ze.push(Oe),Ze(e,!0)}.bind(null,e):$e),e!==Oe&&(Oe=e,n===xe&&(xe.env=et()),pe)){var r=xe.env.Promise,i=e.env;se.then=i.nthen,r.prototype.then=i.gthen,(n.global||e.global)&&(Object.defineProperty(h,"Promise",i.PromiseProp),r.all=i.all,r.race=i.race,r.resolve=i.resolve,r.reject=i.reject)}}function et(){var e=h.Promise;return pe?{Promise:e,PromiseProp:Object.getOwnPropertyDescriptor(h,"Promise"),all:e.all,race:e.race,resolve:e.resolve,reject:e.reject,nthen:se.then,gthen:e.prototype.then}:{}}function tt(e,t,n,r,i){var o=Oe;try{return Ze(e,!0),t(n,r,i)}finally{Ze(o,!1)}}function nt(t,n,r){return"function"!=typeof t?t:function(){var e=Oe;r&&Qe(),Ze(n,!0);try{return t.apply(this,arguments)}finally{Ze(e,!1)}}}function rt(n,r){return function(e,t){return n.call(this,nt(e,r,!1),nt(t,r,!1))}}var it="unhandledrejection";function ot(e,t){var n;try{n=t.onuncatched(e)}catch(e){}if(!1!==n)try{var r,i={promise:t,reason:e};if(h.document&&document.createEvent?((r=document.createEvent("Event")).initEvent(it,!0,!0),s(r,i)):h.CustomEvent&&s(r=new CustomEvent(it,{detail:i}),i),r&&h.dispatchEvent&&(dispatchEvent(r),!h.PromiseRejectionEvent&&h.onunhandledrejection))try{h.onunhandledrejection(r)}catch(e){}S&&r&&!r.defaultPrevented&&console.warn("Unhandled rejection: "+(e.stack||e))}catch(e){}}var ut=Ke.reject;function at(e){return!/(dexie\.js|dexie\.min\.js)/.test(e)}var st="3.0.0-alpha.8",ct=String.fromCharCode(65535),lt="Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.",ft="String expected.",ht=[],pt="undefined"!=typeof navigator&&/(MSIE|Trident|Edge)/.test(navigator.userAgent),dt=pt,yt=pt,vt="__dbnames",mt="readonly",gt="readwrite";function bt(e,t){return e?t?function(){return e.apply(this,arguments)&&t.apply(this,arguments)}:e:t}var _t={type:3,lower:-1/0,lowerOpen:!1,upper:[[]],upperOpen:!1},wt=function(){function e(){}return e.prototype._trans=function(e,r,t){var n=this._tx||Oe.trans,i=this.name;function o(e,t,n){if(!n.schema[i])throw new L.NotFound("Table "+i+" not part of transaction");return r(n.idbtrans,n)}var u=Fe();try{return n&&n.db===this.db?n===Oe.trans?n._promise(e,o,t):He(function(){return n._promise(e,o,t)},{trans:n,transless:Oe.transless||Oe}):function e(t,n,r,i){if(t._state.openComplete||Oe.letThrough){var o=t._createTransaction(n,r,t._dbSchema);try{o.create()}catch(e){return ut(e)}return o._promise(n,function(e,t){return He(function(){return Oe.trans=o,i(e,t,o)})}).then(function(e){return o._completion.then(function(){return e})})}if(!t._state.isBeingOpened){if(!t._options.autoOpen)return ut(new L.DatabaseClosed);t.open().catch(H)}return t._state.dbReadyPromise.then(function(){return e(t,n,r,i)})}(this.db,e,[this.name],o)}finally{u&&qe()}},e.prototype.get=function(t,e){var n=this;return t&&t.constructor===Object?this.where(t).first(e):this._trans("readonly",function(e){return n.core.get({trans:e,key:t}).then(function(e){return n.hook.reading.fire(e)})}).then(e)},e.prototype.where=function(u){if("string"==typeof u)return new this.db.WhereClause(this,u);if(p(u))return new this.db.WhereClause(this,"["+u.join("+")+"]");var n=_(u);if(1===n.length)return this.where(n[0]).equals(u[n[0]]);var e=this.schema.indexes.concat(this.schema.primKey).filter(function(t){return t.compound&&n.every(function(e){return 0<=t.keyPath.indexOf(e)})&&t.keyPath.every(function(e){return 0<=n.indexOf(e)})})[0];if(e&&this.db._maxKey!==ct)return this.where(e.name).equals(e.keyPath.map(function(e){return u[e]}));!e&&S&&console.warn("The query "+JSON.stringify(u)+" on "+this.name+" would benefit of a compound index ["+n.join("+")+"]");var a=this.schema.idxByName,r=this.db._deps.indexedDB;function s(e,t){try{return 0===r.cmp(e,t)}catch(e){return!1}}var t=n.reduce(function(e,n){var t=e[0],r=e[1],i=a[n],o=u[n];return[t||i,t||!i?bt(r,i&&i.multi?function(e){var t=w(e,n);return p(t)&&t.some(function(e){return s(o,e)})}:function(e){return s(o,w(e,n))}):r]},[null,null]),i=t[0],o=t[1];return i?this.where(i.name).equals(u[i.keyPath]).filter(o):e?this.filter(o):this.where(n).equals("")},e.prototype.filter=function(e){return this.toCollection().and(e)},e.prototype.count=function(e){return this.toCollection().count(e)},e.prototype.offset=function(e){return this.toCollection().offset(e)},e.prototype.limit=function(e){return this.toCollection().limit(e)},e.prototype.each=function(e){return this.toCollection().each(e)},e.prototype.toArray=function(e){return this.toCollection().toArray(e)},e.prototype.toCollection=function(){return new this.db.Collection(new this.db.WhereClause(this))},e.prototype.orderBy=function(e){return new this.db.Collection(new this.db.WhereClause(this,p(e)?"["+e.join("+")+"]":e))},e.prototype.reverse=function(){return this.toCollection().reverse()},e.prototype.mapToClass=function(r){this.schema.mappedClass=r;function e(e){if(!e)return e;var t=Object.create(r.prototype);for(var n in e)if(c(e,n))try{t[n]=e[n]}catch(e){}return t}return this.schema.readHook&&this.hook.reading.unsubscribe(this.schema.readHook),this.schema.readHook=e,this.hook("reading",e),r},e.prototype.defineClass=function(){return this.mapToClass(function(e){s(this,e)})},e.prototype.add=function(t,n){var r=this;return this._trans("readwrite",function(e){return r.core.mutate({trans:e,type:"add",keys:null!=n?[n]:null,values:[t]})}).then(function(e){return e.numFailures?Ke.reject(e.failures[0]):e.lastResult}).then(function(e){if(!r.core.schema.primaryKey.outbound)try{k(t,r.core.schema.primaryKey.keyPath,e)}catch(e){}return e})},e.prototype.update=function(t,n){if("object"!=typeof n||p(n))throw new L.InvalidArgument("Modifications must be an object.");if("object"!=typeof t||p(t))return this.where(":id").equals(t).modify(n);_(n).forEach(function(e){k(t,e,n[e])});var e=w(t,this.schema.primKey.keyPath);return void 0===e?ut(new L.InvalidArgument("Given object does not contain its primary key")):this.where(":id").equals(e).modify(n)},e.prototype.put=function(t,n){var r=this;return this._trans("readwrite",function(e){return r.core.mutate({trans:e,type:"put",values:[t],keys:null!=n?[n]:null})}).then(function(e){return e.numFailures?Ke.reject(e.failures[0]):e.lastResult}).then(function(e){if(!r.core.schema.primaryKey.outbound)try{k(t,r.core.schema.primaryKey.keyPath,e)}catch(e){}return e})},e.prototype.delete=function(t){var n=this;return this._trans("readwrite",function(e){return n.core.mutate({trans:e,type:"delete",keys:[t]})}).then(function(e){return e.numFailures?Ke.reject(e.failures[0]):void 0})},e.prototype.clear=function(){var t=this;return this._trans("readwrite",function(e){return t.core.mutate({trans:e,type:"deleteRange",range:_t})}).then(function(e){return e.numFailures?Ke.reject(e.failures[0]):void 0})},e.prototype.bulkGet=function(t){var n=this;return this._trans("readonly",function(e){return n.core.getMany({keys:t,trans:e})})},e.prototype.bulkAdd=function(i,t){var o=this;return this._trans("readwrite",function(e){if(!o.core.schema.primaryKey.outbound&&t)throw new L.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");if(t&&t.length!==i.length)throw new L.InvalidArgument("Arguments objects and keys must have the same length");return o.core.mutate({trans:e,type:"add",keys:t,values:i}).then(function(e){var t=e.numFailures,n=e.lastResult,r=e.failures;if(0===t)return n;throw new V(o.name+".bulkAdd(): "+t+" of "+i.length+" operations failed",Object.keys(r).map(function(e){return r[e]}))})})},e.prototype.bulkPut=function(i,t){var o=this;return this._trans("readwrite",function(e){if(!o.core.schema.primaryKey.outbound&&t)throw new L.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");if(t&&t.length!==i.length)throw new L.InvalidArgument("Arguments objects and keys must have the same length");return o.core.mutate({trans:e,type:"put",keys:t,values:i}).then(function(e){var t=e.numFailures,n=e.lastResult,r=e.failures;if(0===t)return n;throw new V(o.name+".bulkPut(): "+t+" of "+i.length+" operations failed",Object.keys(r).map(function(e){return r[e]}))})})},e.prototype.bulkDelete=function(i){var o=this;return this._trans("readwrite",function(e){return o.core.mutate({trans:e,type:"delete",keys:i})}).then(function(e){var t=e.numFailures,n=e.lastResult,r=e.failures;if(0===t)return n;throw new V(o.name+".bulkDelete(): "+t+" of "+i.length+" operations failed",r)})},e}();function kt(i){var o={},t=function(e,t){if(t){for(var n=arguments.length,r=new Array(n-1);--n;)r[n-1]=arguments[n];return o[e].subscribe.apply(null,r),i}if("string"==typeof e)return o[e]};t.addEventType=u;for(var e=1,n=arguments.length;e<n;++e)u(arguments[e]);return t;function u(e,n,r){if("object"==typeof e)return function(r){_(r).forEach(function(e){var t=r[e];if(p(t))u(e,r[e][0],r[e][1]);else{if("asap"!==t)throw new L.InvalidArgument("Invalid event config");var n=u(e,Q,function(){for(var e=arguments.length,t=new Array(e);e--;)t[e]=arguments[e];n.subscribers.forEach(function(e){g(function(){e.apply(null,t)})})})}})}(e);n||(n=te),r||(r=H);var i={subscribers:[],fire:r,subscribe:function(e){-1===i.subscribers.indexOf(e)&&(i.subscribers.push(e),i.fire=n(i.fire,e))},unsubscribe:function(t){i.subscribers=i.subscribers.filter(function(e){return e!==t}),i.fire=i.subscribers.reduce(n,r)}};return o[e]=t[e]=i,i}}function xt(e,t){return a(t).from({prototype:e}),t}function Ot(e,t){return!(e.filter||e.algorithm||e.or)&&(t?e.justLimit:!e.replayFilter)}function Pt(e,t){e.filter=bt(e.filter,t)}function Et(e,t,n){var r=e.replayFilter;e.replayFilter=r?function(){return bt(r(),t())}:t,e.justLimit=n&&!r}function jt(e,t){if(e.isPrimKey)return t.primaryKey;var n=t.getIndexByKeyPath(e.index);if(!n)throw new L.Schema("KeyPath "+e.index+" on object store "+t.name+" is not indexed");return n}function Kt(e,t,n){var r=jt(e,t.schema);return t.openCursor({trans:n,values:!e.keysOnly,reverse:"prev"===e.dir,unique:!!e.unique,query:{index:r,range:e.range}})}function Ct(e,o,t,n){var u=e.replayFilter?bt(e.filter,e.replayFilter()):e.filter;if(e.or){var a={},r=function(e,t,n){if(!u||u(t,n,function(e){return t.stop(e)},function(e){return t.fail(e)})){var r=t.primaryKey,i=""+r;"[object ArrayBuffer]"===i&&(i=""+new Uint8Array(r)),c(a,i)||(a[i]=!0,o(e,t,n))}};return Promise.all([e.or._iterate(r,t),At(Kt(e,n,t),e.algorithm,r,!e.keysOnly&&e.valueMapper)])}return At(Kt(e,n,t),bt(e.algorithm,u),o,!e.keysOnly&&e.valueMapper)}function At(e,r,i,o){var u=Ue(o?function(e,t,n){return i(o(e),t,n)}:i);return e.then(function(n){if(n)return n.start(function(){var t=function(){return n.continue()};r&&!r(n,function(e){return t=e},function(e){n.stop(e),t=H},function(e){n.fail(e),t=H})||u(n.value,n,function(e){return t=e}),t()})})}var St=function(){function e(){}return e.prototype._read=function(e,t){var n=this._ctx;return n.error?n.table._trans(null,ut.bind(null,n.error)):n.table._trans("readonly",e).then(t)},e.prototype._write=function(e){var t=this._ctx;return t.error?t.table._trans(null,ut.bind(null,t.error)):t.table._trans("readwrite",e,"locked")},e.prototype._addAlgorithm=function(e){var t=this._ctx;t.algorithm=bt(t.algorithm,e)},e.prototype._iterate=function(e,t){return Ct(this._ctx,e,t,this._ctx.table.core)},e.prototype.clone=function(e){var t=Object.create(this.constructor.prototype),n=Object.create(this._ctx);return e&&s(n,e),t._ctx=n,t},e.prototype.raw=function(){return this._ctx.valueMapper=null,this},e.prototype.each=function(t){var n=this._ctx;return this._read(function(e){return Ct(n,t,e,n.table.core)})},e.prototype.count=function(e){var i=this;return this._read(function(e){var t=i._ctx,n=t.table.core;if(Ot(t,!0))return n.count({trans:e,query:{index:jt(t,n.schema),range:t.range}}).then(function(e){return Math.min(e,t.limit)});var r=0;return Ct(t,function(){return++r,!1},e,n).then(function(){return r})}).then(e)},e.prototype.sortBy=function(e,t){var n=e.split(".").reverse(),r=n[0],i=n.length-1;function o(e,t){return t?o(e[n[t]],t-1):e[r]}var u="next"===this._ctx.dir?1:-1;function a(e,t){var n=o(e,i),r=o(t,i);return n<r?-u:r<n?u:0}return this.toArray(function(e){return e.sort(a)}).then(t)},e.prototype.toArray=function(e){var o=this;return this._read(function(e){var t=o._ctx;if("next"===t.dir&&Ot(t,!0)&&0<t.limit){var n=t.valueMapper,r=jt(t,t.table.core.schema);return t.table.core.query({trans:e,limit:t.limit,values:!0,query:{index:r,range:t.range}}).then(function(e){var t=e.result;return n?t.map(n):t})}var i=[];return Ct(t,function(e){return i.push(e)},e,t.table.core).then(function(){return i})},e)},e.prototype.offset=function(t){var e=this._ctx;return t<=0||(e.offset+=t,Ot(e)?Et(e,function(){var n=t;return function(e,t){return 0===n||(1===n?--n:t(function(){e.advance(n),n=0}),!1)}}):Et(e,function(){var e=t;return function(){return--e<0}})),this},e.prototype.limit=function(e){return this._ctx.limit=Math.min(this._ctx.limit,e),Et(this._ctx,function(){var r=e;return function(e,t,n){return--r<=0&&t(n),0<=r}},!0),this},e.prototype.until=function(r,i){return Pt(this._ctx,function(e,t,n){return!r(e.value)||(t(n),i)}),this},e.prototype.first=function(e){return this.limit(1).toArray(function(e){return e[0]}).then(e)},e.prototype.last=function(e){return this.reverse().first(e)},e.prototype.filter=function(t){return Pt(this._ctx,function(e){return t(e.value)}),function(e,t){e.isMatch=bt(e.isMatch,t)}(this._ctx,t),this},e.prototype.and=function(e){return this.filter(e)},e.prototype.or=function(e){return new this.db.WhereClause(this._ctx.table,e,this)},e.prototype.reverse=function(){return this._ctx.dir="prev"===this._ctx.dir?"next":"prev",this._ondirectionchange&&this._ondirectionchange(this._ctx.dir),this},e.prototype.desc=function(){return this.reverse()},e.prototype.eachKey=function(n){var e=this._ctx;return e.keysOnly=!e.isMatch,this.each(function(e,t){n(t.key,t)})},e.prototype.eachUniqueKey=function(e){return this._ctx.unique="unique",this.eachKey(e)},e.prototype.eachPrimaryKey=function(n){var e=this._ctx;return e.keysOnly=!e.isMatch,this.each(function(e,t){n(t.primaryKey,t)})},e.prototype.keys=function(e){var t=this._ctx;t.keysOnly=!t.isMatch;var n=[];return this.each(function(e,t){n.push(t.key)}).then(function(){return n}).then(e)},e.prototype.primaryKeys=function(e){var n=this._ctx;if("next"===n.dir&&Ot(n,!0)&&0<n.limit)return this._read(function(e){var t=jt(n,n.table.core.schema);return n.table.core.query({trans:e,values:!1,limit:n.limit,query:{index:t,range:n.range}})}).then(function(e){return e.result}).then(e);n.keysOnly=!n.isMatch;var r=[];return this.each(function(e,t){r.push(t.primaryKey)}).then(function(){return r}).then(e)},e.prototype.uniqueKeys=function(e){return this._ctx.unique="unique",this.keys(e)},e.prototype.firstKey=function(e){return this.limit(1).keys(function(e){return e[0]}).then(e)},e.prototype.lastKey=function(e){return this.reverse().firstKey(e)},e.prototype.distinct=function(){var e=this._ctx,t=e.index&&e.table.schema.idxByName[e.index];if(!t||!t.multi)return this;var r={};return Pt(this._ctx,function(e){var t=e.primaryKey.toString(),n=c(r,t);return r[t]=!0,!n}),this},e.prototype.modify=function(c){var n=this,r=this._ctx;return this._write(function(h){var p;if("function"==typeof c)p=c;else{var o=_(c),u=o.length;p=function(e){for(var t=!1,n=0;n<u;++n){var r=o[n],i=c[r];w(e,r)!==i&&(k(e,r,i),t=!0)}return t}}function d(e,t){var n=t.failures,r=t.numFailures;for(var i in s+=e-r,n)a.push(n[i])}var y=r.table.core,e=y.schema.primaryKey,v=e.outbound,m=e.extractKey,g="testmode"in bn?1:2e3,b=n.db.core.cmp,a=[],s=0,t=[];return n.clone().primaryKeys().then(function(l){var f=function(s){var c=Math.min(g,l.length-s);return y.getMany({trans:h,keys:l.slice(s,s+c)}).then(function(e){for(var n=[],t=[],r=v?[]:null,i=[],o=0;o<c;++o){var u=e[o],a={value:P(u),primKey:l[s+o]};!1!==p.call(a,a.value,a)&&(null==a.value?i.push(l[s+o]):v||0===b(m(u),m(a.value))?(t.push(a.value),v&&r.push(l[s+o])):(i.push(l[s+o]),n.push(a.value)))}return Promise.resolve(0<n.length&&y.mutate({trans:h,type:"add",values:n}).then(function(e){for(var t in e.failures)i.splice(parseInt(t),1);d(n.length,e)})).then(function(e){return 0<t.length&&y.mutate({trans:h,type:"put",keys:r,values:t}).then(function(e){return d(t.length,e)})}).then(function(){return 0<i.length&&y.mutate({trans:h,type:"delete",keys:i}).then(function(e){return d(i.length,e)})}).then(function(){return l.length>s+c&&f(s+g)})})};return f(0).then(function(){if(0<a.length)throw new U("Error modifying one or more objects",a,s,t);return l.length})})})},e.prototype.delete=function(){var i=this._ctx,r=i.range;return Ot(i)&&(i.isPrimKey&&!yt||3===r.type)?this._write(function(e){var t=i.table.core.schema.primaryKey,n=r;return i.table.core.count({trans:e,query:{index:t,range:n}}).then(function(r){return i.table.core.mutate({trans:e,type:"deleteRange",range:n}).then(function(e){var t=e.failures,n=(e.lastResult,e.results,e.numFailures);if(n)throw new U("Could not delete some values",Object.keys(t).map(function(e){return t[e]}),r-n);return r-n})})}):this.modify(function(e,t){return t.value=null})},e}();function It(e,t){return e<t?-1:e===t?0:1}function Dt(e,t){return t<e?-1:e===t?0:1}function Tt(e,t,n){var r=e instanceof Nt?new e.Collection(e):e;return r._ctx.error=n?new n(t):new TypeError(t),r}function Bt(e){return new e.Collection(e,function(){return Mt("")}).limit(0)}function Rt(e,t,n,r,i,o){for(var u=Math.min(e.length,r.length),a=-1,s=0;s<u;++s){var c=t[s];if(c!==r[s])return i(e[s],n[s])<0?e.substr(0,s)+n[s]+n.substr(s+1):i(e[s],r[s])<0?e.substr(0,s)+r[s]+n.substr(s+1):0<=a?e.substr(0,a)+t[a]+n.substr(a+1):null;i(e[s],c)<0&&(a=s)}return u<r.length&&"next"===o?e+n.substr(e.length):u<e.length&&"prev"===o?e.substr(0,n.length):a<0?null:e.substr(0,a)+r[a]+n.substr(a+1)}function Ft(e,s,n,r){var i,c,l,f,h,p,d,y=n.length;if(!n.every(function(e){return"string"==typeof e}))return Tt(e,ft);function t(e){i=function(e){return"next"===e?function(e){return e.toUpperCase()}:function(e){return e.toLowerCase()}}(e),c=function(e){return"next"===e?function(e){return e.toLowerCase()}:function(e){return e.toUpperCase()}}(e),l="next"===e?It:Dt;var t=n.map(function(e){return{lower:c(e),upper:i(e)}}).sort(function(e,t){return l(e.lower,t.lower)});f=t.map(function(e){return e.upper}),h=t.map(function(e){return e.lower}),d="next"===(p=e)?"":r}t("next");var o=new e.Collection(e,function(){return qt(f[0],h[y-1]+r)});o._ondirectionchange=function(e){t(e)};var v=0;return o._addAlgorithm(function(e,t,n){var r=e.key;if("string"!=typeof r)return!1;var i=c(r);if(s(i,h,v))return!0;for(var o=null,u=v;u<y;++u){var a=Rt(r,i,f[u],h[u],l,p);null===a&&null===o?v=u+1:(null===o||0<l(o,a))&&(o=a)}return t(null!==o?function(){e.continue(o+d)}:n),!1}),o}function qt(e,t,n,r){return{type:2,lower:e,upper:t,lowerOpen:n,upperOpen:r}}function Mt(e){return{type:1,lower:e,upper:e}}var Nt=function(){function e(){}return Object.defineProperty(e.prototype,"Collection",{get:function(){return this._ctx.table.db.Collection},enumerable:!0,configurable:!0}),e.prototype.between=function(e,t,n,r){n=!1!==n,r=!0===r;try{return 0<this._cmp(e,t)||0===this._cmp(e,t)&&(n||r)&&(!n||!r)?Bt(this):new this.Collection(this,function(){return qt(e,t,!n,!r)})}catch(e){return Tt(this,lt)}},e.prototype.equals=function(e){return new this.Collection(this,function(){return Mt(e)})},e.prototype.above=function(e){return null==e?Tt(this,lt):new this.Collection(this,function(){return qt(e,void 0,!0)})},e.prototype.aboveOrEqual=function(e){return null==e?Tt(this,lt):new this.Collection(this,function(){return qt(e,void 0,!1)})},e.prototype.below=function(e){return null==e?Tt(this,lt):new this.Collection(this,function(){return qt(void 0,e,!1,!0)})},e.prototype.belowOrEqual=function(e){return null==e?Tt(this,lt):new this.Collection(this,function(){return qt(void 0,e)})},e.prototype.startsWith=function(e){return"string"!=typeof e?Tt(this,ft):this.between(e,e+ct,!0,!0)},e.prototype.startsWithIgnoreCase=function(e){return""===e?this.startsWith(e):Ft(this,function(e,t){return 0===e.indexOf(t[0])},[e],ct)},e.prototype.equalsIgnoreCase=function(e){return Ft(this,function(e,t){return e===t[0]},[e],"")},e.prototype.anyOfIgnoreCase=function(){var e=A.apply(C,arguments);return 0===e.length?Bt(this):Ft(this,function(e,t){return-1!==t.indexOf(e)},e,"")},e.prototype.startsWithAnyOfIgnoreCase=function(){var e=A.apply(C,arguments);return 0===e.length?Bt(this):Ft(this,function(t,e){return e.some(function(e){return 0===t.indexOf(e)})},e,ct)},e.prototype.anyOf=function(){var t=this,i=A.apply(C,arguments),o=this._cmp;try{i.sort(o)}catch(e){return Tt(this,lt)}if(0===i.length)return Bt(this);var e=new this.Collection(this,function(){return qt(i[0],i[i.length-1])});e._ondirectionchange=function(e){o="next"===e?t._ascending:t._descending,i.sort(o)};var u=0;return e._addAlgorithm(function(e,t,n){for(var r=e.key;0<o(r,i[u]);)if(++u===i.length)return t(n),!1;return 0===o(r,i[u])||(t(function(){e.continue(i[u])}),!1)}),e},e.prototype.notEqual=function(e){return this.inAnyRange([[-1/0,e],[e,this.db._maxKey]],{includeLowers:!1,includeUppers:!1})},e.prototype.noneOf=function(){var e=A.apply(C,arguments);if(0===e.length)return new this.Collection(this);try{e.sort(this._ascending)}catch(e){return Tt(this,lt)}var t=e.reduce(function(e,t){return e?e.concat([[e[e.length-1][1],t]]):[[-1/0,t]]},null);return t.push([e[e.length-1],this.db._maxKey]),this.inAnyRange(t,{includeLowers:!1,includeUppers:!1})},e.prototype.inAnyRange=function(e,t){var i=this,o=this._cmp,u=this._ascending,n=this._descending,a=this._min,s=this._max;if(0===e.length)return Bt(this);if(!e.every(function(e){return void 0!==e[0]&&void 0!==e[1]&&u(e[0],e[1])<=0}))return Tt(this,"First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower",L.InvalidArgument);var r=!t||!1!==t.includeLowers,c=t&&!0===t.includeUppers;var l,f=u;function h(e,t){return f(e[0],t[0])}try{(l=e.reduce(function(e,t){for(var n=0,r=e.length;n<r;++n){var i=e[n];if(o(t[0],i[1])<0&&0<o(t[1],i[0])){i[0]=a(i[0],t[0]),i[1]=s(i[1],t[1]);break}}return n===r&&e.push(t),e},[])).sort(h)}catch(e){return Tt(this,lt)}var p=0,d=c?function(e){return 0<u(e,l[p][1])}:function(e){return 0<=u(e,l[p][1])},y=r?function(e){return 0<n(e,l[p][0])}:function(e){return 0<=n(e,l[p][0])};var v=d,m=new this.Collection(this,function(){return qt(l[0][0],l[l.length-1][1],!r,!c)});return m._ondirectionchange=function(e){f="next"===e?(v=d,u):(v=y,n),l.sort(h)},m._addAlgorithm(function(e,t,n){for(var r=e.key;v(r);)if(++p===l.length)return t(n),!1;return!!function(e){return!d(e)&&!y(e)}(r)||(0===i._cmp(r,l[p][1])||0===i._cmp(r,l[p][0])||t(function(){f===u?e.continue(l[p][0]):e.continue(l[p][1])}),!1)}),m},e.prototype.startsWithAnyOf=function(){var e=A.apply(C,arguments);return e.every(function(e){return"string"==typeof e})?0===e.length?Bt(this):this.inAnyRange(e.map(function(e){return[e,e+ct]})):Tt(this,"startsWithAnyOf() only works with strings")},e}();function Ut(e){return 1===e.length?e[0]:e}function Vt(e){try{return e.only([[]]),[[]]}catch(e){return ct}}function Wt(t){return Ue(function(e){return zt(e),t(e.target.error),!1})}function zt(e){e.stopPropagation&&e.stopPropagation(),e.preventDefault&&e.preventDefault()}var Lt=function(){function e(){}return e.prototype._lock=function(){return v(!Oe.global),++this._reculock,1!==this._reculock||Oe.global||(Oe.lockOwnerFor=this),this},e.prototype._unlock=function(){if(v(!Oe.global),0==--this._reculock)for(Oe.global||(Oe.lockOwnerFor=null);0<this._blockedFuncs.length&&!this._locked();){var e=this._blockedFuncs.shift();try{tt(e[1],e[0])}catch(e){}}return this},e.prototype._locked=function(){return this._reculock&&Oe.lockOwnerFor!==this},e.prototype.create=function(t){var n=this;if(!this.mode)return this;var e=this.db.idbdb,r=this.db._state.dbOpenError;if(v(!this.idbtrans),!t&&!e)switch(r&&r.name){case"DatabaseClosedError":throw new L.DatabaseClosed(r);case"MissingAPIError":throw new L.MissingAPI(r.message,r);default:throw new L.OpenFailed(r)}if(!this.active)throw new L.TransactionInactive;return v(null===this._completion._state),(t=this.idbtrans=t||e.transaction(Ut(this.storeNames),this.mode)).onerror=Ue(function(e){zt(e),n._reject(t.error)}),t.onabort=Ue(function(e){zt(e),n.active&&n._reject(new L.Abort(t.error)),n.active=!1,n.on("abort").fire(e)}),t.oncomplete=Ue(function(){n.active=!1,n._resolve()}),this},e.prototype._promise=function(n,r,i){var o=this;if("readwrite"===n&&"readwrite"!==this.mode)return ut(new L.ReadOnly("Transaction is readonly"));if(!this.active)return ut(new L.TransactionInactive);if(this._locked())return new Ke(function(e,t){o._blockedFuncs.push([function(){o._promise(n,r,i).then(e,t)},Oe])});if(i)return He(function(){var e=new Ke(function(e,t){o._lock();var n=r(e,t,o);n&&n.then&&n.then(e,t)});return e.finally(function(){return o._unlock()}),e._lib=!0,e});var e=new Ke(function(e,t){var n=r(e,t,o);n&&n.then&&n.then(e,t)});return e._lib=!0,e},e.prototype._root=function(){return this.parent?this.parent._root():this},e.prototype.waitFor=function(e){var r=this._root(),i=Ke.resolve(e);if(r._waitingFor)r._waitingFor=r._waitingFor.then(function(){return i});else{r._waitingFor=i,r._waitingQueue=[];var t=r.idbtrans.objectStore(r.storeNames[0]);(function e(){for(++r._spinCount;r._waitingQueue.length;)r._waitingQueue.shift()();r._waitingFor&&(t.get(-1/0).onsuccess=e)})()}var o=r._waitingFor;return new Ke(function(t,n){i.then(function(e){return r._waitingQueue.push(Ue(t.bind(null,e)))},function(e){return r._waitingQueue.push(Ue(n.bind(null,e)))}).finally(function(){r._waitingFor===o&&(r._waitingFor=null)})})},e.prototype.abort=function(){this.active&&this._reject(new L.Abort),this.active=!1},e.prototype.table=function(e){var t=this._memoizedTables||(this._memoizedTables={});if(c(t,e))return t[e];var n=this.schema[e];if(!n)throw new L.NotFound("Table "+e+" not part of transaction");var r=new this.db.Table(e,n,this);return r.core=this.db.core.table(e),t[e]=r},e}();function Yt(e,t,n,r,i,o){return{name:e,keyPath:t,unique:n,multi:r,auto:i,compound:o,src:(n?"&":"")+(r?"*":"")+(i?"++":"")+Gt(t)}}function Gt(e){return"string"==typeof e?e:e?"["+[].join.call(e,"+")+"]":""}function Ht(e,t,n){return{name:e,primKey:t,indexes:n,mappedClass:null,idxByName:function(e,i){return e.reduce(function(e,t,n){var r=i(t,n);return r&&(e[r[0]]=r[1]),e},{})}(n,function(e){return[e.name,e]})}}function Qt(t){return null==t?function(){}:"string"==typeof t?function(t){return 1===t.split(".").length?function(e){return e[t]}:function(e){return w(e,t)}}(t):function(e){return w(e,t)}}function Xt(e,t){return"delete"===t.type?t.keys:t.keys||t.values.map(e.extractKey)}function Jt(e){return[].slice.call(e)}var $t=0;function Zt(e){return null==e?":id":"string"==typeof e?e:"["+e.join("+")+"]"}function en(e,t,o,n){var r=t.cmp.bind(t);function P(e){if(3===e.type)return null;if(4===e.type)throw new Error("Cannot convert never type to IDBKeyRange");var t=e.lower,n=e.upper,r=e.lowerOpen,i=e.upperOpen;return void 0===t?void 0===n?null:o.upperBound(n,!!i):void 0===n?o.lowerBound(t,!!r):o.bound(t,n,!!r,!!i)}var i,u,a,s=(u=n,a=Jt((i=e).objectStoreNames),{schema:{name:i.name,tables:a.map(function(e){return u.objectStore(e)}).map(function(t){var e=t.keyPath,n=t.autoIncrement,r=p(e),i=null==e,u={},o={name:t.name,primaryKey:{name:null,isPrimaryKey:!0,outbound:i,compound:r,keyPath:e,autoIncrement:n,unique:!0,extractKey:Qt(e)},indexes:Jt(t.indexNames).map(function(e){return t.index(e)}).map(function(e){var t=e.name,n=e.unique,r=e.multiEntry,i=e.keyPath,o={name:t,compound:p(i),keyPath:i,unique:n,multiEntry:r,extractKey:Qt(i)};return u[Zt(i)]=o}),getIndexByKeyPath:function(e){return u[Zt(e)]}};return u[":id"]=o.primaryKey,null!=e&&(u[Zt(e)]=o.primaryKey),o})},hasGetAll:0<a.length&&"getAll"in u.objectStore(a[0])&&!("undefined"!=typeof navigator&&/Safari/.test(navigator.userAgent)&&!/(Chrome\/|Edge\/)/.test(navigator.userAgent)&&[].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1]<604)}),c=s.schema,l=s.hasGetAll,f=c.tables.map(function(e){return function(x){var m,O=x.name;return{name:O,schema:x,mutate:function(e){var m=e.trans,g=e.type,b=e.keys,_=e.values,w=e.range,k=e.wantResults;return new Promise(function(n,e){n=Ue(n);var t=m.objectStore(O),r=null==t.keyPath,i="put"===g||"add"===g;if(!i&&"delete"!==g&&"deleteRange"!==g)throw new Error("Invalid operation type: "+g);var o=(b||_||{length:1}).length;if(b&&_&&b.length!==_.length)throw new Error("Given keys array must have same length as given values array.");if(0===o)return n({numFailures:0,failures:{},results:[],lastResult:void 0});function u(e){++f,zt(e),c&&(c[e.target._reqno]=void 0),l[e.target._reqno]=e.target.error}function a(e){var t=e.target;c[t._reqno]=t.result}var s,c=k&&(b||Xt(x.primaryKey,{type:g,keys:b,values:_})).slice(),l=[],f=0;if("deleteRange"===g){if(4===w.type)return n({numFailures:f,failures:l,results:c,lastResult:void 0});s=3===w.type?t.clear():t.delete(P(w))}else{var h=i?r?[_,b]:[_,null]:[b,null],p=h[0],d=h[1];if(i)for(var y=0;y<o;++y)(s=d&&void 0!==d[y]?t[g](p[y],d[y]):t[g](p[y]))._reqno=y,c&&void 0===c[y]&&(s.onsuccess=a),s.onerror=u;else for(y=0;y<o;++y)(s=t[g](p[y]))._reqno=y,s.onerror=u}function v(e){var t=e.target.result;c&&(c[o-1]=t),n({numFailures:f,failures:l,results:c,lastResult:t})}s.onerror=function(e){u(e),v(e)},s.onsuccess=v})},getMany:function(e){var f=e.trans,h=e.keys;return new Promise(function(n,e){n=Ue(n);for(var t,r=f.objectStore(O),i=h.length,o=new Array(i),u=0,a=0,s=function(e){var t=e.target;o[t._pos]=t.result,++a===u&&n(o)},c=Wt(e),l=0;l<i;++l)null!=h[l]&&((t=r.get(h[l]))._pos=l,t.onsuccess=s,t.onerror=c,++u);0===u&&n(o)})},get:function(e){var r=e.trans,i=e.key;return new Promise(function(t,e){t=Ue(t);var n=r.objectStore(O).get(i);n.onsuccess=function(e){return t(e.target.result)},n.onerror=Wt(e)})},query:(m=l,function(v){return new Promise(function(n,e){n=Ue(n);var t=v.trans,r=v.values,i=v.limit,o=v.query,u=i===1/0?void 0:i,a=o.index,s=o.range,c=t.objectStore(O),l=a.isPrimaryKey?c:c.index(a.name),f=P(s);if(0===i)return n({result:[]});if(m){var h=r?l.getAll(f,u):l.getAllKeys(f,u);h.onsuccess=function(e){return n({result:e.target.result})},h.onerror=Wt(e)}else{var p=0,d=!r&&"openKeyCursor"in l?l.openKeyCursor(f):l.openCursor(f),y=[];d.onsuccess=function(e){var t=d.result;return t?(y.push(r?t.value:t.primaryKey),++p===i?n({result:y}):void t.continue()):n({result:y})},d.onerror=Wt(e)}})}),openCursor:function(e){var c=e.trans,a=e.values,l=e.query,f=e.reverse,h=e.unique;return new Promise(function(t,n){t=Ue(t);var e=l.index,r=l.range,i=c.objectStore(O),o=e.isPrimaryKey?i:i.index(e.name),u=f?h?"prevunique":"prev":h?"nextunique":"next",s=!a&&"openKeyCursor"in o?o.openKeyCursor(P(r),u):o.openCursor(P(r),u);s.onerror=Wt(n),s.onsuccess=Ue(function(e){var r=s.result;if(r){r.___id=++$t,r.done=!1;var i=r.continue.bind(r),o=r.continuePrimaryKey;o&&(o=o.bind(r));var u=r.advance.bind(r),a=function(){throw new Error("Cursor not stopped")};r.trans=c,r.stop=r.continue=r.continuePrimaryKey=r.advance=function(){throw new Error("Cursor not started")},r.fail=Ue(n),r.next=function(){var e=this,t=1;return this.start(function(){return t--?e.continue():e.stop()}).then(function(){return e})},r.start=function(e){function t(){if(s.result)try{e()}catch(e){r.fail(e)}else r.done=!0,r.start=function(){throw new Error("Cursor behind last entry")},r.stop()}var n=new Promise(function(t,e){t=Ue(t),s.onerror=Wt(e),r.fail=e,r.stop=function(e){r.stop=r.continue=r.continuePrimaryKey=r.advance=a,t(e)}});return s.onsuccess=Ue(function(e){(s.onsuccess=t)()}),r.continue=i,r.continuePrimaryKey=o,r.advance=u,t(),n},t(r)}else t(null)},n)})},count:function(e){var t=e.query,u=e.trans,a=t.index,s=t.range;return new Promise(function(t,e){var n=u.objectStore(O),r=a.isPrimaryKey?n:n.index(a.name),i=P(s),o=i?r.count(i):r.count();o.onsuccess=Ue(function(e){return t(e.target.result)}),o.onerror=Wt(e)})}}}(e)}),h={};return f.forEach(function(e){return h[e.name]=e}),{stack:"dbcore",transaction:e.transaction.bind(e),table:function(e){if(!h[e])throw new Error("Table '"+e+"' not found");return h[e]},cmp:r,MIN_KEY:-1/0,MAX_KEY:Vt(o),schema:c}}function tn(e,t,n,r){var i=n.IDBKeyRange;return{dbcore:function(e,t){return t.reduce(function(e,t){var n=t.create;return m({},e,n(e))},e)}(en(t,n.indexedDB,i,r),e.dbcore)}}function nn(n,e){var t=e.db,r=tn(n._middlewares,t,n._deps,e);n.core=r.dbcore,n.tables.forEach(function(e){var t=e.name;n.core.schema.tables.some(function(e){return e.name===t})&&(e.core=n.core.table(t),n[t]instanceof n.Table&&(n[t].core=e.core))})}function rn(r,e,t,i){t.forEach(function(t){var n=i[t];e.forEach(function(e){t in e||(e===r.Transaction.prototype||e instanceof r.Transaction?u(e,t,{get:function(){return this.table(t)}}):e[t]=new r.Table(t,n))})})}function on(n,e){e.forEach(function(e){for(var t in e)e[t]instanceof n.Table&&delete e[t]})}function un(e,t){return e._cfg.version-t._cfg.version}function an(e,t,n,r){var i=e._dbSchema,o=e._createTransaction("readwrite",e._storeNames,i);o.create(n),o._completion.catch(r);var u=o._reject.bind(o),a=Oe.transless||Oe;He(function(){Oe.trans=o,Oe.transless=a,0===t?(_(i).forEach(function(e){sn(n,e,i[e].primKey,i[e].indexes)}),nn(e,n),Ke.follow(function(){return e.on.populate.fire(o)}).catch(u)):function(s,t,c,l){var n=[],e=s._versions,r=e.filter(function(e){return e._cfg.version===t})[0];if(!r)throw new L.Upgrade("Dexie specification of currently installed DB version is missing");var f=s._dbSchema=r._cfg.dbschema,h=!1;return e.filter(function(e){return e._cfg.version>t}).forEach(function(a){n.push(function(){var t=f,e=a._cfg.dbschema;ln(s,t,l),ln(s,e,l),f=s._dbSchema=e;var n=function(e,t){var n,r={del:[],add:[],change:[]};for(n in e)t[n]||r.del.push(n);for(n in t){var i=e[n],o=t[n];if(i){var u={name:n,def:o,recreate:!1,del:[],add:[],change:[]};if(i.primKey.src!==o.primKey.src)u.recreate=!0,r.change.push(u);else{var a=i.idxByName,s=o.idxByName,c=void 0;for(c in a)s[c]||u.del.push(c);for(c in s){var l=a[c],f=s[c];l?l.src!==f.src&&u.change.push(f):u.add.push(f)}(0<u.del.length||0<u.add.length||0<u.change.length)&&r.change.push(u)}}else r.add.push([n,o])}return r}(t,e);n.add.forEach(function(e){sn(l,e[0],e[1].primKey,e[1].indexes)}),n.change.forEach(function(e){if(e.recreate)throw new L.Upgrade("Not yet support for changing primary key");var t=l.objectStore(e.name);e.add.forEach(function(e){return cn(t,e)}),e.change.forEach(function(e){t.deleteIndex(e.name),cn(t,e)}),e.del.forEach(function(e){return t.deleteIndex(e)})});var r=a._cfg.contentUpgrade;if(r){nn(s,l),h=!0;var i,o=b(e);n.del.forEach(function(e){o[e]=t[e]}),on(s,[s.Transaction.prototype]),rn(s,[s.Transaction.prototype],_(o),o),c.schema=o,r.constructor===he&&Qe();var u=Ke.follow(function(){if((i=r(c))&&i.constructor===fe){var e=Xe.bind(null,null);i.then(e,e)}});return i&&"function"==typeof i.then?Ke.resolve(i):u.then(function(){return i})}}),n.push(function(e){h&&dt||function(e,t){for(var n=0;n<t.db.objectStoreNames.length;++n){var r=t.db.objectStoreNames[n];null==e[r]&&t.db.deleteObjectStore(r)}}(a._cfg.dbschema,e),on(s,[s.Transaction.prototype]),rn(s,[s.Transaction.prototype],s._storeNames,s._dbSchema),c.schema=s._dbSchema})}),function e(){return n.length?Ke.resolve(n.shift()(c.idbtrans)).then(e):Ke.resolve()}().then(function(){(function(t,n){_(t).forEach(function(e){n.db.objectStoreNames.contains(e)||sn(n,e,t[e].primKey,t[e].indexes)})})(f,l)})}(e,t,o,n).catch(u)})}function sn(e,t,n,r){var i=e.db.createObjectStore(t,n.keyPath?{keyPath:n.keyPath,autoIncrement:n.auto}:{autoIncrement:n.auto});return r.forEach(function(e){return cn(i,e)}),i}function cn(e,t){e.createIndex(t.name,t.keyPath,{unique:t.unique,multiEntry:t.multi})}function ln(e,t,n){for(var r=n.db.objectStoreNames,i=0;i<r.length;++i){var o=r[i],u=n.objectStore(o);e._hasGetAll="getAll"in u;for(var a=0;a<u.indexNames.length;++a){var s=u.indexNames[a],c=u.index(s).keyPath,l="string"==typeof c?c:"["+d(c).join("+")+"]";if(t[o]){var f=t[o].idxByName[l];f&&(f.name=s)}}}"undefined"!=typeof navigator&&/Safari/.test(navigator.userAgent)&&!/(Chrome\/|Edge\/)/.test(navigator.userAgent)&&h.WorkerGlobalScope&&h instanceof h.WorkerGlobalScope&&[].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1]<604&&(e._hasGetAll=!1)}var fn,hn=function(){function e(){}return e.prototype._parseStoresSpec=function(r,i){_(r).forEach(function(e){if(null!==r[e]){var t=function(e){var r=[];return e.split(",").forEach(function(e){var t=(e=e.trim()).replace(/([&*]|\+\+)/g,""),n=/^\[/.test(t)?t.match(/^\[(.*)\]$/)[1].split("+"):t;r.push(Yt(t,n||null,/\&/.test(e),/\*/.test(e),/\+\+/.test(e),p(n)))}),r}(r[e]),n=t.shift();if(n.multi)throw new L.Schema("Primary key cannot be multi-valued");t.forEach(function(e){if(e.auto)throw new L.Schema("Only primary key can be marked as autoIncrement (++)");if(!e.keyPath)throw new L.Schema("Index must have a name and cannot be an empty string")}),i[e]=Ht(e,n,t)}})},e.prototype.stores=function(e){var t=this.db;this._cfg.storesSource=this._cfg.storesSource?s(this._cfg.storesSource,e):e;var n=t._versions,r={};n.forEach(function(e){s(r,e._cfg.storesSource)});var i=this._cfg.dbschema={};return this._parseStoresSpec(r,i),t._dbSchema=i,on(t,[t._allTables,t,t.Transaction.prototype]),rn(t,[t._allTables,t,t.Transaction.prototype,this._cfg.tables],_(i),i),t._storeNames=_(i),this},e.prototype.upgrade=function(e){return this._cfg.contentUpgrade=e,this},e}();function pn(e){return He(function(){return Oe.letThrough=!0,e()})}function dn(a){var s=a._state,c=a._deps.indexedDB;if(s.isBeingOpened||a.idbdb)return s.dbReadyPromise.then(function(){return s.dbOpenError?ut(s.dbOpenError):a});S&&(s.openCanceller._stackHolder=T()),s.isBeingOpened=!0,s.dbOpenError=null,s.openComplete=!1;var e=s.dbReadyResolve,l=null;return Ke.race([s.openCanceller,new Ke(function(r,i){if(!c)throw new L.MissingAPI("indexedDB API not found. If using IE10+, make sure to run your code on a server URL (not locally). If using old Safari versions, make sure to include indexedDB polyfill.");var o=a.name,u=s.autoSchema?c.open(o):c.open(o,Math.round(10*a.verno));if(!u)throw new L.MissingAPI("IndexedDB API not available");u.onerror=Wt(i),u.onblocked=Ue(a._fireOnBlocked),u.onupgradeneeded=Ue(function(e){if(l=u.transaction,s.autoSchema&&!a._options.allowEmptyDB){u.onerror=zt,l.abort(),u.result.close();var t=c.deleteDatabase(o);t.onsuccess=t.onerror=Ue(function(){i(new L.NoSuchDatabase("Database "+o+" doesnt exist"))})}else{l.onerror=Wt(i);var n=e.oldVersion>Math.pow(2,62)?0:e.oldVersion;an(a,n/10,l,i)}},i),u.onsuccess=Ue(function(){l=null;var e=a.idbdb=u.result,t=d(e.objectStoreNames);if(0<t.length)try{var n=e.transaction(Ut(t),"readonly");s.autoSchema?function(e,t,s){e.verno=t.version/10;var c=e._dbSchema={},n=e._storeNames=d(t.objectStoreNames,0);0!==n.length&&(n.forEach(function(e){for(var t=s.objectStore(e),n=t.keyPath,r=Yt(Gt(n),n||"",!1,!1,!!t.autoIncrement,n&&"string"!=typeof n),i=[],o=0;o<t.indexNames.length;++o){var u=t.index(t.indexNames[o]);n=u.keyPath;var a=Yt(u.name,n,!!u.unique,!!u.multiEntry,!1,n&&"string"!=typeof n);i.push(a)}c[e]=Ht(e,r,i)}),rn(e,[e._allTables],_(c),c))}(a,e,n):ln(a,a._dbSchema,n),nn(a,n)}catch(e){}ht.push(a),e.onversionchange=Ue(function(e){s.vcFired=!0,a.on("versionchange").fire(e)}),fn.add(o),r()},i)})]).then(function(){return s.onReadyBeingFired=[],Ke.resolve(pn(a.on.ready.fire)).then(function e(){if(0<s.onReadyBeingFired.length){var t=s.onReadyBeingFired.reduce(ne,H);return s.onReadyBeingFired=[],Ke.resolve(pn(t)).then(e)}})}).finally(function(){s.onReadyBeingFired=null}).then(function(){return s.isBeingOpened=!1,a}).catch(function(e){try{l&&l.abort()}catch(e){}return s.isBeingOpened=!1,a.close(),s.dbOpenError=e,ut(s.dbOpenError)}).finally(function(){s.openComplete=!0,e()})}function yn(t){function e(e){return t.next(e)}var i=n(e),o=n(function(e){return t.throw(e)});function n(r){return function(e){var t=r(e),n=t.value;return t.done?n:n&&"function"==typeof n.then?n.then(i,o):p(n)?Promise.all(n).then(i,o):i(n)}}return n(e)()}function vn(e,t,n){p(e)||(e=[e]);for(var r=e.length,i=new Array(r+n),o=e.length+n-1;r<=o;--o)i[o]=t;return i}var mn={stack:"dbcore",name:"VirtualIndexMiddleware",level:1,create:function(f){return m({},f,{table:function(e){var o=f.table(e),t=o.schema,s={},c=[];function l(e,t,n){var r=Zt(e),i=s[r]=s[r]||[],o=null==e?0:"string"==typeof e?1:e.length,u=0<t,a=m({},n,{isVirtual:u,isPrimaryKey:!u&&n.isPrimaryKey,keyTail:t,keyLength:o,extractKey:Qt(e),unique:!u&&n.unique});return i.push(a),a.isPrimaryKey||c.push(a),1<o&&l(2===o?e[0]:e.slice(0,o-1),t+1,n),i.sort(function(e,t){return e.keyTail-t.keyTail}),a}var n=l(t.primaryKey.keyPath,0,t.primaryKey);s[":id"]=[n];for(var r=0,i=t.indexes;r<i.length;r++){var u=i[r];l(u.keyPath,0,u)}function a(e){var t=e.query.index;return t.isVirtual?m({},e,{query:{index:t,range:function(e,t){return{type:1===e.type?2:e.type,lower:vn(e.lower,e.lowerOpen?f.MAX_KEY:f.MIN_KEY,t),lowerOpen:!0,upper:vn(e.upper,e.upperOpen?f.MIN_KEY:f.MAX_KEY,t),upperOpen:!0}}(e.query.range,t.keyTail)}}):e}return m({},o,{schema:m({},t,{primaryKey:n,indexes:c,getIndexByKeyPath:function(e){var t=s[Zt(e)];return t&&t[0]}}),count:function(e){return o.count(a(e))},query:function(e){return o.query(a(e))},openCursor:function(t){var e=t.query.index,r=e.keyTail,n=e.isVirtual,i=e.keyLength;return n?o.openCursor(a(t)).then(function(e){return e&&function(n){return m({},n,{continue:function(e){null!=e?n.continue(vn(e,t.reverse?f.MAX_KEY:f.MIN_KEY,r)):t.unique?n.continue(vn(n.key,t.reverse?f.MIN_KEY:f.MAX_KEY,r)):n.continue()},continuePrimaryKey:function(e,t){n.continuePrimaryKey(vn(e,f.MAX_KEY,r),t)},get key(){var e=n.key;return 1===i?e[0]:e.slice(0,i)}})}(e)}):o.openCursor(t)}})}})}},gn={stack:"dbcore",name:"HooksMiddleware",level:2,create:function(e){return m({},e,{table:function(r){var a=e.table(r),v=a.schema.primaryKey;return m({},a,{mutate:function(e){var t=Oe.trans,n=t.table(r).hook,p=n.deleting,d=n.creating,y=n.updating;switch(e.type){case"add":if(d.fire===H)break;return t._promise("readwrite",function(){return u(e)},!0);case"put":if(d.fire===H&&y.fire===H)break;return t._promise("readwrite",function(){return u(e)},!0);case"delete":if(p.fire===H)break;return t._promise("readwrite",function(){return u(e)},!0);case"deleteRange":if(p.fire===H)break;return t._promise("readwrite",function(){return function(e){return function n(r,i,o){return a.query({trans:r,values:!1,query:{index:v,range:i},limit:o}).then(function(e){var t=e.result;return u({type:"delete",keys:t,trans:r}).then(function(e){return 0<e.numFailures?Promise.reject(e.failures[0]):t.length<o?{failures:[],numFailures:0,lastResult:void 0}:n(r,m({},i,{lower:t[t.length-1],lowerOpen:!0}),o)})})}(e.trans,e.range,1e4)}(e)},!0)}return a.mutate(e);function u(l){var f=Oe.trans,h=l.keys||Xt(v,l);if(!h)throw new Error("Keys missing");return"delete"!==(l="add"===l.type||"put"===l.type?m({},l,{keys:h,wantResults:!0}):m({},l)).type&&(l.values=l.values.slice()),l.keys&&(l.keys=l.keys.slice()),function(e,t,n){return"add"===t.type?Promise.resolve(new Array(t.values.length)):e.getMany({trans:t.trans,keys:n})}(a,l,h).then(function(s){var c=h.map(function(e,t){var n=s[t],r={onerror:null,onsuccess:null};if("delete"===l.type)p.fire.call(r,e,n,f);else if("add"===l.type||void 0===n){var i=d.fire.call(r,e,l.values[t],f);null==e&&null!=i&&(e=i,l.keys[t]=e,v.outbound||k(l.values[t],v.keyPath,e))}else{var o=E(n,l.values[t]),u=y.fire.call(r,o,e,n,f);if(u){var a=l.values[t];Object.keys(u).forEach(function(e){k(a,e,u[e])})}}return r});return a.mutate(l).then(function(e){for(var t=e.failures,n=e.results,r=e.numFailures,i=e.lastResult,o=0;o<h.length;++o){var u=n?n[o]:h[o],a=c[o];null==u?a.onerror&&a.onerror(t[o]):a.onsuccess&&a.onsuccess("put"===l.type&&s[o]?l.values[o]:u)}return{failures:t,results:n,numFailures:r,lastResult:i}}).catch(function(t){return c.forEach(function(e){return e.onerror&&e.onerror(t)}),Promise.reject(t)})})}}})}})}},bn=function(){function u(e,t){var o=this;this._middlewares={},this.verno=0;var n=u.dependencies;this._options=t=m({addons:u.addons,autoOpen:!0,indexedDB:n.indexedDB,IDBKeyRange:n.IDBKeyRange},t),this._deps={indexedDB:t.indexedDB,IDBKeyRange:t.IDBKeyRange};var r=t.addons;this._dbSchema={},this._versions=[],this._storeNames=[],this._allTables={};var i={dbOpenError:this.idbdb=null,isBeingOpened:!1,onReadyBeingFired:null,openComplete:!1,dbReadyResolve:H,dbReadyPromise:null,cancelOpen:H,openCanceller:null,autoSchema:!0};i.dbReadyPromise=new Ke(function(e){i.dbReadyResolve=e}),i.openCanceller=new Ke(function(e,t){i.cancelOpen=t}),this._state=i,this.name=e,this.on=kt(this,"populate","blocked","versionchange",{ready:[ne,H]}),this.on.ready.subscribe=y(this.on.ready.subscribe,function(i){return function(n,r){u.vip(function(){var e=o._state;if(e.openComplete)e.dbOpenError||Ke.resolve().then(n),r&&i(n);else if(e.onReadyBeingFired)e.onReadyBeingFired.push(n),r&&i(n);else{i(n);var t=o;r||i(function e(){t.on.ready.unsubscribe(n),t.on.ready.unsubscribe(e)})}})}}),this.Collection=function(a){return xt(St.prototype,function(e,t){this.db=a;var n=_t,r=null;if(t)try{n=t()}catch(e){r=e}var i=e._ctx,o=i.table,u=o.hook.reading.fire;this._ctx={table:o,index:i.index,isPrimKey:!i.index||o.schema.primKey.keyPath&&i.index===o.schema.primKey.name,range:n,keysOnly:!1,dir:"next",unique:"",algorithm:null,filter:null,replayFilter:null,justLimit:!0,isMatch:null,offset:0,limit:1/0,error:r,or:i.or,valueMapper:u!==Q?u:null}})}(this),this.Table=function(r){return xt(wt.prototype,function(e,t,n){this.db=r,this._tx=n,this.name=e,this.schema=t,this.hook=r._allTables[e]?r._allTables[e].hook:kt(null,{creating:[$,H],reading:[X,Q],updating:[ee,H],deleting:[Z,H]})})}(this),this.Transaction=function(o){return xt(Lt.prototype,function(e,t,n,r){var i=this;this.db=o,this.mode=e,this.storeNames=t,this.schema=n,this.idbtrans=null,this.on=kt(this,"complete","error","abort"),this.parent=r||null,this.active=!0,this._reculock=0,this._blockedFuncs=[],this._resolve=null,this._reject=null,this._waitingFor=null,this._waitingQueue=null,this._spinCount=0,this._completion=new Ke(function(e,t){i._resolve=e,i._reject=t}),this._completion.then(function(){i.active=!1,i.on.complete.fire()},function(e){var t=i.active;return i.active=!1,i.on.error.fire(e),i.parent?i.parent._reject(e):t&&i.idbtrans&&i.idbtrans.abort(),ut(e)})})}(this),this.Version=function(t){return xt(hn.prototype,function(e){this.db=t,this._cfg={version:e,storesSource:null,dbschema:{},tables:{},contentUpgrade:null},this.stores({})})}(this),this.WhereClause=function(i){return xt(Nt.prototype,function(e,t,n){this.db=i,this._ctx={table:e,index:":id"===t?null:t,or:n};var r=i._deps.indexedDB;if(!r)throw new L.MissingAPI("indexedDB API missing");this._cmp=this._ascending=r.cmp.bind(r),this._descending=function(e,t){return r.cmp(t,e)},this._max=function(e,t){return 0<r.cmp(e,t)?e:t},this._min=function(e,t){return r.cmp(e,t)<0?e:t},this._IDBKeyRange=i._deps.IDBKeyRange})}(this),this.on("versionchange",function(e){0<e.newVersion?console.warn("Another connection wants to upgrade database '"+o.name+"'. Closing db now to resume the upgrade."):console.warn("Another connection wants to delete database '"+o.name+"'. Closing db now to resume the delete request."),o.close()}),this.on("blocked",function(e){!e.newVersion||e.newVersion<e.oldVersion?console.warn("Dexie.delete('"+o.name+"') was blocked"):console.warn("Upgrade '"+o.name+"' blocked by other connection holding version "+e.oldVersion/10)}),this._maxKey=Vt(t.IDBKeyRange),this._createTransaction=function(e,t,n,r){return new o.Transaction(e,t,n,r)},this._fireOnBlocked=function(t){o.on("blocked").fire(t),ht.filter(function(e){return e.name===o.name&&e!==o&&!e._state.vcFired}).map(function(e){return e.on("versionchange").fire(t)})},this.use(mn),this.use(gn),r.forEach(function(e){return e(o)})}return u.prototype.version=function(t){if(t=Math.round(10*t)/10,this.idbdb||this._state.isBeingOpened)throw new L.Schema("Cannot add version when database is open");this.verno=Math.max(this.verno,t);var e=this._versions,n=e.filter(function(e){return e._cfg.version===t})[0];return n||(n=new this.Version(t),e.push(n),e.sort(un),this._state.autoSchema=!1,n)},u.prototype._whenReady=function(e){var n=this;return this._state.openComplete||Oe.letThrough?e():new Ke(function(e,t){if(!n._state.isBeingOpened){if(!n._options.autoOpen)return void t(new L.DatabaseClosed);n.open().catch(H)}n._state.dbReadyPromise.then(e,t)}).then(e)},u.prototype.use=function(e){var t=e.stack,n=e.create,r=e.level,i=e.name;i&&this.unuse({stack:t,name:i});var o=this._middlewares[t]||(this._middlewares[t]=[]);return o.push({stack:t,create:n,level:null==r?10:r,name:i}),o.sort(function(e,t){return e.level-t.level}),this},u.prototype.unuse=function(e){var t=e.stack,n=e.name,r=e.create;return t&&this._middlewares[t]&&(this._middlewares[t]=this._middlewares[t].filter(function(e){return r?e.create!==r:!!n&&e.name!==n})),this},u.prototype.open=function(){return dn(this)},u.prototype.close=function(){var e=ht.indexOf(this),n=this._state;if(0<=e&&ht.splice(e,1),this.idbdb){try{this.idbdb.close()}catch(e){}this.idbdb=null}this._options.autoOpen=!1,n.dbOpenError=new L.DatabaseClosed,n.isBeingOpened&&n.cancelOpen(n.dbOpenError),n.dbReadyPromise=new Ke(function(e){n.dbReadyResolve=e}),n.openCanceller=new Ke(function(e,t){n.cancelOpen=t})},u.prototype.delete=function(){var r=this,i=0<arguments.length,o=this._state;return new Ke(function(t,n){function e(){r.close();var e=r._deps.indexedDB.deleteDatabase(r.name);e.onsuccess=Ue(function(){fn.remove(r.name),t()}),e.onerror=Wt(n),e.onblocked=r._fireOnBlocked}if(i)throw new L.InvalidArgument("Arguments not allowed in db.delete()");o.isBeingOpened?o.dbReadyPromise.then(e):e()})},u.prototype.backendDB=function(){return this.idbdb},u.prototype.isOpen=function(){return null!==this.idbdb},u.prototype.hasBeenClosed=function(){var e=this._state.dbOpenError;return e&&"DatabaseClosed"===e.name},u.prototype.hasFailed=function(){return null!==this._state.dbOpenError},u.prototype.dynamicallyOpened=function(){return this._state.autoSchema},Object.defineProperty(u.prototype,"tables",{get:function(){var t=this;return _(this._allTables).map(function(e){return t._allTables[e]})},enumerable:!0,configurable:!0}),u.prototype.transaction=function(){var e=function(e,t,n){var r=arguments.length;if(r<2)throw new L.InvalidArgument("Too few arguments");for(var i=new Array(r-1);--r;)i[r-1]=arguments[r];return n=i.pop(),[e,x(i),n]}.apply(this,arguments);return this._transaction.apply(this,e)},u.prototype._transaction=function(e,t,n){var r=this,i=Oe.trans;i&&i.db===this&&-1===e.indexOf("!")||(i=null);var o,u,a=-1!==e.indexOf("?");e=e.replace("!","").replace("?","");try{if(u=t.map(function(e){var t=e instanceof r.Table?e.name:e;if("string"!=typeof t)throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");return t}),"r"==e||e===mt)o=mt;else{if("rw"!=e&&e!=gt)throw new L.InvalidArgument("Invalid transaction mode: "+e);o=gt}if(i){if(i.mode===mt&&o===gt){if(!a)throw new L.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");i=null}i&&u.forEach(function(e){if(i&&-1===i.storeNames.indexOf(e)){if(!a)throw new L.SubTransaction("Table "+e+" not included in parent transaction.");i=null}}),a&&i&&!i.active&&(i=null)}}catch(n){return i?i._promise(null,function(e,t){t(n)}):ut(n)}var s=function(o,u,a,s,c){return Ke.resolve().then(function(){var t,e=Oe.transless||Oe,n=o._createTransaction(u,a,o._dbSchema,s),r={trans:n,transless:e};s?n.idbtrans=s.idbtrans:n.create(),c.constructor===he&&Qe();var i=Ke.follow(function(){if(t=c.call(n,n))if(t.constructor===fe){var e=Xe.bind(null,null);t.then(e,e)}else"function"==typeof t.next&&"function"==typeof t.throw&&(t=yn(t))},r);return(t&&"function"==typeof t.then?Ke.resolve(t).then(function(e){return n.active?e:ut(new L.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn"))}):i.then(function(){return t})).then(function(e){return s&&n._resolve(),n._completion.then(function(){return e})}).catch(function(e){return n._reject(e),ut(e)})})}.bind(null,this,o,u,i,n);return i?i._promise(o,s,"lock"):Oe.trans?tt(Oe.transless,function(){return r._whenReady(s)}):this._whenReady(s)},u.prototype.table=function(e){if(!c(this._allTables,e))throw new L.InvalidTable("Table "+e+" does not exist");return this._allTables[e]},u}(),_n=bn;return r(_n,m({},G,{delete:function(e){return new _n(e).delete()},exists:function(e){return new _n(e,{addons:[]}).open().then(function(e){return e.close(),!0}).catch("NoSuchDatabaseError",function(){return!1})},getDatabaseNames:function(e){return fn?fn.getDatabaseNames().then(e):Ke.resolve([])},defineClass:function(){return function(e){s(this,e)}},ignoreTransaction:function(e){return Oe.trans?tt(Oe.transless,e):e()},vip:pn,async:function(t){return function(){try{var e=yn(t.apply(this,arguments));return e&&"function"==typeof e.then?e:Ke.resolve(e)}catch(e){return ut(e)}}},spawn:function(e,t,n){try{var r=yn(e.apply(n,t||[]));return r&&"function"==typeof r.then?r:Ke.resolve(r)}catch(e){return ut(e)}},currentTransaction:{get:function(){return Oe.trans||null}},waitFor:function(e,t){var n=Ke.resolve("function"==typeof e?_n.ignoreTransaction(e):e).timeout(t||6e4);return Oe.trans?Oe.trans.waitFor(n):n},Promise:Ke,debug:{get:function(){return S},set:function(e){I(e,"dexie"===e?function(){return!0}:at)}},derive:a,extend:s,props:r,override:y,Events:kt,getByKeyPath:w,setByKeyPath:k,delByKeyPath:function(t,e){"string"==typeof e?k(t,e,void 0):"length"in e&&[].map.call(e,function(e){k(t,e,void 0)})},shallowClone:b,deepClone:P,getObjectDiff:E,asap:g,minKey:-1/0,addons:[],connections:ht,errnames:W,dependencies:function(){try{return{indexedDB:h.indexedDB||h.mozIndexedDB||h.webkitIndexedDB||h.msIndexedDB,IDBKeyRange:h.IDBKeyRange||h.webkitIDBKeyRange}}catch(e){return{indexedDB:null,IDBKeyRange:null}}}(),semVer:st,version:st.split(".").map(function(e){return parseInt(e)}).reduce(function(e,t,n){return e+t/Math.pow(10,2*n)}),default:_n,Dexie:_n})),_n.maxKey=Vt(_n.dependencies.IDBKeyRange),function(e){try{fn=function(r){var t,i=r&&(r.getDatabaseNames||r.webkitGetDatabaseNames);if(!i){var e=new bn(vt,{addons:[]});e.version(1).stores({dbnames:"name"}),t=e.table("dbnames")}return{getDatabaseNames:function(){return i?new Ke(function(t,e){var n=i.call(r);n.onsuccess=function(e){return t(d(e.target.result,0))},n.onerror=Wt(e)}):t.toCollection().primaryKeys()},add:function(e){return!i&&e!==vt&&t.put({name:e}).catch(H)},remove:function(e){return!i&&e!==vt&&t.delete(e).catch(H)}}}(e)}catch(e){}}(bn.dependencies.indexedDB),Ke.rejectionMapper=function(e,t){if(!e||e instanceof M||e instanceof TypeError||e instanceof SyntaxError||!e.name||!Y[e.name])return e;var n=new Y[e.name](t||e.message,e);return"stack"in e&&u(n,"stack",{get:function(){return this.inner.stack}}),n},I(S,at),bn});
/*
 * [js-sha1]{@link https://github.com/emn178/js-sha1}
 *
 * @version 0.6.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
!function(){"use strict";function t(t){t?(f[0]=f[16]=f[1]=f[2]=f[3]=f[4]=f[5]=f[6]=f[7]=f[8]=f[9]=f[10]=f[11]=f[12]=f[13]=f[14]=f[15]=0,this.blocks=f):this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],this.h0=1732584193,this.h1=4023233417,this.h2=2562383102,this.h3=271733878,this.h4=3285377520,this.block=this.start=this.bytes=this.hBytes=0,this.finalized=this.hashed=!1,this.first=!0}var h="object"==typeof window?window:{},s=!h.JS_SHA1_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;s&&(h=global);var i=!h.JS_SHA1_NO_COMMON_JS&&"object"==typeof module&&module.exports,e="function"==typeof define&&define.amd,r="0123456789abcdef".split(""),o=[-2147483648,8388608,32768,128],n=[24,16,8,0],a=["hex","array","digest","arrayBuffer"],f=[],u=function(h){return function(s){return new t(!0).update(s)[h]()}},c=function(){var h=u("hex");s&&(h=p(h)),h.create=function(){return new t},h.update=function(t){return h.create().update(t)};for(var i=0;i<a.length;++i){var e=a[i];h[e]=u(e)}return h},p=function(t){var h=eval("require('crypto')"),s=eval("require('buffer').Buffer"),i=function(i){if("string"==typeof i)return h.createHash("sha1").update(i,"utf8").digest("hex");if(i.constructor===ArrayBuffer)i=new Uint8Array(i);else if(void 0===i.length)return t(i);return h.createHash("sha1").update(new s(i)).digest("hex")};return i};t.prototype.update=function(t){if(!this.finalized){var s="string"!=typeof t;s&&t.constructor===h.ArrayBuffer&&(t=new Uint8Array(t));for(var i,e,r=0,o=t.length||0,a=this.blocks;r<o;){if(this.hashed&&(this.hashed=!1,a[0]=this.block,a[16]=a[1]=a[2]=a[3]=a[4]=a[5]=a[6]=a[7]=a[8]=a[9]=a[10]=a[11]=a[12]=a[13]=a[14]=a[15]=0),s)for(e=this.start;r<o&&e<64;++r)a[e>>2]|=t[r]<<n[3&e++];else for(e=this.start;r<o&&e<64;++r)(i=t.charCodeAt(r))<128?a[e>>2]|=i<<n[3&e++]:i<2048?(a[e>>2]|=(192|i>>6)<<n[3&e++],a[e>>2]|=(128|63&i)<<n[3&e++]):i<55296||i>=57344?(a[e>>2]|=(224|i>>12)<<n[3&e++],a[e>>2]|=(128|i>>6&63)<<n[3&e++],a[e>>2]|=(128|63&i)<<n[3&e++]):(i=65536+((1023&i)<<10|1023&t.charCodeAt(++r)),a[e>>2]|=(240|i>>18)<<n[3&e++],a[e>>2]|=(128|i>>12&63)<<n[3&e++],a[e>>2]|=(128|i>>6&63)<<n[3&e++],a[e>>2]|=(128|63&i)<<n[3&e++]);this.lastByteIndex=e,this.bytes+=e-this.start,e>=64?(this.block=a[16],this.start=e-64,this.hash(),this.hashed=!0):this.start=e}return this.bytes>4294967295&&(this.hBytes+=this.bytes/4294967296<<0,this.bytes=this.bytes%4294967296),this}},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,h=this.lastByteIndex;t[16]=this.block,t[h>>2]|=o[3&h],this.block=t[16],h>=56&&(this.hashed||this.hash(),t[0]=this.block,t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.hBytes<<3|this.bytes>>>29,t[15]=this.bytes<<3,this.hash()}},t.prototype.hash=function(){var t,h,s=this.h0,i=this.h1,e=this.h2,r=this.h3,o=this.h4,n=this.blocks;for(t=16;t<80;++t)h=n[t-3]^n[t-8]^n[t-14]^n[t-16],n[t]=h<<1|h>>>31;for(t=0;t<20;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i&e|~i&r)+o+1518500249+n[t]<<0)<<5|o>>>27)+(s&(i=i<<30|i>>>2)|~s&e)+r+1518500249+n[t+1]<<0)<<5|r>>>27)+(o&(s=s<<30|s>>>2)|~o&i)+e+1518500249+n[t+2]<<0)<<5|e>>>27)+(r&(o=o<<30|o>>>2)|~r&s)+i+1518500249+n[t+3]<<0)<<5|i>>>27)+(e&(r=r<<30|r>>>2)|~e&o)+s+1518500249+n[t+4]<<0,e=e<<30|e>>>2;for(;t<40;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i^e^r)+o+1859775393+n[t]<<0)<<5|o>>>27)+(s^(i=i<<30|i>>>2)^e)+r+1859775393+n[t+1]<<0)<<5|r>>>27)+(o^(s=s<<30|s>>>2)^i)+e+1859775393+n[t+2]<<0)<<5|e>>>27)+(r^(o=o<<30|o>>>2)^s)+i+1859775393+n[t+3]<<0)<<5|i>>>27)+(e^(r=r<<30|r>>>2)^o)+s+1859775393+n[t+4]<<0,e=e<<30|e>>>2;for(;t<60;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i&e|i&r|e&r)+o-1894007588+n[t]<<0)<<5|o>>>27)+(s&(i=i<<30|i>>>2)|s&e|i&e)+r-1894007588+n[t+1]<<0)<<5|r>>>27)+(o&(s=s<<30|s>>>2)|o&i|s&i)+e-1894007588+n[t+2]<<0)<<5|e>>>27)+(r&(o=o<<30|o>>>2)|r&s|o&s)+i-1894007588+n[t+3]<<0)<<5|i>>>27)+(e&(r=r<<30|r>>>2)|e&o|r&o)+s-1894007588+n[t+4]<<0,e=e<<30|e>>>2;for(;t<80;t+=5)s=(h=(i=(h=(e=(h=(r=(h=(o=(h=s<<5|s>>>27)+(i^e^r)+o-899497514+n[t]<<0)<<5|o>>>27)+(s^(i=i<<30|i>>>2)^e)+r-899497514+n[t+1]<<0)<<5|r>>>27)+(o^(s=s<<30|s>>>2)^i)+e-899497514+n[t+2]<<0)<<5|e>>>27)+(r^(o=o<<30|o>>>2)^s)+i-899497514+n[t+3]<<0)<<5|i>>>27)+(e^(r=r<<30|r>>>2)^o)+s-899497514+n[t+4]<<0,e=e<<30|e>>>2;this.h0=this.h0+s<<0,this.h1=this.h1+i<<0,this.h2=this.h2+e<<0,this.h3=this.h3+r<<0,this.h4=this.h4+o<<0},t.prototype.hex=function(){this.finalize();var t=this.h0,h=this.h1,s=this.h2,i=this.h3,e=this.h4;return r[t>>28&15]+r[t>>24&15]+r[t>>20&15]+r[t>>16&15]+r[t>>12&15]+r[t>>8&15]+r[t>>4&15]+r[15&t]+r[h>>28&15]+r[h>>24&15]+r[h>>20&15]+r[h>>16&15]+r[h>>12&15]+r[h>>8&15]+r[h>>4&15]+r[15&h]+r[s>>28&15]+r[s>>24&15]+r[s>>20&15]+r[s>>16&15]+r[s>>12&15]+r[s>>8&15]+r[s>>4&15]+r[15&s]+r[i>>28&15]+r[i>>24&15]+r[i>>20&15]+r[i>>16&15]+r[i>>12&15]+r[i>>8&15]+r[i>>4&15]+r[15&i]+r[e>>28&15]+r[e>>24&15]+r[e>>20&15]+r[e>>16&15]+r[e>>12&15]+r[e>>8&15]+r[e>>4&15]+r[15&e]},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,h=this.h1,s=this.h2,i=this.h3,e=this.h4;return[t>>24&255,t>>16&255,t>>8&255,255&t,h>>24&255,h>>16&255,h>>8&255,255&h,s>>24&255,s>>16&255,s>>8&255,255&s,i>>24&255,i>>16&255,i>>8&255,255&i,e>>24&255,e>>16&255,e>>8&255,255&e]},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(20),h=new DataView(t);return h.setUint32(0,this.h0),h.setUint32(4,this.h1),h.setUint32(8,this.h2),h.setUint32(12,this.h3),h.setUint32(16,this.h4),t};var y=c();i?module.exports=y:(h.sha1=y,e&&define(function(){return y}))}();
/* exported ProjectStore */
var ProjectStore = createStore();

window.addEventListener ('unhandledrejection', function (event) {
  event.preventDefault();
  var reason = event.reason;
  if (reason && reason.name === 'InvalidStateError') {
    ProjectStore = createStore();
  }
  var promise = event.promise;
  $console.warn('Unhandled promise rejection:', (promise && (promise.stack || reason)));
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
  self.read = read;
  self.rmdir = rmdir;
  self.rm = rm;
  self.readlink = readlink;
  self.writelink = writelink
  self.write = write;
  self.exists = exists;
  self.mkdir = mkdir;
  self.readdir = readdir;
  self.readdirDeep = readdirDeep;
  self.lstat = lstat;
  self.lock = lock;
  self.unlock = unlock;

  /**
   * Return true if a file exists, false if it doesn't exist.
   * Rethrows errors that aren't related to file existence.
   */
  function exists(filepath) {
    return lookupFile(filepath).then(function (file) {
      if (file) {
        return true;
      } else {
        return lookupFolder(filepath).then(function (folder) {
          return !!folder;
        })
      }
    });
  }

  function lookupFolder(filepath) {
    return store.folders.get({ path: filepath }).then(function (folder) {
      if (folder && folder.deleted) {
        return null
      } else if (folder && folder.target) {
        return lookupFolder(folder.target);
      } else {
        return folder
      }
    });
  }

  function lookupFile(filepath) {
    return store.files.get({ path: filepath }).then(function (file) {
      if (file && file.deleted) {
        return null
      } else if (file && file.target) {
        return lookupFile(file.target);
      } else {
        return file
      }
    });
  }

  /**
   * Return the contents of a file if it exists, otherwise returns null.
   */
  function read(filepath, options) {
    options = options || {};
    return lookupFile(filepath).then(function (file) {
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
    var foldersToCreate = filepath.split('/').map(function (name, index, array) {
      return array.slice(0, index + 1).join('/');
    });
    return store.folders.where('path').anyOf(foldersToCreate).keys(function (paths) {
      return _mkdirs(foldersToCreate.filter(function (p) {
        return paths.indexOf(p) === -1;
      }));
    });
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
      return lookupFile(filepath)
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
              mode: options.mode,
              target: options.target,
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
              mode: options.mode,
              target: options.target,
              ctimeMs: ctime,
              mtimeMs: time
            };
            return store.files.update(file.id, {
              deleted: false,
              hash: hash,
              remoteHash: hash,
              remotePath: filepath,
              mode: options.mode,
              target: options.target,
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
        .then(function () {
          GlobalEmitter.emit("::write", { file: writtenFile });
          return {
            mode: writtenFile.mode,
            type: "file",
            size: data.text.length,
            mtimeMs: writtenFile.mtimeMs,
            ino: 0
          };
        });
    });
  }

  /**
   * Delete a file without throwing an error if it is already deleted.
   */
  function rm(filepath) {
    return store.files.get({ path: filepath })
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
    return store.folders.get({ path: filepath })
      .then(function (folder) {
        if (folder) {
          GlobalEmitter.emit("::remove", { folder: folder });
          return store.folders.update(folder.id, { deleted: true })
            .then(function () {
              return Promise.all([
                store.files.where("path").startsWith(filepath + '/').modify(
                  { deleted: true, ctimeMs: Date.now(), remotePath: null, remoteHash: null }),
                store.folders.where("path").startsWith(filepath + '/').modify(
                  { deleted: true })
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

  function stat(filepath) {
    return lstat(filepath).then(function (stat) {
      if (stat && stat.target) {
        return stat(stat.target);
      } else {
        return stat;
      }
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
    return store.files.get({ path: filepath }).then(function (file) {
      if (file) {
        return new Stats(FileType.FILE, 1, file.mode, null, file.mtimeMs, file.ctimeMs, null, file.target);
      }
      else {
        return store.folders.get({ path: filepath }).then(function (folder) {
          if (folder) {
            return new Stats(FileType.DIRECTORY, 0, null, null, folder.mtimeMs, folder.ctimeMs, null, folder.target);
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
  function readlink(filepath) {
    return lstat(filepath).then(function (stats) {
      return stats && stats.target;
    });
  }

  /**
   * Write the contents of buffer to a symlink.
   */
  function writelink (filename, buffer) {
    return symlink(buffer.toString('utf8'), filename)
  }

  function symlink(target, filepath) {
    return write(filepath, "", {target: target}).then(function (stats) {
      return {
        mode: stats.mode,
        type: "symlink",
        target: target,
        size: 0,
        mtimeMs: stats.mtimeMs
      }
    });
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
        return store.folders.where("path").equals(filename).modify({ deleted: true });
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

  function _mkdirs(paths) {
    var time = Date.now();
    var folders = paths.map(function (path) {
      return {
        id: _id(),
        path: path,
        mtimeMs: time,
        ctimeMs: time
      }
    });
    return store.folders.bulkAdd(folders);
  }

  function _mkdir(path) {
    var time = Date.now();
    return store.folders.add({
      id: _id(),
      path: path,
      mtimeMs: time,
      ctimeMs: time
    });
  }

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
 * @param target Target of symlink
 */
function Stats(
  itemType,
  size,
  mode,
  atimeMs,
  mtimeMs,
  ctimeMs,
  birthtimeMs,
  target
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
  self.target = target
  self.uid = 0;
  self.gid = 0;
  self.ino = 0;

  if (!mode) {
    switch (itemType) {
      case FileType.FILE:
        self.mode = normalizeMode(33188);  // 0o100644
        break;
      case FileType.DIRECTORY:
      default:
        self.mode = normalizeMode(16384);  // 0o040000
    }
  } else {
    self.mode = normalizeMode(mode);
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


  /**
   * From https://github.com/git/git/blob/master/Documentation/technical/index-format.txt
   *
   * 32-bit mode, split into (high to low bits)
   *
   *  4-bit object type
   *    valid values in binary are 1000 (regular file), 1010 (symbolic link)
   *    and 1110 (gitlink)
   *
   *  3-bit unused
   *
   *  9-bit unix permission. Only 0755 and 0644 are valid for regular files.
   *  Symbolic links and gitlinks have value 0 in this field.
   */
  function normalizeMode(mode) {
    // Note: BrowserFS will use -1 for "unknown"
    // I need to make it non-negative for these bitshifts to work.
    var type = mode > 0 ? mode >> 12 : 0
    // If it isn't valid, assume it as a "regular file"
    // 0100 = directory
    // 1000 = regular file
    // 1010 = symlink
    // 1110 = gitlink
    if (
      type !== 4 &&
      type !== 8 &&
      type !== 10 &&
      type !== 14
    ) {
      type = 8
    }
    var permissions = mode & 511
    // Is the file executable? then 755. Else 644.
    if (permissions & 73) {
      permissions = 493
    } else {
      permissions = 420
    }
    // If it's not a regular file, scrub all permissions
    if (type !== 8) permissions = 0
    return (type << 12) + permissions
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
// This is for CORS on mobile
function fetch2(url, options) {
  options.headers = options.headers || {}
  if (options.body && options.body.byteLength) {
    options.headers['X-Request-Body'] = encodeURIComponent(options.body.toString('base64'));
  }
  options.headers['X-Proxy-To'] = url;
  return fetch3('/proxy', options);
}
self.fetch = fetch2;
