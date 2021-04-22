var requireUncached = require('./_utils/requireUncached');

// Dependencies
var vows = require('vows'),
    assert = require('assert'),
    FileSystem = require('fs');

/**
 * <p>Unit tests for the node-config library.  To run type:</p>
 * <pre>npm test</pre>
 * <p>Or, in a project that uses node-config:</p>
 * <pre>npm test config</pre>
 *
 * @class ConfigTest
 */

var CONFIG, MODULE_CONFIG, override, numberInteger, numberFloat;
vows.describe('Test suite for node-config')
.addBatch({
  'Library initialization': {
    topic : function () {
      // Change the configuration directory for testing
      process.env.NODE_CONFIG_DIR = __dirname + '/config';

      // Hard-code $NODE_ENV=test for testing
      process.env.NODE_ENV='test';

      // Test for multi-instance applications
      process.env.NODE_APP_INSTANCE='3';

      // Test $NODE_CONFIG environment and --NODE_CONFIG command line parameter
      process.env.NODE_CONFIG='{"EnvOverride":{"parm3":"overridden from $NODE_CONFIG","parm4":100}}';
      process.argv.push('--NODE_CONFIG={"EnvOverride":{"parm5":"overridden from --NODE_CONFIG","parm6":101}}');

      // Test Environment Variable Substitution
      override = 'CUSTOM VALUE FROM JSON ENV MAPPING';
      process.env.CUSTOM_JSON_ENVIRONMENT_VAR = override;

      // Test Environment variable substitution of boolean values
      process.env.CUSTOM_BOOLEAN_TRUE_ENVIRONMENT_VAR = 'true';
      process.env.CUSTOM_BOOLEAN_FALSE_ENVIRONMENT_VAR = 'false';
      process.env.CUSTOM_BOOLEAN_ERROR_ENVIRONMENT_VAR = 'notProperBoolean';

      // Test Environment variable substitution of numeric values
      numberInteger = 1001;
      numberFloat = 3.14
      process.env.CUSTOM_NUMBER_INTEGER_ENVIRONMENT_VAR = numberInteger;
      process.env.CUSTOM_NUMBER_FLOAT_ENVIRONMENT_VAR = numberFloat;
      process.env.CUSTOM_NUMBER_EMPTY_ENVIRONMENT_VAR = '';
      process.env.CUSTOM_NUMBER_STRING_ENVIRONMENT_VAR = 'String';

      CONFIG = requireUncached(__dirname + '/../lib/config');

      return CONFIG;

    },
    'Config library is available': function() {
      assert.isObject(CONFIG);
    },
    'Config extensions are included with the library': function() {
      assert.isFunction(CONFIG.util.cloneDeep);
    }
  },
})
.addBatch({
  'Configuration file Tests': {
    'Loading configurations from a JS module is correct': function() {
      assert.equal(CONFIG.Customers.dbHost, 'base');
      assert.equal(CONFIG.TestModule.parm1, 'value1');
    },

    'Loading configurations from a JSON file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm1, 'value1');
      assert.equal(CONFIG.Inline.a, '');
      assert.equal(CONFIG.Inline.b, '1');
      assert.equal(CONFIG.ContainsQuote, '"this has a quote"');
    },

    'Loading configurations from a .yaml YAML file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm2, 'value2');
    },

    'Loading configurations from a .yml YAML file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm2yml, 'value2yml');
    },

    'Loading configurations from a Coffee-Script file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm3, 'value3');
    },

    'Loading configurations from a CSON file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm4, 'value4');
    },

    'Loading configurations from a .properties file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm5, 'value5');
    },

    'Loading configurations from a JSON5 file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm6, 'value6');
    },

    'Loading configurations from a TOML file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm7, 'value7');
    },

    'Loading configurations from a Hjson file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm8, 'value8');
    },

    'Loading configurations from a XML file is correct': function() {
      assert.equal(CONFIG.AnotherModule.parm9, 'value9');
    },

    'Loading configurations from an environment file is correct': function() {
      assert.equal(CONFIG.Customers.dbPort, '5999');
    },

    'Loading configurations from the local file is correct': function() {
      assert.equal(CONFIG.Customers.dbPassword, 'real password');
    },

    'Loading configurations from the local environment file is correct': function() {
      assert.equal(CONFIG.Customers.dbPassword2, 'another password');
      assert.deepEqual(CONFIG.Customers.lang, ['en','de','es']);
    }

  },

  'Immutability': {
    'Correct mute setup var': function () {
      assert.equal(CONFIG.MuteThis, 'hello');
    },

    'Mutation sticks': function () {
      CONFIG.MuteThis = 'world';
      assert.equal(CONFIG.MuteThis, 'world');
    },

    'No mutation after the first get()': function () {
      assert.equal(CONFIG.get('MuteThis'), 'world');
      CONFIG.MuteThis = 'backToHello';
      assert.equal(CONFIG.MuteThis, 'world');
    }
  },

  'Configurations from the $NODE_CONFIG environment variable': {
    'Configuration can come from the $NODE_CONFIG environment': function() {
      assert.equal(CONFIG.EnvOverride.parm3, 'overridden from $NODE_CONFIG');
    },

    'Type correct configurations from $NODE_CONFIG': function() {
      assert.equal(CONFIG.EnvOverride.parm4, 100);
    }

  },

  'Configurations from the --NODE_CONFIG command line': {
    'Configuration can come from the --NODE_CONFIG command line argument': function() {
      assert.equal(CONFIG.EnvOverride.parm5, 'overridden from --NODE_CONFIG');
    },

    'Type correct configurations from --NODE_CONFIG': function() {
      assert.equal(CONFIG.EnvOverride.parm6, 101);
    }

  },

  'Configurations from custom environment variables': {
    // only testing the `custom-environment-variables.json` now
    // NOT testing unset environment variable because of module caching (CONFIG would have to be recreated
    // NOT testing absence of `custom-environment-variables.json` because current tests don't mess with the filesystem
    'Configuration can come from an environment variable mapped in custom_environment_variables.json': function () {
      assert.equal(CONFIG.get('customEnvironmentVariables.mappedBy.json'), override);
    },

    'Environment variables specified as boolean true': function () {
      assert.equal(CONFIG.get('customEnvironmentVariables.mappedBy.formats.booleanTrue'), true);
    },

    'Environment variables specified as boolean false': function () {
      assert.equal(CONFIG.get('customEnvironmentVariables.mappedBy.formats.booleanFalse'), false);
    },

    'Environment variables not specified as a proper boolean value': function () {
      assert.equal(CONFIG.get('customEnvironmentVariables.mappedBy.formats.notProperBoolean'), false);
    },

    'Environment variables specified as an integer number': function () {
      assert.equal(CONFIG.get('customEnvironmentVariables.mappedBy.formats.numberInteger'), numberInteger);
    },

    'Environment variables specified as a floating number': function () {
      assert.equal(CONFIG.get('customEnvironmentVariables.mappedBy.formats.numberFloat'), numberFloat);
    },

    'Environment variables specified as a number but empty string passed': function () {
      assert.throws(function () { CONFIG.get('customEnvironmentVariables.mappedBy.formats.numberEmpty'); },
        /Configuration property "customEnvironmentVariables.mappedBy.formats.numberEmpty" is not defined/
      )
    },

    'Environment variables specified as a number but alphanumeric string passed': function () {
      assert.throws(function () { CONFIG.get('customEnvironmentVariables.mappedBy.formats.numberString'); },
        /Configuration property "customEnvironmentVariables.mappedBy.formats.numberString" is not defined/
      )
    },
  },

 'Assuring a configuration property can be hidden': {
    topic: function() {
      var object = {
        item1: 23,
        subObject: {
      	  item2: "hello"
        }
      };
      return object;
    },

    'The makeHidden() method is available': function() {
      assert.isFunction(CONFIG.util.makeHidden);
    },

    'The test object (before hiding) is correct': function(object) {
      assert.isTrue(JSON.stringify(object) == '{"item1":23,"subObject":{"item2":"hello"}}');
    },

    'The test object (after hiding) is correct': function(object) {
      CONFIG.util.makeHidden(object, 'item1');
      assert.isTrue(JSON.stringify(object) == '{"subObject":{"item2":"hello"}}');
    },

    'The hidden property is readable, and has not changed': function(object) {
      assert.isTrue(JSON.stringify(object) == '{"subObject":{"item2":"hello"}}');
      assert.isTrue(object.item1 == 23);
    }

  },

  'Assuring a configuration property can be made immutable': {
    topic: function() {

      CONFIG.util.makeImmutable(CONFIG.TestModule, 'parm1');
      CONFIG.TestModule.parm1 = "setToThis";
      return CONFIG.TestModule.parm1;
    },

    'The makeImmutable() method is available': function() {
      assert.isFunction(CONFIG.util.makeImmutable);
    },

    'Correctly unable to change an immutable configuration': function(value) {
      assert.isTrue(value != "setToThis");
    },

    'Left the original value intact after attempting the change': function(value) {
      assert.equal(value, "value1");
    }
  },

  'Assuring a configuration array property can be made immutable': {
    'Correctly unable to change an immutable configuration': function() {
      CONFIG.util.makeImmutable(CONFIG.TestModule, 'arr1');
      CONFIG.TestModule.arr1 = ['bad value'];
      assert.isTrue(CONFIG.TestModule.arr1[0] == 'arrValue1');
    },

    'Correctly unable to add values to immutable array': function() {
      CONFIG.util.makeImmutable(CONFIG.TestModule, 'arr1');
      try {
        CONFIG.TestModule.arr1.push('bad value');
      } catch (err) {
        assert.isTrue(err.name == 'TypeError');
      }

      assert.isTrue(!CONFIG.TestModule.arr1.includes('bad value'));
    }
  },

  'get() tests': {
    'The function exists': function() {
      assert.isFunction(CONFIG.get);
    },
    'A top level item is returned': function() {
      assert.isTrue(typeof CONFIG.get('TestModule') === 'object');
    },
    'A sub level item is returned': function() {
      assert.equal(CONFIG.get('Customers.dbHost'), 'base');
    },
    'get is attached deeply': function() {
      assert.equal(CONFIG.Customers.get('dbHost'), 'base');
    },
    'An extended property accessor remains a getter': function() {
      assert.equal(CONFIG.get('customerDbPort'), '5999');
    },
    'A cloned property accessor remains a getter': function() {
      assert.equal(CONFIG.Customers.get('dbString'), 'override_from_runtime_json:5999');
    },
    'A cloned property accessor is made immutable': function() {
      var random1 = CONFIG.Customers.get('random'),
          random2 = CONFIG.Customers.get('random');

      assert.equal(random1, random2);
    },
    'A proper exception is thrown on mis-spellings': function() {
      assert.throws(
        function () { CONFIG.get('mis.spelled'); },
        /Configuration property "mis.spelled" is not defined/
      );
    },
    'An exception is thrown on non-objects': function() {
      assert.throws(
          function () { CONFIG.get('Testmodule.misspelled'); },
          /Configuration property "Testmodule.misspelled" is not defined/
      );
    },
    'get(undefined) throws an exception': function() {
      assert.throws(
          function () { CONFIG.get(undefined); },
          /Calling config.get with null or undefined argument/
      );
    },
    'get(null) throws an exception': function() {
      assert.throws(
          function () { CONFIG.get(null); },
          /Calling config.get with null or undefined argument/
      );
    },
    "get('') throws an exception": function() {
      assert.throws(
          function () { CONFIG.get(''); },
          /Configuration property "" is not defined/
      );
    },
  },

  'has() tests': {
    'The function exists': function() {
      assert.isFunction(CONFIG.has);
    },
    'A top level item can be tested': function() {
      assert.isTrue(CONFIG.has('TestModule'));
    },
    'A sub level item can be tested': function() {
      assert.isTrue(CONFIG.has('Customers.dbHost'));
    },
    'A missing sub level item can be tested': function() {
      assert.isTrue(CONFIG.has('Customers.emptySub'));
      assert.isFalse(CONFIG.has('Customers.emptySub.foo'));
    },
    'has is attached deeply': function() {
      assert.isTrue(CONFIG.Customers.has('dbHost'));
    },
    'Correctly identifies not having element': function() {
      assert.isTrue(!CONFIG.Customers.has('dbHosx'));
    },
    'Correctly identifies not having element (deep)': function() {
      assert.isTrue(!CONFIG.has('Customers.dbHosx'));
    },
    'has(undefined) returns false': function() {
      assert.isFalse(CONFIG.has(undefined));
    },
    "has(null) returns false": function() {
      assert.isFalse(CONFIG.has(null));
    },
    "has('') returns false": function() {
      assert.isFalse(CONFIG.has(''));
    },
  },

  'Configuration for module developers': {
    topic: function() {
      MODULE_CONFIG = requireUncached(__dirname + '/../lib/config');

      // Set some parameters for the test module
      return MODULE_CONFIG.util.setModuleDefaults("TestModule", {
        parm1: 1000, parm2: 2000, parm3: 3000,
        nested: {
          param4: 4000,
          param5: 5000
        }
      });
    },

    'The setModuleDefaults() method is available': function() {
      assert.isFunction(MODULE_CONFIG.util.setModuleDefaults);
    },

    'The module config is in the CONFIG object': function(moduleConfig) {
      assert.isObject(MODULE_CONFIG.TestModule);
      assert.deepEqual(MODULE_CONFIG.TestModule, moduleConfig);
    },

    // Regression test for https://github.com/lorenwest/node-config/issues/518
    'The module config did not extend itself with its own name': function(moduleConfig) {
      assert.isFalse('TestModule' in moduleConfig);
      assert.isFalse('TestModule' in MODULE_CONFIG.TestModule);
    },

    'Local configurations are mixed in': function(moduleConfig) {
      assert.equal(moduleConfig.parm1, "value1");
    },

    'Defaults remain intact unless overridden': function(moduleConfig) {
      assert.equal(moduleConfig.parm2, 2000);
    },

    'Prototypes are applied by setModuleDefaults even if no previous config exists for the module': function() {
      var BKTestModuleDefaults = {
        parm1: 1000, parm2: 2000, parm3: 3000,
        nested: {
          param4: 4000,
          param5: 5000
        }
      };
      var OtherTestModuleDefaults = {
        parm6: 6000, parm7: 7000,
        other: {
          param8: 8000,
          param9: 9000
        }
      };

      MODULE_CONFIG.util.setModuleDefaults('BKTestModule', BKTestModuleDefaults);
      MODULE_CONFIG.util.setModuleDefaults('services.OtherTestModule', OtherTestModuleDefaults);

      var testModuleConfig = MODULE_CONFIG.get('BKTestModule');
      var testSubModuleConfig = MODULE_CONFIG.get('services');

      assert.deepEqual(BKTestModuleDefaults.nested, testModuleConfig.get('nested'));
      assert.deepEqual(OtherTestModuleDefaults.other, testSubModuleConfig.OtherTestModule.other);
    }
  },
})
  .addBatch({
    'Library initialization from multiple directories': {
      topic : function () {
        // Change the configuration directory for testing
        process.env.NODE_CONFIG_DIR = __dirname + '/config:' + __dirname + '/x-config';

        // Hard-code $NODE_ENV=test for testing
        process.env.NODE_ENV='test';

        // Test for multi-instance applications
        process.env.NODE_APP_INSTANCE='3';

        // Test $NODE_CONFIG environment and --NODE_CONFIG command line parameter
        process.env.NODE_CONFIG='{"EnvOverride":{"parm3":"overridden from $NODE_CONFIG","parm4":100}}';
        process.argv.push('--NODE_CONFIG={"EnvOverride":{"parm5":"overridden from --NODE_CONFIG","parm6":101}}');

        // Test Environment Variable Substitution
        override = 'CUSTOM VALUE FROM JSON ENV MAPPING';
        process.env.CUSTOM_JSON_ENVIRONMENT_VAR = override;

        CONFIG = requireUncached(__dirname + '/../lib/config');

        return CONFIG;

      },
      'Config library is available': function() {
        assert.isObject(CONFIG);
      },
      'Config extensions are included with the library': function() {
        assert.isFunction(CONFIG.util.cloneDeep);
      }
    },
    'Multiple config directories': {
      'Verify first directory loaded': function() {
        assert.equal(CONFIG.get('Customers.dbName'), 'from_default_xml');
      },
      'Verify second directory loaded': function() {
        assert.equal(CONFIG.get('different.dir'), true);
      },
      'Verify correct resolution order': function() {
        assert.equal(CONFIG.get('AnotherModule.parm4'), 'x_config_4_win');
      },
    }
  })
.export(module);
