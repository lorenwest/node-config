
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

// Expected results for deferred stress test
var expectedStress =  {
  images: { src: 'foobar' },
  srcSvgGlob: [ '/plyr/src/sprite/*.svg', 'foobar/*.svg' ],
  a1: 1,
  c1: 1,
  d1: 2,
  e1: 4,
  f1: 2,
  g1: 1,
  h1: { ha: 5, hb: 5 },
  h2: { a: { a: [ 7, 'fleegle', 5 ] } },
  i0: { a: { a: 21, b: 9 }, b: [ 9, 'snorky', 1 ] },
  i2:
  { z: 5,
    a: { a: 'snorky', b: 1 },
    b: [ -2, [ 9, 'snorky', 1 ] ],
    c: 'snorky' },
  i1: { ic: { ha: 5, hb: 5 }, id: { ha: 5, hb: 5 } },
  a2: 1,
  b2: 1,
  c2: [ { d0: 0, d1: 1 }, [ 'hello', 1 ] ],
  d2: { d0: 0, d1: 1 },
  e2: { e0: [ 'hello', 1 ] },
  f2:
  { fa: { a: { a: 1 } },
    fb: { a: [ 5, 'blue', { a: { a: 1, b: 'orange' } } ] } } };


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

    // This defer function didn't use args, but relied 'this' being bound to the main config object
    "defer functions can simply refer to 'this'" : function () {
        assert.equal(CONFIG.welcomeEmail.justThis, 'Welcome to this New Instance!');
    },

    "defer functions which return objects should still be treated as a single value." : function () {
      assert.deepEqual(CONFIG.get('map.centerPoint'), { lat: 3, lon: 4 });
    },

    "nested defer functions work": function() {
      assert.equal(CONFIG.get('name.nickname'), 'Bob');
    },

    'service registry example': function() {
      var svc = CONFIG.get('service.active');
      assert.equal(svc.message, 'Real thing');
      assert.equal(CONFIG.get('service.active.message'), 'Real thing');
    },
    
    
    "deferred stress test" : function() {
      // Grab the subset of the result CONFIG that we're interested in
      var subconfig = {};
      Object.keys(expectedStress).forEach(function(key) {
        subconfig[key] = CONFIG.get(key);
      });
      assert.deepEqual(expectedStress, subconfig);
    },

  }
})
.export(module);


function requireUncached(module){
   delete require.cache[require.resolve(module)];
   return require(module);
}
