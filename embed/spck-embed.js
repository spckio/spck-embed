;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.SpckEditor = factory();
  }
}(this, function() {
var SpckEditor = function (element, origin) {
  if (typeof element === 'string') {
    this.element = document.querySelector(element)
  }
  else if (isNode(element)) {
    this.element = element
  }
  else {
    throw new Error('Argument "element" must be a selector string or a HTMLElement.')
  }

  element = this.element
  if (element && element.contentWindow && element.contentWindow.postMessage) {
    this.contentWindow = element.contentWindow
  }
  else {
    throw new Error('Argument "element" must be an IFRAME element.')
  }

  this.origin = origin || 'https://embed.spck.io'
  this.handlers = {}

  function isNode(o) {
    return (
      typeof Node === "object" ? o instanceof Node :
        o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string"
    )
  }
}

SpckEditor.prototype = {
  connect: function (options) {
    options = options || {}
    var maxTries = options.maxTries || 20
    var interval = options.interval || 500
    var origin = this.origin
    var contentWindow = this.contentWindow
    var handlers = this.handlers

    return new Promise(function (resolve, reject) {
      function error(err) {
        reject(err)
      }

      var tries = 0
      var intervalId = setInterval(function () {
        if (tries >= maxTries) {
          clearInterval(intervalId)
          error({
            id: 1,
            message: 'Connection to iframe window failed: maximum tries exceeded.'
          })
          return
        }
        else {
          tries++
          var channel

          try {
            channel = new MessageChannel()
          }
          catch (e) {
            clearInterval(intervalId)
            error({
              id: 2,
              message: 'MessageChannel not supported.'
            })
            return
          }

          channel.port1.onmessage = function (e) {
            var data = e.data
            if (data == 'connected') {
              clearInterval(intervalId)
              resolve({tries: tries})
            } else if (data && data.action) {
              var action = data.action
              if (handlers[action]) {
                handlers[action].apply(null, data.args)
              }
            }
          }

          channel.port1.onmessageerror = function () {
            error({
              id: 3,
              message: 'An error occurred in the transport of connection message.'
            })
          }

          try {
            contentWindow.postMessage('connect', origin, [channel.port2])
          }
          catch (e) {
            error({
              id: 4,
              message: e.message || e.toString()
            })
          }
        }
      }, interval)
    })
  },

  send: function (message) {
    var self = this
    return new Promise(function (resolve, reject) {
      var channel = new MessageChannel()
      channel.port1.onmessage = function (ev) {
        resolve(ev.data)
      }
      channel.port1.onmessageerror = function () {
        reject()
      }
      self.contentWindow.postMessage(message, self.origin, [channel.port2])
    })
  },

  on: function (handlers) {
    for (var action in handlers) {
      if (handlers.hasOwnProperty(action)) {
        this.handlers[action] = handlers[action]
      }
    }
  },

  get: function (prop) {
    var self = this
    return new Promise(function (resolve, reject) {
      var channel = new MessageChannel()
      channel.port1.onmessage = function (ev) {
        resolve(ev.data)
      }
      channel.port1.onmessageerror = function () {
        reject()
      }
      self.contentWindow.postMessage(prop, self.origin, [channel.port2])
    })
  },

  getMode: function () {
    return this.get('mode')
  },

  getPosition: function () {
    return this.get('position')
  },

  getTabSize: function () {
    return this.get('tabSize')
  },

  getText: function () {
    return this.get('text')
  },

  getTheme: function () {
    return this.get('theme')
  }
}

return SpckEditor;
}));
