
// Tests for config.util functions

// Dependencies
var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    config = require('../lib/config'),
    initParam = config.util.initParam,
    loadFileConfigs = config.util.loadFileConfigs;

vows.describe('Tests for config util functions')
.addBatch({
    'Tests for util.initParam': {
        'When no command line or env var is set, default value is returned.': function () {
          assert(initParam('EMPTY','mydefault'),'mydefault');
        },
        'When process.env is set and cmdline is not, process.env is used ': function () {
          process.env.ENV_ONLY = 'in-the-env';
          assert(initParam('ENV_ONLY','mydefault'),'in-the-env');
        },
        'When process.env is set and cmdline *is* set, cmd-line is used ': function () {
          process.env.BOTH = 'in-the-env';
          process.argv=['--BOTH=in-the-argv'];
          assert(initParam('BOTH','mydefault'),'in-the-argv');
        },
        'After calling initParam, value is reflected in getEnv() even if it did not come from process.env': function () {
          process.argv=['ignore','ignore','--FROMARG=in-the-argv'];
          assert(initParam('FROMARG','mydefault'),'in-the-argv');
          assert(config.util.getEnv('FROMARG'),'in-the-argv');
        },
        'Setting a zero value in the process.env works (process.env inherently casts values to strings)': function () {
          process.env.ENV_ONLY = '0';
          assert.strictEqual(initParam('ENV_ONLY','mydefault'),'0');
        },
        'Setting a zero value on the command line works. ': function () {
          process.argv=['ignore','ignore','--FROMARG=0'];
          assert.strictEqual(initParam('FROMARG','mydefault'),'0');
        },
    },
    'Tests for util.loadFileConfigs': {
        'It can load data from a given directory': function () {
          var result = loadFileConfigs(path.join(__dirname, '5-config'));
          assert.strictEqual(result.number, 5);
        },
        'It ignores NODE_CONFIG when loading from directory': function () {
          var prev = process.env.NODE_CONFIG;
          process.env.NODE_CONFIG = '{"number":4}'
          var result = loadFileConfigs(path.join(__dirname, '5-config'));
          assert.strictEqual(result.number, 5);
          process.env.NODE_CONFIG = prev;
        },
    },
    'Tests for util.logger': {
      'It can change the logger': function () {
        var source = 'Hello World', result;
        config.util.log = (message)=>{result = message};
        config.util.log(source);
        assert.strictEqual(source, result);
      }
    }
})
.export(module);

