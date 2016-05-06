// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: strong-agent-statsd
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

// Run tests in a cluster worker... this will fail on Windows pre-0.11.14
var assert = require('assert');
var cluster=require('cluster');
cluster.setupMaster({exec:'test.js'});
cluster.fork().on('exit', function(code) {
  assert.equal(code, 0);
});
