var requireUncached = require('./_utils/requireUncached');

// Dependencies
var vows   = require('vows'),
    assert = require('assert'),
    Path   = require('path');

vows.describe('Testing custom environment variable overrides')
.addBatch({
    'custom environment variable overrides,': {
        'with unset environment variables': {
            topic: function () {
                delete process.env.TEST_VALUE;
                delete process.env.TEST_JSON_VALUE;

                // Change the configuration directory for testing
                process.env.NODE_CONFIG_DIR = [__dirname + '/19-config'].join(Path.delimiter);
                var config = requireUncached(__dirname + '/../lib/config');
                return {
                     config,
                     configObject: config.util.parseFile(Path.join(__dirname,'/19-config/default.js'))
                 };
            },
            'should not override from the environment variables': function(topic) {
                assert.strictEqual(topic.config.testValue,topic.configObject.testValue);
                assert.deepStrictEqual(topic.config.testJSONValue,topic.configObject.testJSONValue);
            },
        },
        'with empty string environment variables': {
            topic: function () {
                process.env.TEST_VALUE = '';
                process.env.TEST_JSON_VALUE = '';

                // Change the configuration directory for testing
                process.env.NODE_CONFIG_DIR = [__dirname + '/19-config'].join(Path.delimiter);
                var config = requireUncached(__dirname + '/../lib/config');
                return {
                     config,
                     configObject: config.util.parseFile(Path.join(__dirname,'/19-config/default.js'))
                 };
            },
            'should not override from the environment variables': function(topic) {
                assert.strictEqual(topic.config.testValue,topic.configObject.testValue);
                assert.deepStrictEqual(topic.config.testJSONValue,topic.configObject.testJSONValue);
            },
        },
        'with string environment variables': {
            topic: function () {
                const testValue = 'from env';
                const jsonValue = {
                    fromJS: false,
                    type: 'stringified JSON'
                }
                process.env.TEST_VALUE = testValue;
                process.env.TEST_JSON_VALUE = JSON.stringify(jsonValue);

                // Change the configuration directory for testing
                process.env.NODE_CONFIG_DIR = [__dirname + '/19-config'].join(Path.delimiter);
                var config = requireUncached(__dirname + '/../lib/config');
                return {
                     config,
                     testValue,
                     jsonValue
                 };
            },
            'should override from the environment variables': function(topic) {
                assert.strictEqual(topic.config.testValue,topic.testValue);
                assert.deepStrictEqual(topic.config.testJSONValue,topic.jsonValue);
            },
        },
    },
})
.export(module);
