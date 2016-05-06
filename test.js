// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: strong-agent-statsd
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var assert = require('assert');
var cluster = require('cluster');
var dgram = require('dgram');
var semver = require('semver');
var statsd = require('./');
var util = require('util');

console.log('start test');

var server = dgram.createSocket('udp4');
var port;
var reported = [];
var expected = [];
var ok;

process.on('exit', function() {
  assert(ok, 'test not ok');
});

server.on('message', function(data) {
  console.log('reported: %s', data);
  reported.push(data.toString());

  checkIfPassed();
});

if (semver.gte(process.version, '0.11.14')) {
  console.log('exclusive bind');
  server.bind({port: 0, exclusive: true}, listening);
} else {
  server.bind(listening);
}

function listening(er) {
  console.log('listening:', er || server.address());
  assert.ifError(er);
  port = server.address().port;
  test();
}

function test() {
  var publish = statsd({port: port});

  assert.equal(publish.publisher.port, port);

  publish.publisher.emit('you are an emitter');

  function write(name, value, type) {
    var zero = '';
    if (value < 0 && type === 'g') {
      // Expect the negative-gauge workaround.
      zero = util.format('%s:%d|%s\n', name, 0, type);
    }
    expected.push(zero + util.format('%s:%d|%s', name, value, type));
    publish(name, value);
  }

  // count are counts, timers are timers, and stats that don't END in count or
  // timer are gauges
  write('loop.count', 100, 'c');
  write('loop.something', 5.99, 'g');
  write('loop.count', 50, 'c');
  write('loop.timer', 50, 'ms');
  write('object.String.count', -10, 'c');
  write('object.String.size', -1029, 'g');
  write('loop.count.x', 150, 'g');
  write('loop.timer.y', 150, 'g');
}

function checkIfPassed() {
  if (reported.length < expected.length) {
    console.log('waiting for more reports...');
    return;
  }
  console.log('reported:', reported);
  console.log('expected:', expected);
  assert.equal(reported.length, expected.length);
  for (var i = 0; i < reported.length; i++) {
    assert.deepEqual(reported[i], expected[i], 'at idx ' + i);
  }

  ok = true;
  server.close();
  if (cluster.isWorker) process.disconnect();
}
