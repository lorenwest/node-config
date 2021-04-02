var requireUncached = require('./_utils/requireUncached');

var vows = require('vows');
var assert = require('assert');

vows
  .describe('Tests for shell-style read')
  .addBatch({
    'Using JSON configuration file': _expectSuccess('json'),
    'Using JavaScript configuration file': _expectSuccess('js'),
  })
  .export(module);

function _expectSuccess(appInstance) {
  return {
    topic: function() {
      delete process.env.NODE_ENV;
      delete process.env.NODE_CONFIG;
      process.env.NODE_APP_INSTANCE = appInstance;
      process.env.NODE_CONFIG_SHELL_STYLE_READ = 'Y';
      process.env.NODE_CONFIG_DIR = __dirname + '/15-config';
      return requireUncached(__dirname + '/../lib/config');
    },

    'shell-style read success.': function(CONFIG) {
      assert.equal(CONFIG.privateKey, 'key.pem file contents here\n');
    },

    'did not false-positive on html tag.': function(CONFIG) {
      assert.equal(CONFIG.htmlTag, '<a href="hello">HELLO</a>');
    },
  };
}
