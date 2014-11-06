var debug = require('debug')('strong-agent-statsd');
var dgram = require('dgram');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Lynx = require('lynx');

module.exports = function (options) {
  options = options || {};
  var publisher = new Publisher(options.port, options.host, options.scope);

  function publish(name, value) {
    publisher.publish(name, value);
  };

  // Attach publisher to middleware so 'warn' event can be listened on.
  publish.publisher = publisher;

  return publish;
};

function Publisher(port, host, scope) {
  var self = this;

  this.port = port;
  this.host = host;
  this.scope = scope;

  // Lynx creates a new UDP socket if it isn't used for 1 second. This has
  // two problems:
  // 1. It forces sockets to be created every time we use one.
  // 2. It tickles a bug in v0.11 cluster causing the master to assert.
  // Work around this by creating the socket once, which Lynx supports.
  // Also, emulate Lynx's error handling, which it does only for its own
  // created sockets.
  this.socket = dgram.createSocket('udp4');
  this.socket.unref();
  this.socket.on('error', function (err) {
    err.reason  = err.message;
    err.f       = 'send';
    err.message = 'Failed sending the buffer';
    err.args    = arguments;
    self.onError(err);
    return;
  });

  this.stats = new Lynx(this.host, this.port, {
    scope: this.scope,
    on_error: this.onError.bind(this),
    socket: this.socket,
  });
}

util.inherits(Publisher, EventEmitter);

Publisher.prototype.onError = function onError(er) {
  debug('transport error:', er.stack || er);
  this.emit('warn', er);
};

// Report all metrics as 'gauge', unless last component of name is '.count'.
var COUNTED = /\.count$/;
var TIMER = /\.timer$/;

Publisher.prototype.publish = function publish(name, value) {
  debug('metric %s=%s', name, value);
  if (COUNTED.test(name)) {
    this.stats.count(name, value);
  } else if(TIMER.test(name)) {
    this.stats.timing(name, value);
  } else {
    // Work around a well-known (if you read the right docs) statsd protocol
    // peculiarity. If a gauge value starts with a + or a -, it is accumulated
    // with last value. This is fine for positive numbers, but it means there is
    // no way to represent an absolute negative value, it will always be
    // interpreted as relative to the last value.
    //
    // Note that we can't send a 0 then send the value with lynx, the two values
    // will be sent in different UDP packets, and they can get lost or
    // reordered.  Even on localhost, loss is unlikely, but reorder has been
    // observed.
    if (value < 0) {
      return this._send([
        [name, 0, 'g'],
        [name, value, 'g'],
      ]);
    }
    return this._send([
      [name, value, 'g'],
    ]);
  }
};

// Lynx doesn't support multiple metrics in a single packet if they have the
// same name.
Publisher.prototype._send = function publish(metrics) {
  var self = this.stats;
  var str = metrics.map(function(m) {
    return self.scope + m[0] + ':' + m[1] + '|' + m[2];
  }).join('\n');
  var buf = new Buffer(str, 'utf8');
  self.socket.send(buf, 0, buf.length, self.port, self.host, function(){});
};
