// Run tests in a cluster worker... this will fail on Windows pre-0.11.14
var assert = require('assert');
var cluster=require('cluster');
cluster.setupMaster({exec:'test.js'});
cluster.fork().on('exit', function(code) {
  assert.equal(code, 0);
});
