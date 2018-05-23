
// Tests for configrc\' file

// Dependencies
var vows = require('vows'),
    assert = require('assert'),
    requireUncached = require('./_utils/requireUncached');

vows.describe("CONFIG_RC: Tests for configrc' file")
.addBatch({
    "Tests for .configrc": {
        topic: function() {

          var pre = process.argv;
          process.argv.pop(process.argv.length-1);
          
          delete process.env.NODE_CONFIG;

          process.env.USE_CONFIG_RC = 'true';
          process.env.CONFIG_RC_DIR = '../test/14-config/configrc';
          process.env.CONFIG_RC = 'configrc.json';


          requireUncached(`${__dirname}/../lib/config`);
          var config = require('../lib/config');
          requireUncached(`${__dirname}/../lib/config`);

          delete process.env.USE_CONFIG_RC;
          delete process.env.CONFIG_RC_DIR;
          process.argv = pre;

          return config;
        },
        "Tests for loading configrc' file": function (config) {

          assert.strictEqual(config.number, 14);
        },
        "Test for config merging of .configrc": function (config) {
          
          assert.strictEqual(config.configrc, "gotIt");
        }
    }
})
.export(module);

