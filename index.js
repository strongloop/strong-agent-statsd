var debug = require('debug')('strong-agent-statsd');
var Lynx = require('lynx');

module.exports = function (options) {
  options = options || {};
  var publisher = new Publisher(options.port, options.host, options.scope);

  return function publish(name, value) {
    publisher.publish(name, value);
  };
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

Publisher.prototype.onError = function onError(er) {
  debug('lynx error:', er.stack || er);
  this.emit('warn', er);
};

// Report all metrics as 'gauge', unless specifically configured to be a count.
var COUNTED = {
  'loop.count': true,
  'messages.in': true, // XXX TBD depends on whether they are count/minute, or
  'messages.out': true, // absolute...
};

Publisher.prototype.publish = function publish(name, value) {
  if (COUNTED[name]) {
    this.stats.count(name, value);
    return
  }
  this.stats.gauge(name, value);
};
