/**
 * <p>Unit tests</p>
 *
 * @module test
 */

// Change the configuration directory for testing
process.env.NODE_CONFIG_DIR = __dirname + '/config';

// Hardcode $NODE_ENV=test for testing
process.env.NODE_ENV = 'test';

// Test for multi-instance applications
process.env.NODE_APP_INSTANCE = '3';

// Test $NODE_CONFIG environment and --NODE_CONFIG command line parameter
process.env.NODE_CONFIG = '{"EnvOverride":{"parm3":"overridden from $NODE_CONFIG","parm4":100}}'
process.argv.push('--NODE_CONFIG={"EnvOverride":{"parm5":"overridden from --NODE_CONFIG","parm6":101}}');

// Dependencies
var CONFIG = require('../lib/config');
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
exports.PrivateTest = vows.describe('Protected (hackable) utilities test').addBatch({
    'Library initialization': {
        'Library is available': function() {
            assert.isObject(CONFIG);
        }
    },

    'isObject() tests': {
        'The function exists': function() {
            assert.isFunction(CONFIG.util.isObject);
        },
        'Correctly identifies objects': function() {
            assert.isTrue(CONFIG.util.isObject({
                A: "b"
            }));
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
                elem0: true,
                elem1: "Element 1",
                elem2: 2,
                elem3: [1, 2, 3],
                elem4: function() {
                    return "hello";
                },
                elem5: {
                    sub1: "sub 1",
                    sub2: 2,
                    sub3: [1, 2, 3]
                }
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
            assert.isObject(CONFIG.util.cloneDeep({
                a: 1,
                b: 2
            }));
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
        }
    },

    'extendDeep() tests': {
        'The function exists': function() {
            assert.isFunction(CONFIG.util.extendDeep);
        },
        'Performs normal extend': function() {
            var orig = {
                elem1: "val1",
                elem2: "val2"
            };
            var extWith = {
                elem3: "val3"
            };
            var shouldBe = {
                elem1: "val1",
                elem2: "val2",
                elem3: "val3"
            };
            assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
        },
        'Replaces non-objects': function() {
            var orig = {
                elem1: "val1",
                elem2: ["val2", "val3"],
                elem3: {
                    sub1: "val4"
                }
            };
            var extWith = {
                elem1: 1,
                elem2: ["val4"],
                elem3: "val3"
            };
            var shouldBe = {
                elem1: 1,
                elem2: ["val4"],
                elem3: "val3"
            };
            assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
        },
        'Merges objects': function() {
            var orig = {
                e1: "val1",
                elem2: {
                    sub1: "val4",
                    sub2: "val5"
                }
            };
            var extWith = {
                elem2: {
                    sub2: "val6",
                    sub3: "val7"
                }
            };
            var shouldBe = {
                e1: "val1",
                elem2: {
                    sub1: "val4",
                    sub2: "val6",
                    sub3: "val7"
                }
            };
            assert.deepEqual(CONFIG.util.extendDeep(orig, extWith), shouldBe);
        },
        'Correctly types new objects and arrays': function() {
            var orig = {
                e1: "val1",
                e3: ["val5"]
            };
            var extWith = {
                e2: {
                    elem1: "val1"
                },
                e3: ["val6", "val7"]
            };
            var shouldBe = {
                e1: "val1",
                e2: {
                    elem1: "val1"
                },
                e3: ["val6", "val7"]
            };
            var ext = CONFIG.util.extendDeep({}, orig, extWith);
            assert.isObject(ext.e2);
            assert.isArray(ext.e3);
        },
        'Keeps non-merged objects intact': function() {
            var orig = {
                e1: "val1",
                elem2: {
                    sub1: "val4",
                    sub2: "val5"
                }
            };
            var shouldBe = {
                e1: "val1",
                elem2: {
                    sub1: "val4",
                    sub2: "val5"
                }
            };
            var extWith = {
                elem3: {
                    sub2: "val6",
                    sub3: "val7"
                }
            };
            CONFIG.util.extendDeep({}, orig, extWith);
            assert.deepEqual(orig, shouldBe);
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
            assert.isTrue(CONFIG.util.equalsDeep([1, 'hello', 2], [1, 'hello', 2]));
        },
        'Succeeds on the same object': function() {
            var a = {
                hello: 'world'
            };
            assert.isTrue(CONFIG.util.equalsDeep(a, a));
        },
        'Succeeds on a regular object': function() {
            var a = {
                value_3: 14,
                hello: 'world',
                value_1: 29
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14
            };
            assert.isTrue(CONFIG.util.equalsDeep(a, b));
        },
        'Succeeds on a deep object': function() {
            var a = {
                value_3: 14,
                hello: 'world',
                value_1: 29,
                value_4: ['now', 'is', 'the', 'time']
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14,
                value_4: ['now', 'is', 'the', 'time']
            };
            var c = {
                creditLimit: 10000,
                deepValue: a
            };
            var d = {
                deepValue: b,
                creditLimit: 10000
            };
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
            var a = {
                value_3: 14,
                hello: 'world',
                value_1: 29,
                otherElem: 40
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14
            };
            assert.isFalse(CONFIG.util.equalsDeep(a, b));
        },
        'Fails if object2 has more elements': function() {
            var a = {
                value_1: 29,
                hello: 'world',
                value_3: 14
            };
            var b = {
                value_3: 14,
                hello: 'world',
                value_1: 29,
                otherElem: 40
            };
            assert.isFalse(CONFIG.util.equalsDeep(a, b));
        },
        'Fails if any value is different': function() {
            var a = {
                value_1: 30,
                hello: 'world',
                value_3: 14,
                value_4: ['now', 'is', 'the', 'time']
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14,
                value_4: ['now', 'is', 'the', 'time']
            };
            assert.isFalse(CONFIG.util.equalsDeep(a, b));
            var a = {
                value_1: 29,
                hello: 'world',
                value_3: 14,
                value_4: ['now', 'is', 'the', 'time']
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14,
                value_4: ['now', 'isnt', 'the', 'time']
            };
            assert.isFalse(CONFIG.util.equalsDeep(a, b));
        }
    },

    'diffDeep() tests': {
        'The function exists': function() {
            assert.isFunction(CONFIG.util.diffDeep);
        },
        'Returns an empty object if no differences': function() {
            var a = {
                value_3: 14,
                hello: 'world',
                value_1: 29
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14
            };
            assert.equal(typeof(CONFIG.util.diffDeep(a, b)), 'object');
            assert.isTrue(Object.keys(CONFIG.util.diffDeep(a, b)).length == 0);
        },
        'Returns an empty object if no differences (deep)': function() {
            var a = {
                value_3: 14,
                hello: 'world',
                value_1: 29,
                value_4: [1, 'hello', 2],
                deepObj: {
                    a: 22,
                    b: {
                        c: 45,
                        a: 44
                    }
                }
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14,
                value_4: [1, 'hello', 2],
                deepObj: {
                    a: 22,
                    b: {
                        a: 44,
                        c: 45
                    }
                }
            };
            assert.equal(typeof(CONFIG.util.diffDeep(a, b)), 'object');
            assert.isTrue(Object.keys(CONFIG.util.diffDeep(a, b)).length == 0);
        },
        'Returns just the diff values': function() {
            var a = {
                value_3: 14,
                hello: 'wurld',
                value_1: 29,
                deepObj: {
                    a: 22,
                    b: {
                        c: 45,
                        a: 44
                    }
                }
            };
            var b = {
                value_1: 29,
                hello: 'world',
                value_3: 14,
                deepObj: {
                    a: 22,
                    b: {
                        a: 44,
                        c: 45
                    }
                }
            };
            var diff = CONFIG.util.diffDeep(a, b);
            assert.equal(Object.keys(diff).length, 1);
            assert.equal(diff.hello, 'world');
        },
        'Returns just the diff values (deep)': function() {
            var a = {
                value_3: 14,
                hello: 'wurld',
                value_1: 29,
                value_4: [1, 'hello', 2],
                deepObj: {
                    a: 22,
                    b: {
                        c: 45,
                        a: 44
                    }
                }
            };
            var b = {
                value_1: 29,
                hello: 'wurld',
                value_3: 14,
                value_4: [1, 'goodbye', 2],
                deepObj: {
                    a: 22,
                    b: {
                        a: 45,
                        c: 44
                    }
                }
            };
            var diff = CONFIG.util.diffDeep(a, b);
            assert.equal(Object.keys(diff).length, 2);
            assert.equal(Object.keys(diff.deepObj).length, 1);
            assert.equal(Object.keys(diff.deepObj.b).length, 2);
            assert.equal(diff.deepObj.b.a, 45);
            assert.equal(diff.deepObj.b.c, 44);
            assert.deepEqual(diff.value_4, [1, 'goodbye', 2]);
        }
    },

    'invertDeep() tests': {
        topic: function() {
            var topic = {
                TopLevel: 'SOME_TOP_LEVEL',
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
                    parm_number_1: "from_default_js2",
                    parm2: "twenty_two"
                }
            };
            // it seems like vows doesn't refresh topic between tests
            return CONFIG.util.cloneDeep(topic);
        },
        'Properly inverts a deep Object': function(topic) {
            var inversion = CONFIG.util.invertDeep(CONFIG.util.cloneDeep(topic));
            assert.deepEqual(inversion.SOME_TOP_LEVEL, ['TopLevel']);
            assert.deepEqual(inversion.value1, ['TestModule', 'parm1']);
            assert.deepEqual(inversion.base, ['Customers', 'dbHost']);
            assert.deepEqual(inversion.from_default_js, ['Customers', 'dbName']);
            assert.deepEqual(inversion.a_api_key, ['Customers', 'oauth', 'key']);
            assert.deepEqual(inversion.an_api_secret, ['Customers', 'oauth', 'secret']);
            assert.deepEqual(inversion.from_default_js2, ['EnvOverride', 'parm_number_1']);
            assert.deepEqual(inversion.twenty_two, ['EnvOverride', 'parm2']);
        },
        'Throws an error for Array values': function(topic) {
            topic.Customers.dbHost = ['a', 'b', 'c'];
            assert.throws(function() {
                CONFIG.util.invertDeep(topic);
            });
        },
        'Throws an error for Boolean values': function(topic) {
            topic.Customers.dbHost = false;
            assert.throws(function() {
                CONFIG.util.invertDeep(topic);
            });
        },
        'Throws an error for Numeric values': function(topic) {
            topic.Customers.dbHost = 443;
            assert.throws(function() {
                CONFIG.util.invertDeep(topic);
            });
        },
        'Throws an error for null values': function(topic) {
            topic.Customers.dbHost = null;
            assert.throws(function() {
                CONFIG.util.invertDeep(topic);
            });
        },
        'Throws an error for Undefined values': function(topic) {
            topic.Customers.dbHost = undefined;
            assert.throws(function() {
                CONFIG.util.invertDeep(topic);
            });
        },
        'Throws an error for NaN values': function(topic) {
            topic.Customers.dbHost = NaN;
            assert.throws(function() {
                CONFIG.util.invertDeep(topic);
            });
        }
    },

    'substituteDeep() tests': {
        topic: function() {
            var topic = {
                TopLevel: 'SOME_TOP_LEVEL',
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
                    parm_number_1: "from_default_js2",
                    parm2: "twenty_two"
                }
            };
            return topic;
        },
        'returns an empty object if the variables mapping is empty': function(topic){
            vars = {};
            var substituted = CONFIG.util.substituteDeep(topic,vars);
            assert.deepEqual(substituted, {});
        }
    },

    'setPath() tests:': {
        topic: function() {
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
        'Ignores null values': function(topic) {
            CONFIG.util.setPath(topic, ['Customers', 'oauth', 'secret'], null);
            assert.equal(topic.Customers.oauth.secret, 'an_api_secret');
        },
        'Creates toplevel keys to set new values': function(topic) {
            CONFIG.util.setPath(topic, ['NewKey'], 'NEW_VALUE');
            assert.equal(topic.NewKey, 'NEW_VALUE');
        },
        'Creates subkeys to set new values': function(topic) {
            CONFIG.util.setPath(topic, ['TestModule', 'oauth'], 'NEW_VALUE');
            assert.equal(topic.TestModule.oauth, 'NEW_VALUE');
        },
        'Creates parents to set new values': function(topic) {
            CONFIG.util.setPath(topic, ['EnvOverride', 'oauth', 'secret'], 'NEW_VALUE');
            assert.equal(topic.EnvOverride.oauth.secret, 'NEW_VALUE');
        },
        'Overwrites existing values': function(topic) {
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
            assert.isTrue({
                a: 27
            }.a == config.util.cloneDeep({
                a: 27
            }).a);
        },
        'The cloneDeep method is also attached to sub-objects': function(config) {
            assert.isTrue({
                a: 27
            }.a == config.subObject.util.cloneDeep({
                a: 27
            }).a);
            assert.isTrue({
                a: 27
            }.a == config.subObject.subSubObject.util.cloneDeep({
                a: 27
            }).a);
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
    }

});
