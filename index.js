var debug = require('debug')('strong-agent-statsd');
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
  this.port = port;
  this.host = host;
  this.scope = scope;
  this.stats = new Lynx(this.host, this.port, {
    scope: this.scope,
    on_error: this.onError.bind(this),
  });
}

util.inherits(Publisher, EventEmitter);

Publisher.prototype.onError = function onError(er) {
  debug('transport error:', er.stack || er);
  this.emit('warn', er);
};

// Report all metrics as 'gauge', unless last component of name is '.count'.
var COUNTED = /\.count$/;

Publisher.prototype.publish = function publish(name, value) {
  debug('metric %s=%s', name, value);
  if (COUNTED.test(name)) {
    this.stats.count(name, value);
    return
  }
  this.stats.gauge(name, value);
};
