/**
 * <p>Unit tests</p>
 *
 * @module test
 */

var requireUncached = require("./_utils/requireUncached");

var vows = require("vows");
var assert = require("assert");

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
vows
  .describe("Array Substitution in custom-env-variables")
  .addBatch({
    // We initialize the object in a batch so that the globals get changed at /run-time/ not /require-time/,
    // avoiding conflicts with other tests.
    // We initialize in our own /batch/ because batches are run in serial, while individual contexts run in parallel.
    "Library initialization": {
      topic: function() {
        // Change the configuration directory for testing
        process.env.NODE_CONFIG_DIR = __dirname + "/config";

        // Hardcode $NODE_ENV=test for testing
        process.env.NODE_ENV = "test";

        // Test for multi-instance applications
        process.env.NODE_APP_INSTANCE = "3";

        // Test $NODE_CONFIG environment and --NODE_CONFIG command line parameter
        process.env.NODE_CONFIG =
          '{"EnvOverride":{"parm3":"overridden from $NODE_CONFIG","parm4":100}}';
        process.argv.push(
          '--NODE_CONFIG={"EnvOverride":{"parm5":"overridden from --NODE_CONFIG","parm6":101}}'
        );

        // Test Environment Variable Substitution
        var override = "CUSTOM VALUE FROM JSON ENV MAPPING";
        process.env["CUSTOM_JSON_ENVIRONMENT_VAR"] = override;

        // Dependencies
        CONFIG = requireUncached(__dirname + "/../lib/config");

        return CONFIG;
      },
      "Library is available": function(config) {
        assert.isObject(config);
      }
    }
  })
  .addBatch({
    'substituteDeep() array tests': {
      topic: function() {
        var topic = {
          TopLevel: 'SOME_TOP_LEVEL',
          TestArrayToReplace: {
            urls: [
              "https://{{DOMAIN_NAME}}/index.html",
              "https://{{DOMAIN_NAME}}/ashish.html",
              "https://{{DOMAIN_NAME}}/home.html"
            ]
          } 
        };
        return topic;
      },
      'Substitute if present in ENV VARIABLE': function(topic) {
        const vars = {
          DOMAIN_NAME: "localhost"
        };
        
        const substitute = CONFIG.util.substituteDeep(topic, vars);
        assert.deepEqual(substitute, {
          TestArrayToReplace: {
            urls: [
              "https://localhost/index.html",
              "https://localhost/ashish.html",
              "https://localhost/home.html"
            ]
          } 
        })
      },
      'DO NOT substitute ENV VARIABLE if not present': function(topic) {
        const substitute = CONFIG.util.substituteDeep(topic, {});
        assert.deepEqual(substitute, {});
      }
    }
  })
  .export(module);
