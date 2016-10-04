// See resolver.md for some notes about how this works.
var deferredCount = 0;

// Class that wraps special functions that are evaluated after all config 
// overrides are in place.
function DeferredConfig () {}

// Users use this function in their JavaScript config files to specify config 
// values that depend on others. This returns a DeferredConfig object that
// wraps the function (refered to simply as "the deferred").
function deferConfig(func) {
  deferredCount++;
  var obj = Object.create(DeferredConfig.prototype);
  obj.resolve = func;
  return obj;
}

// The main function that resolves the entire config tree, evaluating and
// replacing all deferreds.
function resolve(mainConfig) {
  if (!deferredCount) return;
  var main = new Resolver(mainConfig);
  main.resolve();
}

// Resolver objects define getters for each of the properties in a config node.
// The purpose of the Resolver objects is to proxy those nodes, so that they
// can participate in expressions inside deferred functions.
// The constructor itself does not recurse; it only defines getters for the 
// immediate children.
var Resolver = function(config, main) {
  var self = this;
  if (!main) main = self;

  // The enumerable keys of config that we care about
  var childKeys = Object.keys(config).filter(function(k) {
    return config.hasOwnProperty(k) && typeof config[k] !== 'undefined';
  });

  // Create a non-enumerable property, __data__, to hold bookkeeping data
  var data = {
    main: main,
    config: config,
    childKeys: childKeys,
  };
  Object.defineProperty(self, '__data__', {
    __proto__: null,
    value: data,
  });

  // Make the getters.
  // Contract: for every enumerable property (k, v) of a config node, the getter
  // returns either the original atom from the config, or a resolver (never an object or a
  // deferred)
  var values = {};  // memoize the results
  childKeys.forEach(function(key) {
    Object.defineProperty(self, key, {
      __proto__: null,
      enumerable: true,
      configurable: false,
      get: function() {
        if (key in values) return values[key];
        return values[key] = self.newNode(config[key]);
      }
    });
  });
};

// resolver.newNode() - passes through or creates resolver tree nodes 
// corresponding to config tree nodes. The `node` argument can be of any type. 
// This evaluates deferred functions, and wraps config objects in resolvers, as 
// needed. Contract: the return value is guaranteed to be an atom or a resolver
Resolver.prototype.newNode = function(node) {
  var self = this,
      main = self.__data__.main;
  var t = nodeType(node);
  return (t === 'atom') ? node :
         (t === 'resolver') ? node :
         // deferreds are evaluated recursively:
         (t === 'deferred') ? self.newNode(node.resolve.call(main, main)) :
         new Resolver(node, main);
};

// resolver.resolve() - recursively resolves all of the data in the config tree.
// Contract: after this executes, the `config` node corresponding to this 
// resolver will be an atom or an object tree such that:
// - there are no deferreds or resolvers anywhere in the tree
// - every node in the tree is the corresponding original atom or object from 
//   the config tree (i.e., there are no clones)
Resolver.prototype.resolve = function() {
  var self = this,
      data = self.__data__,
      config = data.config,
      childKeys = data.childKeys;
  childKeys.forEach(function(key) {
    var v = self[key];      // either an atom or a resolver
    if (nodeType(v) === 'atom')
      config[key] = v;
    else {  // resolver
      v.resolve();
      config[key] = v.__data__.config;
    }
  });
};

// There are four main types for the nodes in a configuration tree: atoms, 
// objects (which include arrays), DeferredConfigs (deferreds, for short), and 
// resolvers.
var nodeType = function(node) {
  if (node instanceof Resolver) return 'resolver';
  if (typeof node !== 'object' || !node) return 'atom';
  if (node instanceof Date) return 'atom';
  // The test for DeferredConfig addresses the concern in this PR (but it's not 
  // a complete fix): https://github.com/lorenwest/node-config/pull/205.
  if (node instanceof DeferredConfig ||
    (('constructor' in node) && (node.constructor.name === 'DeferredConfig')))
    return 'deferred';
  return 'object';
};

module.exports = {
  deferConfig: deferConfig,
  DeferredConfig: DeferredConfig,
  resolve: resolve,
  deferredCount: deferredCount,   // export this in case it's useful
};
