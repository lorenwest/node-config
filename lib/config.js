// config.js (c) 2010-2015 Loren West and other contributors
// May be freely distributed under the MIT license.
// For further details and documentation:
// http://lorenwest.github.com/node-config

// Dependencies
var Yaml = null,    // External libraries are lazy-loaded
    VisionmediaYaml = null,  // only if these file types exist.
    Coffee = null,
    Iced = null,
    CSON = null,
    PPARSER = null,
    JSON5 = null,
    TOML = null,
    HJSON = null,
    deferConfig = require('../defer').deferConfig,
    DeferredConfig = require('../defer').DeferredConfig,
    Utils = require('util'),
    Path = require('path'),
    FileSystem = require('fs');

// Static members
var DEFAULT_CLONE_DEPTH = 20,
    NODE_CONFIG, CONFIG_DIR, RUNTIME_JSON_FILENAME, NODE_ENV, APP_INSTANCE,
    HOST, HOSTNAME, ALLOW_CONFIG_MUTATIONS,
    env = {},
    privateUtil = {},
    deprecationWarnings = {},
    configSources = [],          // Configuration sources - array of {name, original, parsed}
    checkMutability = true;      // Check for mutability/immutability on first get

/**
 * <p>Application Configurations</p>
 *
 * <p>
 * The config module exports a singleton object representing all
 * configurations for this application deployment.
 * </p>
 *
 * <p>
 * Application configurations are stored in files within the config directory
 * of your application.  The default configuration file is loaded, followed
 * by files specific to the deployment type (development, testing, staging,
 * production, etc.).
 * </p>
 *
 * <p>
 * For example, with the following config/default.yaml file:
 * </p>
 *
 * <pre>
 *   ...
 *   customer:
 *     &nbsp;&nbsp;initialCredit: 500
 *     &nbsp;&nbsp;db:
 *       &nbsp;&nbsp;&nbsp;&nbsp;name: customer
 *       &nbsp;&nbsp;&nbsp;&nbsp;port: 5984
 *   ...
 * </pre>
 *
 * <p>
 * The following code loads the customer section into the CONFIG variable:
 * <p>
 *
 * <pre>
 *   var CONFIG = require('config').customer;
 *   ...
 *   newCustomer.creditLimit = CONFIG.initialCredit;
 *   database.open(CONFIG.db.name, CONFIG.db.port);
 *   ...
 * </pre>
 *
 * @module config
 * @class Config
 */

/**
 * <p>Get the configuration object.</p>
 *
 * <p>
 * The configuration object is a shared singleton object within the application,
 * attained by calling require('config').
 * </p>
 *
 * <p>
 * Usually you'll specify a CONFIG variable at the top of your .js file
 * for file/module scope. If you want the root of the object, you can do this:
 * </p>
 * <pre>
 * var CONFIG = require('config');
 * </pre>
 *
 * <p>
 * Sometimes you only care about a specific sub-object within the CONFIG
 * object.  In that case you could do this at the top of your file:
 * </p>
 * <pre>
 * var CONFIG = require('config').customer;
 * or
 * var CUSTOMER_CONFIG = require('config').customer;
 * </pre>
 *
 * <script type="text/javascript">
 *   document.getElementById("showProtected").style.display = "block";
 * </script>
 *
 * @method constructor
 * @return CONFIG {object} - The top level configuration object
 */
var Config = function() {
  var t = this;

  // Bind all utility functions to this
  for (var fnName in util) {
    util[fnName] = util[fnName].bind(t);
  }

  // Merge configurations into this
  util.extendDeep(t, util.loadFileConfigs());
  util.attachProtoDeep(t);

  // Perform strictness checks and possibly throw an exception.
  util.runStrictnessChecks(t);
};

/**
 * Utilities are under the util namespace vs. at the top level
 */
var util = Config.prototype.util = {};

/**
 * Underlying get mechanism
 *
 * @private
 * @method getImpl
 * @param object {object} - Object to get the property for
 * @param property {string | array[string]} - The property name to get (as an array or '.' delimited string)
 * @return value {mixed} - Property value, including undefined if not defined.
 */
var getImpl= function(object, property) {
  var t = this,
      elems = Array.isArray(property) ? property : property.split('.'),
      name = elems[0],
      value = object[name];
  if (elems.length <= 1) {
    return value;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  return getImpl(value, elems.slice(1));
};


/**
 * <p>Get a configuration value</p>
 *
 * <p>
 * This will return the specified property value, throwing an exception if the
 * configuration isn't defined.  It is used to assure configurations are defined
 * before being used, and to prevent typos.
 * </p>
 *
 * @method get
 * @param property {string} - The configuration property to get. Can include '.' sub-properties.
 * @return value {mixed} - The property value
 */
Config.prototype.get = function(property) {
  if(property === null || property === undefined){
    throw new Error("Calling config.get with null or undefined argument");
  }
  var t = this,
      value = getImpl(t, property);

  // Produce an exception if the property doesn't exist
  if (value === undefined) {
    throw new Error('Configuration property "' + property + '" is not defined');
  }

  // Make configurations immutable after first get (unless disabled)
  if (checkMutability) {
    if (!util.initParam('ALLOW_CONFIG_MUTATIONS', false)) {
      util.makeImmutable(config);
    }
    checkMutability = false;
  }

  // Return the value
  return value;
};

/**
 * Test that a configuration parameter exists
 *
 * <pre>
 *    var config = require('config');
 *    if (config.has('customer.dbName')) {
 *      console.log('Customer database name: ' + config.customer.dbName);
 *    }
 * </pre>
 *
 * @method has
 * @param property {string} - The configuration property to test. Can include '.' sub-properties.
 * @return isPresent {boolean} - True if the property is defined, false if not defined.
 */
Config.prototype.has = function(property) {
  // While get() throws an exception for undefined input, has() is designed to test validity, so false is appropriate
  if(property === null || property === undefined){
    return false;
  }
  var t = this;
  return (getImpl(t, property) !== undefined);
};

/**
 * <p>Monitor a javascript property for runtime changes.</p>
 *
 * <p>
 * This method was built for an earlier version of node-config that allowed
 * configuration value mutations.  Since version 1.0.0, node-config no longer
 * allows configuration mutations, and is no longer used in node-config.
 * </p>
 *
 * <p>
 * It is deprecated, and will be removed in the next semver incompatible release 2.0.0.
 * </p>
 *
 * @method watch
 * @deprecated
 * @param object {object} - The object to watch.
 * @param property {string} - The property name to watch.  Watch all object properties if null.
 * @param handler {function(object, propertyName, priorValue, newValue)} - Handler called when a property change is detected.
 *   The handler is run along with other handlers registered for notification.
 *   If your handler changes the value of the property, that change is applied after all handlers have finished processing the current change.
 *   Then all handlers (including this one) will be called again with the newly changed value.
 * @param depth {integer} (optional) - If watching all object properties or if the specified property is an object, this specifies the depth of the object graph to watch for changes.  Default 6.
 * @return object {object} - The original object is returned - for chaining.
 */
util.watch = function(object, property, handler, depth) {

  // Initialize
  var t = this, o = object;
  var allProperties = property ? [property] : Object.keys(o);

  // Deprecation warning
  if (!deprecationWarnings.watch) {
    console.error('WARNING: config.' + fnName + '() is deprecated, and will not be supported in release 2.0.');
    console.error('WARNING: See https://github.com/lorenwest/node-config/wiki/Future-Compatibility#upcoming-incompatibilities');
    deprecationWarnings.watch = true;
  }

  // Depth detection
  depth = (depth === null ? DEFAULT_CLONE_DEPTH : depth);
  if (depth < 0) {
    return;
  }

  // Create hidden properties on the object
  if (!o.__watchers)
    util.makeHidden(o, '__watchers', {});
  if (!o.__propertyValues)
    util.makeHidden(o, '__propertyValues', {});

  // Attach watchers to all requested properties
  allProperties.forEach(function(prop){

    // Setup the property for watching (first time only)
    if (typeof(o.__propertyValues[prop]) === 'undefined') {

      // Don't error re-defining the property if immutable
      var descriptor = Object.getOwnPropertyDescriptor(o, prop);
      if (descriptor && descriptor.writable === false)
        return;

      // Copy the value to the hidden field, and add the property to watchers
      o.__propertyValues[prop] = [o[prop]];
      o.__watchers[prop] = [];

      // Attach the property watcher
      Object.defineProperty(o, prop, {
        enumerable : true,

        get : function(){
          // If more than 1 item is in the values array,
          // then we're currently processing watchers.
          if (o.__propertyValues[prop].length === 1)
            // Current value
            return o.__propertyValues[prop][0];
          else
            // [0] is prior value, [1] is new value being processed
            return o.__propertyValues[prop][1];
        },

        set : function(newValue) {

          // Return early if no change
          var origValue = o[prop];
          if (util.equalsDeep(origValue, newValue))
            return;

          // Remember the new value, and return if we're in another setter
          o.__propertyValues[prop].push(newValue);
          if (o.__propertyValues[prop].length > 2)
            return;

          // Call all watchers for each change requested
          var numIterations = 0;
          while (o.__propertyValues[prop].length > 1) {

            // Detect recursion
            if (++numIterations > 20) {
              o.__propertyValues[prop] = [origValue];
              throw new Error('Recursion detected while setting [' + prop + ']');
            }

            // Call each watcher for the current values
            var oldValue = o.__propertyValues[prop][0];
            newValue = o.__propertyValues[prop][1];
            o.__watchers[prop].forEach(function(watcher) {
              try {
                watcher(o, prop, oldValue, newValue);
              } catch (e) {
                // Log an error and continue with subsequent watchers
                console.error("Exception in object watcher for " + prop, e);
              }
            });

            // Done processing this value
            o.__propertyValues[prop].splice(0,1);
          }
        }
      });

    } // Done setting up the property for watching (first time)

    // Add the watcher to the property
    o.__watchers[prop].push(handler);

    // Recurs if this is an object...
    if (o[prop] && typeof(o[prop]) === 'object') {
      util.watch(o[prop], null, handler, depth - 1);
    }

  }); // Done processing each property

  // Return the original object - for chaining
  return o;
};

/**
 * <p>
 * Set default configurations for a node.js module.
 * </p>
 *
 * <p>
 * This allows module developers to attach their configurations onto the
 * default configuration object so they can be configured by the consumers
 * of the module.
 * </p>
 *
 * <p>Using the function within your module:</p>
 * <pre>
 *   var CONFIG = require("config");
 *   CONFIG.util.setModuleDefaults("MyModule", {
 *   &nbsp;&nbsp;templateName: "t-50",
 *   &nbsp;&nbsp;colorScheme: "green"
 *   });
 * <br>
 *   // Template name may be overridden by application config files
 *   console.log("Template: " + CONFIG.MyModule.templateName);
 * </pre>
 *
 * <p>
 * The above example results in a "MyModule" element of the configuration
 * object, containing an object with the specified default values.
 * </p>
 *
 * @method setModuleDefaults
 * @param moduleName {string} - Name of your module.
 * @param defaultProperties {object} - The default module configuration.
 * @return moduleConfig {object} - The module level configuration object.
 */
util.setModuleDefaults = function (moduleName, defaultProperties) {

  // Copy the properties into a new object
  var t = this,
    moduleConfig = util.cloneDeep(defaultProperties);

  // Set module defaults into the first sources element
  if (configSources.length === 0 || configSources[0].name !== 'Module Defaults') {
    configSources.splice(0, 0, {
      name: 'Module Defaults',
      parsed: {}
    });
  }
  configSources[0].parsed[moduleName] = {};
  util.extendDeep(configSources[0].parsed[moduleName], defaultProperties);

  // Create a top level config for this module if it doesn't exist
  t[moduleName] = t[moduleName] || {};

  // Extend local configurations into the module config
  util.extendDeep(moduleConfig, t[moduleName]);

  // Merge the extended configs without replacing the original
  util.extendDeep(t[moduleName], moduleConfig);

  // reset the mutability check for "config.get" method.
  // we are not making t[moduleName] immutable immediately,
  // since there might be more modifications before the first config.get
  if (!util.initParam('ALLOW_CONFIG_MUTATIONS', false)) {
    checkMutability = true; 
  }
  
  // Attach handlers & watchers onto the module config object
  return util.attachProtoDeep(t[moduleName]);
};

/**
 * <p>Make a configuration property hidden so it doesn't appear when enumerating
 * elements of the object.</p>
 *
 * <p>
 * The property still exists and can be read from and written to, but it won't
 * show up in for ... in loops, Object.keys(), or JSON.stringify() type methods.
 * </p>
 *
 * <p>
 * If the property already exists, it will be made hidden.  Otherwise it will
 * be created as a hidden property with the specified value.
 * </p>
 *
 * <p><i>
 * This method was built for hiding configuration values, but it can be applied
 * to <u>any</u> javascript object.
 * </i></p>
 *
 * <p>Example:</p>
 * <pre>
 *   var CONFIG = require('config');
 *   ...
 *
 *   // Hide the Amazon S3 credentials
 *   CONFIG.util.makeHidden(CONFIG.amazonS3, 'access_id');
 *   CONFIG.util.makeHidden(CONFIG.amazonS3, 'secret_key');
 * </pre>
 *
 * @method makeHidden
 * @param object {object} - The object to make a hidden property into.
 * @param property {string} - The name of the property to make hidden.
 * @param value {mixed} - (optional) Set the property value to this (otherwise leave alone)
 * @return object {object} - The original object is returned - for chaining.
 */
util.makeHidden = function(object, property, value) {

  // If the new value isn't specified, just mark the property as hidden
  if (typeof value === 'undefined') {
    Object.defineProperty(object, property, {
      enumerable : false
    });
  }
  // Otherwise set the value and mark it as hidden
  else {
    Object.defineProperty(object, property, {
      value      : value,
      enumerable : false
    });
  }

  return object;
}

/**
 * <p>Make a javascript object property immutable (assuring it cannot be changed
 * from the current value).</p>
 * <p>
 * If the specified property is an object, all attributes of that object are
 * made immutable, including properties of contained objects, recursively.
 * If a property name isn't supplied, all properties of the object are made
 * immutable.
 * </p>
 * <p>
 *
 * </p>
 * <p>
 * New properties can be added to the object and those properties will not be
 * immutable unless this method is called on those new properties.
 * </p>
 * <p>
 * This operation cannot be undone.
 * </p>
 *
 * <p>Example:</p>
 * <pre>
 *   var config = require('config');
 *   var myObject = {hello:'world'};
 *   config.util.makeImmutable(myObject);
 * </pre>
 *
 * @method makeImmutable
 * @param object {object} - The object to specify immutable properties for
 * @param [property] {string | [string]} - The name of the property (or array of names) to make immutable.
 *        If not provided, all owned properties of the object are made immutable.
 * @param [value] {mixed | [mixed]} - Property value (or array of values) to set
 *        the property to before making immutable. Only used when setting a single
 *        property. Retained for backward compatibility.
 * @return object {object} - The original object is returned - for chaining.
 */
util.makeImmutable = function(object, property, value) {
  var properties = null;

  // Backwards compatibility mode where property/value can be specified
  if (typeof property === 'string') {
    return Object.defineProperty(object, property, {
      value : (typeof value === 'undefined') ? object[property] : value,
      writable : false,
      configurable: false
    });
  }

  // Get the list of properties to work with
  if (Array.isArray(property)) {
    properties = property;
  }
  else {
    properties = Object.keys(object);
  }

  // Process each property
  for (var i = 0; i < properties.length; i++) {
    var propertyName = properties[i],
        value = object[propertyName];

    Object.defineProperty(object, propertyName, {
      value: value,
      writable : false,
      configurable: false
    });

    // Call recursively if an object.
    if (util.isObject(value)) {
      util.makeImmutable(value);
    }
  }

  return object;
};

/**
 * Return the sources for the configurations
 *
 * <p>
 * All sources for configurations are stored in an array of objects containing
 * the source name (usually the filename), the original source (as a string),
 * and the parsed source as an object.
 * </p>
 *
 * @method getConfigSources
 * @return configSources {Array[Object]} - An array of objects containing
 *    name, original, and parsed elements
 */
util.getConfigSources = function() {
  var t = this;
  return configSources.slice(0);
};

/**
 * Load the individual file configurations.
 *
 * <p>
 * This method builds a map of filename to the configuration object defined
 * by the file.  The search order is:
 * </p>
 *
 * <pre>
 *   default.EXT
 *   (deployment).EXT
 *   (hostname).EXT
 *   (hostname)-(deployment).EXT
 *   local.EXT
 *   local-(deployment).EXT
 *   runtime.json
 * </pre>
 *
 * <p>
 * EXT can be yml, yaml, coffee, iced, json, cson or js signifying the file type.
 * yaml (and yml) is in YAML format, coffee is a coffee-script, iced is iced-coffee-script,
 * json is in JSON format, cson is in CSON format, properties is in .properties format
 * (http://en.wikipedia.org/wiki/.properties), and js is a javascript executable file that is
 * require()'d with module.exports being the config object.
 * </p>
 *
 * <p>
 * hostname is the $HOST environment variable (or --HOST command line parameter)
 * if set, otherwise the $HOSTNAME environment variable (or --HOSTNAME command
 * line parameter) if set, otherwise the hostname found from
 * require('os').hostname().
 * </p>
 *
 * <p>
 * Once a hostname is found, everything from the first period ('.') onwards
 * is removed. For example, abc.example.com becomes abc
 * </p>
 *
 * <p>
 * (deployment) is the deployment type, found in the $NODE_ENV environment
 * variable or --NODE_ENV command line parameter.  Defaults to 'development'.
 * </p>
 *
 * <p>
 * The runtime.json file contains configuration changes made at runtime either
 * manually, or by the application setting a configuration value.
 * </p>
 *
 * <p>
 * If the $NODE_APP_INSTANCE environment variable (or --NODE_APP_INSTANCE
 * command line parameter) is set, then files with this appendage will be loaded.
 * See the Multiple Application Instances section of the main documentaion page
 * for more information.
 * </p>
 *
 * @protected
 * @method loadFileConfigs
 * @return config {Object} The configuration object
 */
util.loadFileConfigs = function() {

  // Initialize
  var t = this,
      config = {};

  // Initialize parameters from command line, environment, or default
  NODE_ENV = util.initParam('NODE_ENV', 'development');
  CONFIG_DIR = util.initParam('NODE_CONFIG_DIR', Path.join( process.cwd(), 'config') );
  if (CONFIG_DIR.indexOf('.') === 0) {
    CONFIG_DIR = Path.join(process.cwd() , CONFIG_DIR);
  }
  APP_INSTANCE = util.initParam('NODE_APP_INSTANCE');
  HOST = util.initParam('HOST');
  HOSTNAME = util.initParam('HOSTNAME');

  // This is for backward compatibility
  RUNTIME_JSON_FILENAME = util.initParam('NODE_CONFIG_RUNTIME_JSON', Path.join(CONFIG_DIR , 'runtime.json') );

  // Determine the host name from the OS module, $HOST, or $HOSTNAME
  // Remove any . appendages, and default to null if not set
  try {
    var hostName = HOST || HOSTNAME;

    // Store the hostname that won.
    env.HOSTNAME = hostName;

    if (!hostName) {
        var OS = require('os');
        hostName = OS.hostname();
    }
  } catch (e) {
    hostName = '';
  }

  // Read each file in turn
  var baseNames = ['default', NODE_ENV];

  // #236: Also add full hostname when they are different.
  if ( hostName ) {
    var firstDomain = hostName.split('.')[0];

    // Backward compatibility
    baseNames.push(firstDomain, firstDomain + '-' + NODE_ENV);

    // Add full hostname when it is not the same
    if ( hostName != firstDomain ) {
      baseNames.push(hostName, hostName + '-' + NODE_ENV);
    }
  }

  baseNames.push('local', 'local-' + NODE_ENV);

  var extNames = ['js', 'json', 'json5', 'hjson', 'toml', 'coffee', 'iced', 'yaml', 'yml', 'cson', 'properties'];
  baseNames.forEach(function(baseName) {
    extNames.forEach(function(extName) {

      // Try merging the config object into this object
      var fullFilename = Path.join(CONFIG_DIR , baseName + '.' + extName);
      var configObj = util.parseFile(fullFilename);
      if (configObj) {
        util.extendDeep(config, configObj);
      }

      // See if the application instance file is available
      if (APP_INSTANCE) {
        fullFilename = Path.join(CONFIG_DIR, baseName + '-' + APP_INSTANCE + '.' + extName);
        configObj = util.parseFile(fullFilename);
        if (configObj) {
          util.extendDeep(config, configObj);
        }
      }
    });
  });

  // Override configurations from the $NODE_CONFIG environment variable
  var envConfig = {};
  if (process.env.NODE_CONFIG) {
    try {
      envConfig = JSON.parse(process.env.NODE_CONFIG);
    } catch(e) {
      console.error('The $NODE_CONFIG environment variable is malformed JSON');
    }
    util.extendDeep(config, envConfig);
    configSources.push({
      name: "$NODE_CONFIG",
      parsed: envConfig,
    });
  }

  // Override configurations from the --NODE_CONFIG command line
  var cmdLineConfig = util.getCmdLineArg('NODE_CONFIG');
  if (cmdLineConfig) {
    try {
      cmdLineConfig = JSON.parse(cmdLineConfig);
    } catch(e) {
      console.error('The --NODE_CONFIG={json} command line argument is malformed JSON');
    }
    util.extendDeep(config, cmdLineConfig);
    configSources.push({
      name: "--NODE_CONFIG argument",
      parsed: cmdLineConfig,
    });
  }

  // Override with environment variables if there is a custom-environment-variables.EXT mapping file
  var customEnvVars = util.getCustomEnvVars(CONFIG_DIR, extNames);
  util.extendDeep(config, customEnvVars);

  // Place the mixed NODE_CONFIG into the environment
  env['NODE_CONFIG'] = JSON.stringify(util.extendDeep(envConfig, cmdLineConfig, {}));

  // Extend the original config with the contents of runtime.json (backwards compatibility)
  var runtimeJson = util.parseFile(RUNTIME_JSON_FILENAME) || {};
  util.extendDeep(config, runtimeJson);

  util.resolveDeferredConfigs(config);

  // Return the configuration object
  return config;
};

function isDeferredConfig(value) {
  return value instanceof DeferredConfig || (typeof value == 'object' && typeof value.resolve == 'function');
}

// Using basic recursion pattern, find all the deferred values and resolve them.
util.resolveDeferredConfigs = function (config) {
    var completeConfig = config;

    function _iterate (prop) {
      for (var property in prop) {
          if (prop.hasOwnProperty(property) && prop[property] != null) {
              if (prop[property].constructor == Object) {
                  _iterate(prop[property]);
              } else if (prop[property].constructor == Array) {
                  for (var i = 0; i < prop[property].length; i++) {
                      _iterate(prop[property][i]);
                  }
              } else {
                  if (isDeferredConfig(prop[property])) {
                    prop[property]= prop[property].resolve.call(completeConfig,completeConfig);
                  }
                  else {
                    // Nothing to do. Keep the property how it is.
                  }
              }
          }
      }
    }

    _iterate(config);
}

/**
 * Parse and return the specified configuration file.
 *
 * If the file exists in the application config directory, it will
 * parse and return it as a JavaScript object.
 *
 * The file extension determines the parser to use.
 *
 * .js = File to run that has a module.exports containing the config object
 * .coffee = File to run that has a module.exports with coffee-script containing the config object
 * .iced = File to run that has a module.exports with iced-coffee-script containing the config object
 * All other supported file types (yaml, toml, json, cson, hjson, json5, properties)
 * are parsed with util.parseString.
 *
 * If the file doesn't exist, a null will be returned.  If the file can't be
 * parsed, an exception will be thrown.
 *
 * This method performs synchronous file operations, and should not be called
 * after synchronous module loading.
 *
 * @protected
 * @method parseFile
 * @param fullFilename {string} The full file path and name
 * @return {configObject} The configuration object parsed from the file
 */
util.parseFile = function(fullFilename) {

  // Initialize
  var t = this,
      extension = fullFilename.substr(fullFilename.lastIndexOf('.') + 1),
      configObject = null,
      fileContent = null;

  // Return null if the file doesn't exist.
  // Note that all methods here are the Sync versions.  This is appropriate during
  // module loading (which is a synchronous operation), but not thereafter.
  try {
    var stat = FileSystem.statSync(fullFilename);
    if (!stat || stat.size < 1) {
      return null;
    }
  } catch (e1) {
    return null
  }

  // Try loading the file.
  try {
    fileContent = FileSystem.readFileSync(fullFilename, 'UTF-8');
    fileContent = fileContent.replace(/^\uFEFF/, '');
  }
  catch (e2) {
    throw new Error('Config file ' + fullFilename + ' cannot be read');
  }

  // Parse the file based on extension
  try {
    if (extension === 'js') {
      // Use the built-in parser for .js files
      configObject = require(fullFilename);
    }
    else if (extension === 'coffee') {
      // .coffee files can be loaded with either coffee-script or iced-coffee-script.
      // Prefer iced-coffee-script, if it exists.
      // Lazy load the appropriate extension
      if (!Coffee) {
        Coffee = {};

        // The following enables iced-coffee-script on .coffee files, if iced-coffee-script is available.
        // This is commented as per a decision on a pull request.
        //try {
        //  Coffee = require("iced-coffee-script");
        //}
        //catch (e) {
        //  Coffee = require("coffee-script");
        //}

        Coffee = require("coffee-script");

        // coffee-script >= 1.7.0 requires explicit registration for require() to work
        if (Coffee.register) {
          Coffee.register();
        }
      }
      // Use the built-in parser for .coffee files with coffee-script
      configObject = require(fullFilename);
    }
    else if (extension === 'iced') {
      Iced = require("iced-coffee-script");

      // coffee-script >= 1.7.0 requires explicit registration for require() to work
      if (Iced.register) {
        Iced.register();
      }
    }
    else {
      configObject = util.parseString(fileContent, extension);
    }
  }
  catch (e3) {
    throw new Error("Cannot parse config file: '" + fullFilename + "': " + e3);
  }

  // Keep track of this configuration sources, including empty ones
  if (typeof configObject === 'object') {
    configSources.push({
      name: fullFilename,
      original: fileContent,
      parsed: configObject,
    });
  }

  return configObject;
};

/**
 * Parse and return the specied string with the specified format.
 *
 * The format determines the parser to use.
 *
 * json = File is parsed using JSON.parse()
 * yaml (or yml) = Parsed with a YAML parser
 * toml = Parsed with a TOML parser
 * cson = Parsed with a CSON parser
 * hjson = Parsed with a HJSON parser
 * json5 = Parsed with a JSON5 parser
 * properties = Parsed with the 'properties' node package
 *
 * If the file doesn't exist, a null will be returned.  If the file can't be
 * parsed, an exception will be thrown.
 *
 * This method performs synchronous file operations, and should not be called
 * after synchronous module loading.
 *
 * @protected
 * @method parseString
 * @param content {string} The full content
 * @param format {string} The format to be parsed
 * @return {configObject} The configuration object parsed from the string
 */
util.parseString = function (content, format) {
  // Initialize
  var configObject = null;

  // Parse the file based on extension
  if (format === 'yaml' || format === 'yml') {
    if (!Yaml && !VisionmediaYaml) {
      // Lazy loading
      try {
        // Try to load the better js-yaml module
        Yaml = require('js-yaml');
      }
      catch (e) {
        try {
          // If it doesn't exist, load the fallback visionmedia yaml module.
          VisionmediaYaml = require('yaml');
        }
        catch (e) { }
      }
    }

    if (Yaml) {
      configObject = Yaml.load(content);
    }
    else if (VisionmediaYaml) {
      // The yaml library doesn't like strings that have newlines but don't
      // end in a newline: https://github.com/visionmedia/js-yaml/issues/issue/13
      content += '\n';
      configObject = VisionmediaYaml.eval(util.stripYamlComments(content));
    }
    else {
      console.error("No YAML parser loaded.  Suggest adding js-yaml dependency to your package.json file.")
    }
  }
  else if (format === 'json') {
    // Allow comments in JSON files
    configObject = JSON.parse(util.stripComments(content));
  }
  else if (format === 'json5') {

    if (!JSON5) {
      JSON5 = require('json5');
    }

    configObject = JSON5.parse(content);

  } else if (format === 'hjson') {

    if (!HJSON) {
      HJSON = require('hjson');
    }

    configObject = HJSON.parse(content);

  } else if (format === 'toml') {

    if(!TOML) {
      TOML = require('toml');
    }

    configObject = TOML.parse(content);
  }
  else if (format === 'cson') {
    if (!CSON) {
      CSON = require('cson');
    }
    // Allow comments in CSON files
    if (typeof CSON.parseSync === 'function') {
      configObject = CSON.parseSync(util.stripComments(content));
    } else {
      configObject = CSON.parse(util.stripComments(content));
    }
  }
  else if (format === 'properties') {
    if (!PPARSER) {
      PPARSER = require('properties');
    }
    configObject = PPARSER.parse(content, { namespaces: true, variables: true, sections: true });
  }

  return configObject;
};

/**
 * Attach the Config class prototype to all config objects recursively.
 *
 * <p>
 * This allows you to do anything with CONFIG sub-objects as you can do with
 * the top-level CONFIG object.  It's so you can do this:
 * </p>
 *
 * <pre>
 *   var CUST_CONFIG = require('config').Customer;
 *   CUST_CONFIG.get(...)
 * </pre>
 *
 * @protected
 * @method attachProtoDeep
 * @param toObject
 * @param depth
 * @return toObject
 */
util.attachProtoDeep = function(toObject, depth) {

  // Recursion detection
  var t = this;
  depth = (depth === null ? DEFAULT_CLONE_DEPTH : depth);
  if (depth < 0) {
    return toObject;
  }

  // Adding Config.prototype methods directly to toObject as hidden properties
  // because adding to toObject.__proto__ exposes the function in toObject
  for (var fnName in Config.prototype) {
    if (!toObject[fnName]) {
      util.makeHidden(toObject, fnName, Config.prototype[fnName]);
    }
  }

  // Add prototypes to sub-objects
  for (var prop in toObject) {
    if (util.isObject(toObject[prop])) {
      util.attachProtoDeep(toObject[prop], depth - 1);
    }
  }

  // Return the original object
  return toObject;
};

/**
 * Return a deep copy of the specified object.
 *
 * This returns a new object with all elements copied from the specified
 * object.  Deep copies are made of objects and arrays so you can do anything
 * with the returned object without affecting the input object.
 *
 * @protected
 * @method cloneDeep
 * @param parent {object} The original object to copy from
 * @param [depth=20] {Integer} Maximum depth (default 20)
 * @return {object} A new object with the elements copied from the copyFrom object
 *
 * This method is copied from https://github.com/pvorb/node-clone/blob/17eea36140d61d97a9954c53417d0e04a00525d9/clone.js
 *
 * Copyright © 2011-2014 Paul Vorbach and contributors.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the “Software”), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions: The above copyright notice and this permission
 * notice shall be included in all copies or substantial portions of the Software.
 */
util.cloneDeep = function cloneDeep(parent, depth, circular, prototype) {
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular === 'undefined')
    circular = true;

  if (typeof depth === 'undefined')
    depth = 20;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth === 0)
      return parent;

    var child;
    if (typeof parent != 'object') {
      return parent;
    }

    if (Utils.isArray(parent)) {
      child = [];
    } else if (Utils.isRegExp(parent)) {
      child = new RegExp(parent.source, util.getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (Utils.isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype === 'undefined') child = Object.create(Object.getPrototypeOf(parent));
      else child = Object.create(prototype);
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var propDescriptor  = Object.getOwnPropertyDescriptor(parent,i);
      var hasGetter = ((propDescriptor !== undefined) && (propDescriptor.get !== undefined));

      if (hasGetter){
        Object.defineProperty(child,i,propDescriptor);
      } else {
        child[i] = _clone(parent[i], depth - 1);
      }
    }

    return child;
  }

  return _clone(parent, depth);
};

/**
 * Set objects given a path as a string list
 *
 * @protected
 * @method setPath
 * @param object {object} - Object to set the property on
 * @param path {array[string]} - Array path to the property
 * @param value {mixed} - value to set, ignoring null
 */
util.setPath = function (object, path, value) {
  var nextKey = null;
  if (value === null || path.length === 0) {
    return;
  }
  else if (path.length === 1) { // no more keys to make, so set the value
    object[path.shift()] = value;
  }
  else {
    nextKey = path.shift();
    if (!object.hasOwnProperty(nextKey)) {
      object[nextKey] = {};
    }
    util.setPath(object[nextKey], path, value);
  }
};

/**
 * Create a new object patterned after substitutionMap, where:
 * 1. Terminal string values in substitutionMap are used as keys
 * 2. To look up values in a key-value store, variables
 * 3. And parent keys are created as necessary to retain the structure of substitutionMap.
 *
 * @protected
 * @method substituteDeep
 * @param substitionMap {object} - an object whose terminal (non-subobject) values are strings
 * @param variables {object[string:value]} - usually process.env, a flat object used to transform
 *      terminal values in a copy of substititionMap.
 * @returns {object} - deep copy of substitutionMap with only those paths whose terminal values
 *      corresponded to a key in `variables`
 */
util.substituteDeep = function (substitutionMap, variables) {
  var result = {};

  function _substituteVars(map, vars, pathTo) {
    for (var prop in map) {
      var value = map[prop];
      if (typeof(value) === 'string') { // We found a leaf variable name
        if (vars[value]) { // if the vars provide a value set the value in the result map
          util.setPath(result, pathTo.concat(prop), vars[value]);
        }
      }
      else if (util.isObject(value)) { // work on the subtree, giving it a clone of the pathTo
        if('__name' in value && '__format' in value && vars[value.__name]) {
          var parsedValue = util.parseString(vars[value.__name], value.__format);
          util.setPath(result, pathTo.concat(prop), parsedValue);
        } else {
          _substituteVars(value, vars, pathTo.concat(prop));
        }
      }
      else {
        msg = "Illegal key type for substitution map at " + pathTo.join('.') + ': ' + typeof(value);
        throw Error(msg);
      }
    }
  }

  _substituteVars(substitutionMap, variables, []);
  return result;

};

/* Map environment variables into the configuration if a mapping file,
 * `custom-environment-variables.EXT` exists.
 *
 * @protected
 * @method getCustomEnvVars
 * @param CONFIG_DIR {string} - the passsed configuration directory
 * @param extNames {Array[string]} - acceptable configuration file extension names.
 * @returns {object} - mapped environment variables or {} if there are none
 */
util.getCustomEnvVars = function (CONFIG_DIR, extNames) {
  var result = {};
  extNames.forEach(function (extName) {
    var fullFilename = Path.join(CONFIG_DIR , 'custom-environment-variables' + '.' + extName);
    var configObj = util.parseFile(fullFilename);
    if (configObj) {
      var environmentSubstitutions = util.substituteDeep(configObj, process.env);
      util.extendDeep(result, environmentSubstitutions);
    }
  });
  return result;
};

/**
 * Return true if two objects have equal contents.
 *
 * @protected
 * @method equalsDeep
 * @param object1 {object} The object to compare from
 * @param object2 {object} The object to compare with
 * @param depth {integer} An optional depth to prevent recursion.  Default: 20.
 * @return {boolean} True if both objects have equivalent contents
 */
util.equalsDeep = function(object1, object2, depth) {

  // Recursion detection
  var t = this;
  depth = (depth === null ? DEFAULT_CLONE_DEPTH : depth);
  if (depth < 0) {
    return {};
  }

  // Fast comparisons
  if (!object1 || !object2) {
    return false;
  }
  if (object1 === object2) {
    return true;
  }
  if (typeof(object1) != 'object' || typeof(object2) != 'object') {
    return false;
  }

  // They must have the same keys.  If their length isn't the same
  // then they're not equal.  If the keys aren't the same, the value
  // comparisons will fail.
  if (Object.keys(object1).length != Object.keys(object2).length) {
    return false;
  }

  // Compare the values
  for (var prop in object1) {

    // Call recursively if an object or array
    if (object1[prop] && typeof(object1[prop]) === 'object') {
      if (!util.equalsDeep(object1[prop], object2[prop], depth - 1)) {
        return false;
      }
    }
    else {
      if (object1[prop] !== object2[prop]) {
        return false;
      }
    }
  }

  // Test passed.
  return true;
};

/**
 * Returns an object containing all elements that differ between two objects.
 * <p>
 * This method was designed to be used to create the runtime.json file
 * contents, but can be used to get the diffs between any two Javascript objects.
 * </p>
 * <p>
 * It works best when object2 originated by deep copying object1, then
 * changes were made to object2, and you want an object that would give you
 * the changes made to object1 which resulted in object2.
 * </p>
 *
 * @protected
 * @method diffDeep
 * @param object1 {object} The base object to compare to
 * @param object2 {object} The object to compare with
 * @param depth {integer} An optional depth to prevent recursion.  Default: 20.
 * @return {object} A differential object, which if extended onto object1 would
 *                  result in object2.
 */
util.diffDeep = function(object1, object2, depth) {

  // Recursion detection
  var t = this, diff = {};
  depth = (depth === null ? DEFAULT_CLONE_DEPTH : depth);
  if (depth < 0) {
    return {};
  }

  // Process each element from object2, adding any element that's different
  // from object 1.
  for (var parm in object2) {
    var value1 = object1[parm];
    var value2 = object2[parm];
    if (value1 && value2 && util.isObject(value2)) {
      if (!(util.equalsDeep(value1, value2))) {
        diff[parm] = util.diffDeep(value1, value2, depth - 1);
      }
    }
    else if (Array.isArray(value1) && Array.isArray(value2)) {
      if(!util.equalsDeep(value1, value2)) {
        diff[parm] = value2;
      }
    }
    else if (value1 !== value2){
      diff[parm] = value2;
    }
  }

  // Return the diff object
  return diff;

};

/**
 * Extend an object, and any object it contains.
 *
 * This does not replace deep objects, but dives into them
 * replacing individual elements instead.
 *
 * @protected
 * @method extendDeep
 * @param mergeInto {object} The object to merge into
 * @param mergeFrom... {object...} - Any number of objects to merge from
 * @param depth {integer} An optional depth to prevent recursion.  Default: 20.
 * @return {object} The altered mergeInto object is returned
 */
util.extendDeep = function(mergeInto) {

  // Initialize
  var t = this;
  var vargs = Array.prototype.slice.call(arguments, 1);
  var depth = vargs.pop();
  if (typeof(depth) != 'number') {
    vargs.push(depth);
    depth = DEFAULT_CLONE_DEPTH;
  }

  // Recursion detection
  if (depth < 0) {
    return mergeInto;
  }

  // Cycle through each object to extend
  vargs.forEach(function(mergeFrom) {

    // Cycle through each element of the object to merge from
    for (var prop in mergeFrom) {

      // Extend recursively if both elements are objects and target is not really a deferred function
      var isDeferredFunc = mergeInto[prop] instanceof DeferredConfig;
      if (mergeFrom[prop] instanceof Date) {
        mergeInto[prop] = mergeFrom[prop];
      } else if (util.isObject(mergeInto[prop]) && util.isObject(mergeFrom[prop]) && !isDeferredFunc) {
        util.extendDeep(mergeInto[prop], mergeFrom[prop], depth - 1);
      }

      // Copy recursively if the mergeFrom element is an object (or array or fn)
      else if (mergeFrom[prop] && typeof mergeFrom[prop] === 'object') {
        mergeInto[prop] = util.cloneDeep(mergeFrom[prop], depth -1);
      }

      // Copy getter if the property on original object is an accessor
      else if (mergeFrom.__lookupGetter__(prop)) {
        mergeInto.__defineGetter__(prop, mergeFrom.__lookupGetter__(prop));
      }

      // Simple assignment otherwise
      else {
        mergeInto[prop] = mergeFrom[prop];
      }
    }
  });

  // Chain
  return mergeInto;

};

/**
 * Strip YAML comments from the string
 *
 * The 2.0 yaml parser doesn't allow comment-only or blank lines.  Strip them.
 *
 * @protected
 * @method stripYamlComments
 * @param fileString {string} The string to strip comments from
 * @return {string} The string with comments stripped.
 */
util.stripYamlComments = function(fileStr) {
  // First replace removes comment-only lines
  // Second replace removes blank lines
  return fileStr.replace(/^\s*#.*/mg,'').replace(/^\s*[\n|\r]+/mg,'');
}

/**
 * Strip all Javascript type comments from the string.
 *
 * The string is usually a file loaded from the O/S, containing
 * newlines and javascript type comments.
 *
 * Thanks to James Padolsey, and all who contributed to this implementation.
 * http://james.padolsey.com/javascript/javascript-comment-removal-revisted/
 *
 * @protected
 * @method stripComments
 * @param fileString {string} The string to strip comments from
 * @return {string} The string with comments stripped.
 */
util.stripComments = function(fileStr) {

  var uid = '_' + +new Date(),
      primitives = [],
      primIndex = 0;

  return (
    fileStr

    /* Remove strings */
    .replace(/(['"])(\\\1|.)+?\1/g, function(match){
      primitives[primIndex] = match;
      return (uid + '') + primIndex++;
    })

    /* Remove Regexes */
    .replace(/([^\/])(\/(?!\*|\/)(\\\/|.)+?\/[gim]{0,3})/g, function(match, $1, $2){
      primitives[primIndex] = $2;
      return $1 + (uid + '') + primIndex++;
    })

    /*
    - Remove single-line comments that contain would-be multi-line delimiters
        E.g. // Comment /* <--
    - Remove multi-line comments that contain would be single-line delimiters
        E.g. /* // <--
   */
    .replace(/\/\/.*?\/?\*.+?(?=\n|\r|$)|\/\*[\s\S]*?\/\/[\s\S]*?\*\//g, '')

    /*
    Remove single and multi-line comments,
    no consideration of inner-contents
   */
    .replace(/\/\/.+?(?=\n|\r|$)|\/\*[\s\S]+?\*\//g, '')

    /*
    Remove multi-line comments that have a replaced ending (string/regex)
    Greedy, so no inner strings/regexes will stop it.
   */
    .replace(RegExp('\\/\\*[\\s\\S]+' + uid + '\\d+', 'g'), '')

    /* Bring back strings & regexes */
    .replace(RegExp(uid + '(\\d+)', 'g'), function(match, n){
      return primitives[n];
    })
  );

};

/**
 * Is the specified argument a regular javascript object?
 *
 * The argument is an object if it's a JS object, but not an array.
 *
 * @protected
 * @method isObject
 * @param arg {MIXED} An argument of any type.
 * @return {boolean} TRUE if the arg is an object, FALSE if not
 */
util.isObject = function(obj) {
  return (obj !== null) && (typeof obj === 'object') && !(Array.isArray(obj));
};

/**
 * <p>Initialize a parameter from the command line or process environment</p>
 *
 * <p>
 * This method looks for the parameter from the command line in the format
 * --PARAMETER=VALUE, then from the process environment, then from the
 * default specified as an argument.
 * </p>
 *
 * @method initParam
 * @param paramName {String} Name of the parameter
 * @param [defaultValue] {Any} Default value of the parameter
 * @return {Any} The found value, or default value
 */
util.initParam = function (paramName, defaultValue) {
  var t = this;

  // Record and return the value
  var value = util.getCmdLineArg(paramName) || process.env[paramName] || defaultValue;
  env[paramName] = value;
  return value;
}

/**
 * <p>Get Command Line Arguments</p>
 *
 * <p>
 * This method allows you to retrieve the value of the specified command line argument.
 * </p>
 *
 * <p>
 * The argument is case sensitive, and must be of the form '--ARG_NAME=value'
 * </p>
 *
 * @method getCmdLineArg
 * @param searchFor {STRING} The argument name to search for
 * @return {MIXED} FALSE if the argument was not found, the argument value if found
 */
util.getCmdLineArg = function (searchFor) {
    var cmdLineArgs = process.argv.slice(2, process.argv.length),
        argName = '--' + searchFor + '=';

    for (var argvIt = 0; argvIt < cmdLineArgs.length; argvIt++) {
      if (cmdLineArgs[argvIt].indexOf(argName) === 0) {
        return cmdLineArgs[argvIt].substr(argName.length);
      }
    }

    return false;
}

/**
 * <p>Get a Config Environment Variable Value</p>
 *
 * <p>
 * This method returns the value of the specified config environment variable,
 * including any defaults or overrides.
 * </p>
 *
 * @method getEnv
 * @param varName {STRING} The environment variable name
 * @return value {String} The value of the environment variable
 */
util.getEnv = function (varName) {
  return env[varName];
}



/**
 * Returns a string of flags for regular expression `re`.
 *
 * @param {RegExp} re Regular expression
 * @returns {string} Flags
 */
util.getRegExpFlags = function (re) {
  var flags = '';
  re.global && (flags += 'g');
  re.ignoreCase && (flags += 'i');
  re.multiline && (flags += 'm');
  return flags;
};

// Run strictness checks on NODE_ENV and NODE_APP_INSTANCE and throw an error if there's a problem.
util.runStrictnessChecks = function (config) {
  var sources = config.util.getConfigSources();

  var sourceFilenames = sources.map(function (src) {
    return Path.basename(src.name);
  });


  // Throw an exception if there's no explicit config file for NODE_ENV
  var anyFilesMatchEnv = sourceFilenames.some(function (filename) {
      return filename.match(NODE_ENV);
  });
  // devleopment is special-cased because it's the default value
  if (NODE_ENV && (NODE_ENV !== 'development') && !anyFilesMatchEnv) {
    _warnOrThrow("NODE_ENV value of '"+NODE_ENV+"' did not match any deployment config file names.");
  }

  // Throw an exception if there's no explict config file for NODE_APP_INSTANCE
  var anyFilesMatchInstance = sourceFilenames.some(function (filename) {
      return filename.match(APP_INSTANCE);
  });
  if (APP_INSTANCE && !anyFilesMatchInstance) {
    _warnOrThrow("NODE_APP_INSTANCE value of '"+APP_INSTANCE+"' did not match any instance config file names.");
  }

  // Throw if NODE_ENV matches' default' or 'local'
  if ((NODE_ENV === 'default') || (NODE_ENV === 'local')) {
    _warnOrThrow("NODE_ENV value of '"+NODE_ENV+"' is ambiguous.");
  }

  function _warnOrThrow (msg) {
    var beStrict = process.env.NODE_CONFIG_STRICT_MODE;
    var prefix = beStrict ? 'FATAL: ' : 'WARNING: ';
    var seeURL = 'See https://github.com/lorenwest/node-config/wiki/Strict-Mode';

    console.error(prefix+msg);
    console.error(prefix+seeURL);

    if (beStrict) {
      throw new Error(prefix+msg+' '+seeURL);
    }
  }
}

// Process pre-1.0 utility names
var utilWarnings = {};
['watch', 'setModuleDefaults', 'makeHidden', 'makeImmutable', 'getConfigSources', '_loadFileConfigs',
 '_parseFile', '_attachProtoDeep', '_cloneDeep', '_equalsDeep', '_diffDeep', '_extendDeep', '_stripYamlComments',
 '_stripComments', '_isObject', '_initParam', '_getCmdLineArg'].forEach(function(oldName) {

  // Config.util names don't have underscores
  var newName = oldName;
  if (oldName.indexOf('_') === 0) {
    newName = oldName.substr(1);
  }

  // Build the wrapper with warning
  Config.prototype[oldName] = function(){

    // Produce the warning
    if (!utilWarnings[oldName]) {
      console.error('WARNING: config.' + oldName + '() is deprecated.  Use config.util.' + newName + '() instead.');
      console.error('WARNING: See https://github.com/lorenwest/node-config/wiki/Future-Compatibility#upcoming-incompatibilities');
      utilWarnings[oldName] = true;
    }

    // Forward the call
    return util[newName].apply(this, arguments);
  }
});



// Instantiate and export the configuration
var config = module.exports = new Config();

// Produce warnings if the configuration is empty
var showWarnings = !(util.initParam('SUPPRESS_NO_CONFIG_WARNING'));
if (showWarnings && Object.keys(config).length === 0) {
  console.error('WARNING: No configurations found in configuration directory:' +CONFIG_DIR);
  console.error('WARNING: To disable this warning set SUPRESS_NO_CONFIG_WARNING in the environment.');
}
