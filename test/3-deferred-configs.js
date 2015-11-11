
// Test declaring deferred values.

// Change the configuration directory for testing
process.env.NODE_CONFIG_DIR = __dirname + '/3-config';

// Hardcode $NODE_ENV=test for testing
process.env.NODE_ENV='test';

// Test for multi-instance applications
process.env.NODE_APP_INSTANCE='defer';

// Because require'ing config creates and caches a global singleton,
// We have to invalidate the cache to build new object based on the environment variables above
var CONFIG = requireUncached('../lib/config');

// Dependencies
var vows = require('vows'),
    assert = require('assert');

vows.describe('Tests for deferred values').addBatch({
  'Configuration file Tests': {
    'Using deferConfig() in a config file causes value to be evaluated at the end': function() {
        // The deferred function was declared in default-defer.js
        // Then local-defer.js is located which overloads the siteTitle mentioned in the function
        // Finally the deferred configurations, now referencing the 'local' siteTitle
        assert.equal(CONFIG.welcomeEmail.subject, 'Welcome to New Instance!');
    },

    'values which are functions remain untouched unless they are instance of DeferredConfig': function() {
        // If this had been treated as a deferred config value it would blow-up.
        assert.equal(CONFIG.welcomeEmail.aFunc(), 'Still just a function.');
    },

    'values which are named "resolve" functions remain untouched unless they are proper objects': function() {
        // If this had been treated as a deferred config value it would blow-up.
        assert.equal(CONFIG.welcomeEmail.bFunc.resolve(), 'Still just a function.');
    },

    'values which are DeferredConfig-like objects, should be evaluated': function() {
        // If this had been treated as a deferred config value it would blow-up.
        assert.equal(CONFIG.welcomeEmail.cFunc, 'cFunc resolved!');
    },

    // This defer function didn't use args, but relied 'this' being bound to the main config object
    "defer functions can simply refer to 'this'" : function () {
        assert.equal(CONFIG.welcomeEmail.justThis, 'Welcome to this New Instance!');
    },

    "defer functions which return objects should still be treated as a single value." : function () {
      assert.deepEqual(CONFIG.get('map.centerPoint'), { lat: 3, lon: 4 });
    },

  }
})
.export(module);


function requireUncached(module){
   delete require.cache[require.resolve(module)];
   return require(module);
}
