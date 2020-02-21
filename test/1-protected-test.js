/**
 * <p>Unit tests</p>
 *
 * @module test
 */

var requireUncached = require('./_utils/requireUncached');

var vows = require('vows');
var assert = require('assert');

// Make a copy of the command line args
var argvOrg = process.argv;

/**
 * <p>Tests for underlying node-config utilities.  To run type:</p>
 * <pre>npm test</pre>
 * <p>Or, in a project that uses node-config:</p>
 * <pre>npm test config</pre>
 *
 * @class ProtectedTest
 */

var CONFIG;
vows.describe('Protected (hackable) utilities test')
.addBatch({
  // We initialize the object in a batch so that the globals get changed at /run-time/ not /require-time/,
  // avoiding conflicts with other tests.
  // We initialize in our own /batch/ because batches are run in serial, while individual contexts run in parallel.
  'Library initialization': {
    topic : function () {
      // Change the configuration directory for testing
      process.env.NODE_CONFIG_DIR = __dirname + '/config';

      // Hardcode $NODE_ENV=test for testing
      process.env.NODE_ENV='test';

      // Test for multi-instance applications
      process.env.NODE_APP_INSTANCE='3';

      // Test $NODE_CONFIG environment and --NODE_CONFIG command line parameter
      process.env.NODE_CONFIG='{"EnvOverride":{"parm3":"overridden from $NODE_CONFIG","parm4":100}}';
      process.argv.push('--NODE_CONFIG={"EnvOverride":{"parm5":"overridden from --NODE_CONFIG","parm6":101}}');

      // Test Environment Variable Substitution
      var override = 'CUSTOM VALUE FROM JSON ENV MAPPING';
      process.env['CUSTOM_JSON_ENVIRONMENT_VAR'] = override;

      // Dependencies
      CONFIG = requireUncached(__dirname + '/../lib/config');

      return CONFIG;

    },
    'Library is available': function(config) {
      assert.isObject(config);
    }
  }
})
.addBatch({
  'isObject() tests': {
    'The function exists': function() {
      assert.isFunction(CONFIG.util.isObject);
    },
    'Correctly identifies objects': function() {
   	  assert.isTrue(CONFIG.util.isObject({A:"b"}));
    },
    'Correctly excludes non-objects': function() {
   	  assert.isFalse(CONFIG.util.isObject("some string"));
   	  assert.isFalse(CONFIG.util.isObject(45));
   	  assert.isFalse(CONFIG.util.isObject([2, 3]));
   	  assert.isFalse(CONFIG.util.isObject(["a", "b"]));
   	  assert.isFalse(CONFIG.util.isObject(null));
   	  assert.isFalse(CONFIG.util.isObject(undefined));
    }
  },

  '_cloneDeep() tests': {
    topic: function() {
      // Return an object for copy tests
      return {
        elem0:true,
        elem1:"Element 1",
        elem2:2,
        elem3:[1,2,3],
        elem4:function(){return "hello";},
        elem5:{sub1:"sub 1",sub2:2,sub3:[1,2,3]},
        elem6: {date: new Date, regexp: /test/i}
      };
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.cloneDeep);
    },
    'Original and copy should test equivalent (deep)': function(orig) {
      var copy = CONFIG.util.cloneDeep(orig);
      assert.deepEqual(copy, orig);
    },
    'The objects should be different': function(orig) {
      var copy = CONFIG.util.cloneDeep(orig);
      copy.elem1 = false;
      assert.notDeepEqual(copy, orig);
    },
    'Object clones should be objects': function(orig) {
      assert.isObject(CONFIG.util.cloneDeep({a:1, b:2}));
    },
    'Array clones should be arrays': function(orig) {
      assert.isArray(CONFIG.util.cloneDeep(["a", "b", 3]));
    },
    'Arrays should be copied by value, not by reference': function(orig) {
      var copy = CONFIG.util.cloneDeep(orig);
      assert.deepEqual(copy, orig);
      copy.elem3[0] = 2;
      // If the copy wasn't deep, elem3 would be the same object
      assert.notDeepEqual(copy, orig);
    },
    'Objects should be copied by value, not by reference': function(orig) {
      var copy = CONFIG.util.cloneDeep(orig);
      copy.elem5.sub2 = 3;
      assert.notDeepEqual(copy, orig);
      copy = CONFIG.util.cloneDeep(orig);
      copy.elem5.sub3[1] = 3;
      assert.notDeepEqual(copy, orig);
    },
    'Regexps and dates are preserved': function (orig) {
      var copy = CONFIG.util.cloneDeep(orig);
      assert.equal(copy.elem6.date.constructor.name, 'Date');
      assert.equal(copy.elem6.regexp.toString(), '/test/i');
    }
  },

  'extendDeep() tests': {
    'The function exists': function() {
      assert.isFunction(CONFIG.util.extendDeep);
    },
    'Performs normal extend': function() {
      var orig = {elem1:"val1", elem2:"val2"};
      var extWith = {elem3:"val3"};
      var shouldBe = {elem1:"val1", elem2:"val2", elem3:"val3"};
      assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
    },
    'Replaces non-objects': function() {
      var orig = {elem1:"val1", elem2:["val2","val3"],elem3:{sub1:"val4"}};
      var extWith = {elem1:1,elem2:["val4"],elem3:"val3"};
      var shouldBe = {elem1:1, elem2:["val4"],elem3:"val3"};
      assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
    },
    'Merges objects': function() {
      var orig = {e1:"val1", elem2:{sub1:"val4",sub2:"val5"}};
      var extWith = {elem2:{sub2:"val6",sub3:"val7"}};
      var shouldBe = {e1:"val1", elem2:{sub1:"val4",sub2:"val6",sub3:"val7"}};
      assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
    },
    'Merges dates': function() {
      var orig = {e1:"val1", elem2:{sub1:"val4",sub2:new Date(2015, 0, 1)}};
      var extWith = {elem2:{sub2:new Date(2015, 0, 2),sub3:"val7"}};
      var shouldBe = {e1:"val1", elem2:{sub1:"val4",sub2:new Date(2015, 0, 2),sub3:"val7"}};
      assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
    },
    'Creates partial objects when mixing objects and non-objects': function () {
      var orig = {elem1: {sub1: 5}};
      var ext1 = {elem1: {sub2: 7}};
      var ext2 = {elem1: 7};
      var ext3 = {elem1: {sub3: 13}};
      // When we get to ext2, the 7 clears all memories of sub1 and sub3. Then, when
      // we merge with ext3, the 7 is replaced by the new object.
      var expected = {elem1: {sub3: 13}};
      assert.deepEqual(CONFIG.util.extendDeep(orig, ext1, ext2, ext3), expected);
    },
    'Correctly types new objects and arrays': function() {
      var orig = {e1:"val1", e3:["val5"]};
      var extWith = {e2:{elem1:"val1"}, e3:["val6","val7"]};
      var shouldBe = {e1:"val1", e2:{elem1:"val1"}, e3:["val6","val7"]};
      var ext = CONFIG.util.extendDeep({}, orig, extWith);
      assert.isObject(ext.e2);
      assert.isArray(ext.e3);
      assert.deepEqual(ext, shouldBe);
    },
    'Keeps non-merged objects intact': function() {
      var orig     = {e1:"val1", elem2:{sub1:"val4",sub2:"val5"}};
      var shouldBe = {e1:"val1", elem2:{sub1:"val4",sub2:"val5"}};
      var extWith = {elem3:{sub2:"val6",sub3:"val7"}};
      CONFIG.util.extendDeep({}, orig, extWith);
      assert.deepEqual(orig, shouldBe);
    },
    'Keeps prototype methods intact': function() {
      var orig = Object.create({has: function() {}});
      var result = CONFIG.util.extendDeep({}, orig, {});
      assert.isFunction(result.has);
    }
  },

  'equalsDeep() tests': {
    'The function exists': function() {
      assert.isFunction(CONFIG.util.equalsDeep);
    },
    'Succeeds on two empty objects': function() {
      assert.isTrue(CONFIG.util.equalsDeep({}, {}));
    },
    'Succeeds on array comparisons': function() {
      assert.isTrue(CONFIG.util.equalsDeep([1,'hello',2], [1,'hello',2]));
    },
    'Succeeds on the same object': function() {
      var a = {hello:'world'};
      assert.isTrue(CONFIG.util.equalsDeep(a, a));
    },
    'Succeeds on a regular object': function() {
      var a = {value_3: 14, hello:'world', value_1: 29};
      var b = {value_1: 29, hello:'world', value_3: 14};
      assert.isTrue(CONFIG.util.equalsDeep(a, b));
    },
    'Succeeds on a deep object': function() {
      var a = {value_3: 14, hello:'world', value_1: 29, value_4:['now','is','the','time']};
      var b = {value_1: 29, hello:'world', value_3: 14, value_4:['now','is','the','time']};
      var c = {creditLimit: 10000, deepValue: a};
      var d = {deepValue: b, creditLimit:10000};
      assert.isTrue(CONFIG.util.equalsDeep(c, d));
    },
    'Fails if either object is null': function() {
      assert.isFalse(CONFIG.util.equalsDeep({}, null));
      assert.isFalse(CONFIG.util.equalsDeep(null, {}));
      assert.isFalse(CONFIG.util.equalsDeep(null, null));
    },
    'Fails if either object is undefined': function() {
      var a = {};
      assert.isFalse(CONFIG.util.equalsDeep({}));
      assert.isFalse(CONFIG.util.equalsDeep(a['noElement'], {}));
    },
    'Fails if either object is undefined': function() {
      var a = {};
      assert.isFalse(CONFIG.util.equalsDeep({}));
      assert.isFalse(CONFIG.util.equalsDeep(a['noElement'], {}));
    },
    'Fails if object1 has more elements': function() {
      var a = {value_3: 14, hello:'world', value_1: 29, otherElem: 40};
      var b = {value_1: 29, hello:'world', value_3: 14};
      assert.isFalse(CONFIG.util.equalsDeep(a, b));
    },
    'Fails if object2 has more elements': function() {
      var a = {value_1: 29, hello:'world', value_3: 14};
      var b = {value_3: 14, hello:'world', value_1: 29, otherElem: 40};
      assert.isFalse(CONFIG.util.equalsDeep(a, b));
    },
    'Fails if any value is different': function() {
      var a = {value_1: 30, hello:'world', value_3: 14, value_4:['now','is','the','time']};
      var b = {value_1: 29, hello:'world', value_3: 14, value_4:['now','is','the','time']};
      assert.isFalse(CONFIG.util.equalsDeep(a, b));
      var a = {value_1: 29, hello:'world', value_3: 14, value_4:['now','is','the','time']};
      var b = {value_1: 29, hello:'world', value_3: 14, value_4:['now','isnt','the','time']};
      assert.isFalse(CONFIG.util.equalsDeep(a, b));
    }
  },

  'diffDeep() tests': {
    'The function exists': function() {
      assert.isFunction(CONFIG.util.diffDeep);
    },
    'Returns an empty object if no differences': function() {
      var a = {value_3: 14, hello:'world', value_1: 29};
      var b = {value_1: 29, hello:'world', value_3: 14};
      assert.equal(typeof(CONFIG.util.diffDeep(a,b)), 'object');
      assert.isTrue(Object.keys(CONFIG.util.diffDeep(a, b)).length == 0);
    },
    'Returns an empty object if no differences (deep)': function() {
      var a = {value_3: 14, hello:'world', value_1: 29, value_4:[1,'hello',2], deepObj:{a:22,b:{c:45,a:44}}};
      var b = {value_1: 29, hello:'world', value_3: 14, value_4:[1,'hello',2], deepObj:{a:22,b:{a:44,c:45}}};
      assert.equal(typeof(CONFIG.util.diffDeep(a,b)), 'object');
      assert.isTrue(Object.keys(CONFIG.util.diffDeep(a, b)).length == 0);
    },
    'Returns just the diff values': function() {
      var a = {value_3: 14, hello:'wurld', value_1: 29, deepObj:{a:22,b:{c:45,a:44}}};
      var b = {value_1: 29, hello:'world', value_3: 14, deepObj:{a:22,b:{a:44,c:45}}};
      var diff = CONFIG.util.diffDeep(a,b);
      assert.equal(Object.keys(diff).length, 1);
      assert.equal(diff.hello, 'world');
    },
    'Returns just the diff values (deep)': function() {
      var a = {value_3: 14, hello:'wurld', value_1: 29, value_4:[1,'hello',2], deepObj:{a:22,b:{c:45,a:44}}};
      var b = {value_1: 29, hello:'wurld', value_3: 14, value_4:[1,'goodbye',2], deepObj:{a:22,b:{a:45,c:44}}};
      var diff = CONFIG.util.diffDeep(a,b);
      assert.equal(Object.keys(diff).length, 2);
      assert.equal(Object.keys(diff.deepObj).length, 1);
      assert.equal(Object.keys(diff.deepObj.b).length, 2);
      assert.equal(diff.deepObj.b.a, 45);
      assert.equal(diff.deepObj.b.c, 44);
      assert.deepEqual(diff.value_4, [1, 'goodbye', 2]);
    }
  },

  'substituteDeep() tests': {
    topic: function () {
      var topic = {
        TopLevel: 'SOME_TOP_LEVEL',
        TestModule: {
          parm1: "SINGLE_SECOND_LEVEL"
        },
        TestPartialReplace: "http://{{DOMAIN_NAME}}/index.html",
        Customers: {
          dbHost: 'DB_HOST',
          dbName: 'DB_NAME',
          oauth: {
            key: 'OAUTH_KEY',
            secret: 'OAUTH_SECRET'
          }
        }
      };
      return topic;
    },
    'returns an empty object if the variables mapping is empty': function (topic) {
      vars = {};
      var substituted = CONFIG.util.substituteDeep(topic, vars);
      assert.deepEqual(substituted, {});
    },
    'returns an empty object if none of the variables map to leaf strings': function (topic) {
      vars = {
        NON_EXISTENT_VAR: 'ignore_this'
      };
      var substituted = CONFIG.util.substituteDeep(topic, vars);
      assert.deepEqual(substituted, {});
    },
    'returns an object with keys matching down to mapped existing variables': function (topic) {
      vars = {
        'SOME_TOP_LEVEL': 5,
        'DB_NAME': 'production_db',
        'OAUTH_SECRET': '123456',
        'PATH': 'ignore other environment variables'
      };
      var substituted = CONFIG.util.substituteDeep(topic, vars);
      assert.deepEqual(substituted, {
        TopLevel: 5,
        Customers: {
          dbName: 'production_db',
          oauth: {
            secret: '123456'
          }
        }
      });
    },
    'returns an object with keys matching down to mapped existing variables with JSON content': function (topic) {
      vars = {
        'DB_HOST': '{"port":"3306","host":"example.com"}'
      };
      var substituted = CONFIG.util.substituteDeep(topic, vars);
      assert.deepEqual(substituted, {
        Customers: {
          dbHost: '{"port":"3306","host":"example.com"}'
        }
      });
    },
    'returns an object with keys matching down to mapped and JSON-parsed existing variables': function (topic) {
      vars = {
        'DB_HOST': '{"port":"3306","host":"example.com"}'
      };
      topic.Customers.dbHost = {__name: 'DB_HOST', __format: 'json'};
      var substituted = CONFIG.util.substituteDeep(topic, vars);
      assert.deepEqual(substituted, {
        Customers: {
          dbHost: {
            port: '3306',
            host: 'example.com'
          }
        }
      });
    },
    'returns an object with keys matching down to mapped and replaced existing variables': function (topic) {
      vars = {
        'DOMAIN_NAME': 'localhost'
      };
      var substituted = CONFIG.util.substituteDeep(topic, vars);
      assert.deepEqual(substituted, {
        TestPartialReplace: 'http://localhost/index.html'
      });
    },
    // Testing all the things in variable maps that don't make sense because ENV vars are always
    // strings.
    'Throws an error for leaf Array values': function (topic) {
      vars = {};
      topic.Customers.dbHost = ['a', 'b', 'c'];
      const substituted = CONFIG.util.substituteDeep(topic, vars) 
      assert.deepEqual(substituted, vars)
    },
    'Throws an error for leaf Boolean values': function (topic) {
      vars = {
        NON_EXISTENT_VAR: 'ignore_this'
      };
      topic.Customers.dbHost = false;
      assert.throws(function () {
        CONFIG.util.substituteDeep(topic, vars);
      });
    },
    'Throws an error for leaf Numeric values': function (topic) {
      vars = {
        NON_EXISTENT_VAR: 'ignore_this'
      };
      topic.Customers.dbHost = 443;
      assert.throws(function () {
        CONFIG.util.substituteDeep(topic, vars);
      });
    },
    'Throws an error for leaf null values': function (topic) {
      vars = {
        NON_EXISTENT_VAR: 'ignore_this'
      };
      topic.Customers.dbHost = null;
      assert.throws(function () {
        CONFIG.util.substituteDeep(topic, vars);
      });
    },
    'Throws an error for leaf Undefined values': function (topic) {
      vars = {
        NON_EXISTENT_VAR: 'ignore_this'
      };
      topic.Customers.dbHost = undefined;
      assert.throws(function () {
        CONFIG.util.substituteDeep(topic, vars);
      });
    },
    'Throws an error for leaf NaN values': function (topic) {
      vars = {
        NON_EXISTENT_VAR: 'ignore_this'
      };
      topic.Customers.dbHost = NaN;
      assert.throws(function () {
        CONFIG.util.substituteDeep(topic, vars);
      });
    },
    'Throws an error with message describing variables name that throw a parser error': function(topic) {
      var JSON_WITH_SYNTAX_ERROR = '{"port":"3306","host" "example.com"}'
      vars = {
        'DB_HOST': JSON_WITH_SYNTAX_ERROR
      };
      topic.Customers.dbHost = {__name: 'DB_HOST', __format: 'json'};
      try {
        CONFIG.util.substituteDeep(topic, vars);
        assert.isTrue(false);
      } catch(err) {
        assert.match(err.message, /__format parser error in DB_HOST: /);
      }
    }
  },

  'setPath() tests:': {
    topic: function () {
      return {
        TestModule: {
          parm1: "value1"
        },
        Customers: {
          dbHost: 'base',
          dbName: 'from_default_js',
          oauth: {
            key: 'a_api_key',
            secret: 'an_api_secret'
          }
        },
        EnvOverride: {
          parm_number_1: "from_default_js",
          parm2: 22
        }
      };
    },
    'Ignores null values': function (topic) {
      CONFIG.util.setPath(topic, ['Customers', 'oauth', 'secret'], null);
      assert.equal(topic.Customers.oauth.secret, 'an_api_secret');
    },
    'Creates toplevel keys to set new values': function (topic) {
      CONFIG.util.setPath(topic, ['NewKey'], 'NEW_VALUE');
      assert.equal(topic.NewKey, 'NEW_VALUE');
    },
    'Creates subkeys to set new values': function (topic) {
      CONFIG.util.setPath(topic, ['TestModule', 'oauth'], 'NEW_VALUE');
      assert.equal(topic.TestModule.oauth, 'NEW_VALUE');
    },
    'Creates parents to set new values': function (topic) {
      CONFIG.util.setPath(topic, ['EnvOverride', 'oauth', 'secret'], 'NEW_VALUE');
      assert.equal(topic.EnvOverride.oauth.secret, 'NEW_VALUE');
    },
    'Overwrites existing values': function (topic) {
      CONFIG.util.setPath(topic, ['Customers'], 'NEW_VALUE');
      assert.equal(topic.Customers, 'NEW_VALUE');
    }
  },

  'stripComments() tests': {
    // Only testing baseline stripComments functionality.
	// This implementation handles lots of edge cases that aren't in these tests
    'The function exists': function() {
      assert.isFunction(CONFIG.util.stripComments);
    },
    'Leaves a simple string without comments alone': function() {
   	  var str = "Hello\nWorld";
   	  assert.equal(CONFIG.util.stripComments(str), str);
    },
    'Strips out line-type comments': function() {
   	  var str1 = "var a='Hello'; // Comment about the a variable";
   	  var str2 = "var a='Hello'; ";
   	  assert.equal(CONFIG.util.stripComments(str1), str2);
    },
    'Strips out block-type comments': function() {
   	  var str1 = "var a='Hello';/* Block Comment */ var b=24";
   	  var str2 = "var a='Hello'; var b=24";
   	  assert.equal(CONFIG.util.stripComments(str1), str2);
    },
    'Strips out multi-line block comments': function() {
   	  var str1 = "var a='Hello';\n/* Block Comment\n  Line 2 comment\n*/\nvar b=24";
   	  var str2 = "var a='Hello';\n\nvar b=24";
   	  assert.equal(CONFIG.util.stripComments(str1), str2);
    }
  },

  'parseFile() tests': {
    topic: function() {
      return CONFIG.util.parseFile(__dirname + '/config/default.yaml');
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.parseFile);
    },
    'An object is returned': function(config) {
      assert.isObject(config);
    },
    'The correct object is returned': function(config) {
      assert.isObject(config.Customers);
      assert.isTrue(config.Customers.dbName == 'from_default_yaml');
      assert.isTrue(config.Customers.dbPort == 5984);
      assert.isObject(config.AnotherModule);
      assert.isTrue(config.AnotherModule.parm2 == "value2");
    }
  },

  'CSON parse tests': {
    topic: function() {
      return CONFIG.util.parseFile(__dirname + '/config/default.cson');
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.parseFile);
    },
    'An object is returned': function(config) {
      assert.isObject(config);
    },
    'The correct object is returned': function(config) {
      assert.isObject(config.Customers);
      assert.isTrue(config.Customers.dbName == 'from_default_cson');
      assert.isTrue(config.Customers.dbPassword == 'password will be overwritten.');
      assert.isObject(config.AnotherModule);
      assert.isTrue(config.AnotherModule.parm4 == "value4");
      assert.isArray(config.Customers.lang);
    }
  },

  '.properties parse tests': {
    topic: function() {
      return CONFIG.util.parseFile(__dirname + '/config/default.properties');
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.parseFile);
    },
    'An object is returned': function(config) {
      assert.isObject(config);
    },
    'The correct object is returned': function(config) {
      assert.isObject(config.AnotherModule);
      assert.isTrue(config.AnotherModule.parm5 == "value5");
      assert.isObject(config['key with spaces']);
      assert.isTrue(config['key with spaces'].another_key == 'hello');
      assert.isUndefined(config.ignore_this_please);
      assert.isUndefined(config.i_am_a_comment);
    },
    'Variable replacements are working': function(config) {
      assert.isTrue(config.replacement.param == "foobar")
    },
    'Sections are supported': function(config) {
      assert.isDefined(config.section.param);
      assert.isUndefined(config.param);
    }
  },

  'loadFileConfigs() tests': {
    topic: function() {
      return CONFIG.util.loadFileConfigs();
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.loadFileConfigs);
    },
    'An object is returned': function(configs) {
      assert.isObject(configs);
    },
    'The correct object is returned': function(config) {
      assert.isObject(config.Customers);
      assert.isTrue(config.Customers.dbHost == 'base');
      assert.isTrue(config.Customers.dbName == 'override_from_runtime_json');
    }
  },

  'attachProtoDeep() tests': {
    topic: function() {
      // Create an object that contains other objects to see
      // that the prototype is added to all objects.
      var watchThis = {
        subObject: {
          item1: 23,
          subSubObject: {
        	item2: "hello"
          }
        }
      };
      return CONFIG.util.attachProtoDeep(watchThis);
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.attachProtoDeep);
    },
    'The original object is returned': function(config) {
      assert.isObject(config);
      assert.isTrue(config.subObject.item1 === 23);
      assert.isTrue(config.subObject.subSubObject.item2 === "hello");
    },
    'The cloneDeep method is attached to the object': function(config) {
      assert.isTrue({a:27}.a == config.util.cloneDeep({a:27}).a);
    },
    'The cloneDeep method is also attached to sub-objects': function(config) {
      assert.isTrue({a:27}.a == config.subObject.util.cloneDeep({a:27}).a);
      assert.isTrue({a:27}.a == config.subObject.subSubObject.util.cloneDeep({a:27}).a);
    },
    'Prototype methods are not exposed in the object': function(config) {
      // This test is here because altering object.__proto__ places the method
      // directly onto the object. That caused problems when iterating over the
      // object.  This implementation does the same thing, but hides them.
      assert.isTrue(JSON.stringify(config) == '{"subObject":{"item1":23,"subSubObject":{"item2":"hello"}}}');
    }
  },

  'getCmdLineArg() tests': {
    topic: function() {
        // Set process.argv example object
        var testArgv = [
            process.argv[0],
            process.argv[1],
            '--NODE_ENV=staging'
        ];
        process.argv = testArgv;
        return CONFIG.util.getCmdLineArg('NODE_ENV');
    },
    'The function exists': function() {
        assert.isFunction(CONFIG.util.getCmdLineArg);
    },
    'NODE_ENV should be staging': function(nodeEnv) {
        assert.equal(nodeEnv, 'staging');
    },
    'Returns false if the argument did not match': function() {
        assert.isFalse(CONFIG.util.getCmdLineArg('NODE_CONFIG_DIR'));
    },
    'Returns the argument (alternative syntax)': function() {
        process.argv.push('--NODE_CONFIG_DIR=/etc/nodeConfig');
        assert.equal(CONFIG.util.getCmdLineArg('NODE_CONFIG_DIR'), '/etc/nodeConfig');
    },
    'Returns always the first matching': function() {
        process.argv.push('--NODE_ENV=test');
        assert.equal(CONFIG.util.getCmdLineArg('NODE_ENV'), 'staging');
    },
    'Revert original process aruments': function() {
        assert.notEqual(process.argv, argvOrg);
        process.argv = argvOrg;
        assert.equal(process.argv, argvOrg);
    }
  },

  'toObject() tests': {
    topic: function() {
      return CONFIG.util.loadFileConfigs();
    },
    'The function exists': function() {
      assert.isFunction(CONFIG.util.toObject);
    },
    'Returns a serialized version of the current instance if no argument is provided': function() {
      assert.notDeepStrictEqual(CONFIG.util.toObject(), CONFIG);
    },
    'Returns a POJO': function() {
      assert.ok(!(CONFIG.util.toObject() instanceof CONFIG.constructor));
    },
    'Returns a serialized version of whatever argument is provided': function() {
      assert.notDeepStrictEqual(CONFIG.get('Customers'), {
        dbHost: 'base',
        dbName: 'override_from_runtime_json',
        dbPort: 5999,
        dbString: 'override_from_runtime_json:5999',
        random: 0.08624527123827352,
        dbPassword: 'real password',
        dbPassword2: 'another password',
        lang: ['en','de','es'],
        altDbPort: 4400,
        altDbPort1: 2209,
        emptySub: null
      });
    }
  }
})
.export(module);
