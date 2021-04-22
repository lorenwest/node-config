// config.js (c) 2010-2020 Loren West and other contributors
// May be freely distributed under the MIT license.
// For further details and documentation:
// http://lorenwest.github.com/node-config

// Dependencies
var deferConfig = require('../defer').deferConfig,
    DeferredConfig = require('../defer').DeferredConfig,
    RawConfig = require('../raw').RawConfig,
    Parser = require('../parser'),
    Utils = require('util'),
    Path = require('path'),
    FileSystem = require('fs');

// Static members
var DEFAULT_CLONE_DEPTH = 20,
    NODE_CONFIG, CONFIG_DIR, RUNTIME_JSON_FILENAME, NODE_ENV, APP_INSTANCE,
    HOST, HOSTNAME, ALLOW_CONFIG_MUTATIONS, CONFIG_SKIP_GITCRYPT, NODE_ENV_VAR_NAME,
    NODE_CONFIG_PARSER,
    env = {},
    privateUtil = {},
    deprecationWarnings = {},
    configSources = [],          // Configuration sources - array of {name, original, parsed}
    checkMutability = true,      // Check for mutability/immutability on first get
    gitCryptTestRegex = /^.GITCRYPT/; // regular expression to test for gitcrypt files.

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
    if (typeof util[fnName] === 'function') {
      util[fnName] = util[fnName].bind(t);
    }
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
 * @param property {string|string[]} - The property name to get (as an array or '.' delimited string)
 * @return value {*} - Property value, including undefined if not defined.
 */
var getImpl= function(object, property) {
  var t = this,
      elems = Array.isArray(property) ? property : property.split('.'),
      name = elems[0],
      value = object[name];
  if (elems.length <= 1) {
    return value;
  }
  // Note that typeof null === 'object'
  if (value === null || typeof value !== 'object') {
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
 * @return value {*} - The property value
 */
Config.prototype.get = function(property) {
  if(property === null || property === undefined){
    throw new Error("Calling config.get with null or undefined argument");
  }

  // Make configurations immutable after first get (unless disabled)
  if (checkMutability) {
    if (!util.initParam('ALLOW_CONFIG_MUTATIONS', false)) {
      util.makeImmutable(config);
    }
    checkMutability = false;
  }
  var t = this,
      value = getImpl(t, property);

  // Produce an exception if the property doesn't exist
  if (value === undefined) {
    throw new Error('Configuration property "' + property + '" is not defined');
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
  util.setPath(configSources[0].parsed, moduleName.split('.'), {});
  util.extendDeep(getImpl(configSources[0].parsed, moduleName), defaultProperties);

  // Create a top level config for this module if it doesn't exist
  util.setPath(t, moduleName.split('.'), getImpl(t, moduleName) || {});

  // Extend local configurations into the module config
  util.extendDeep(moduleConfig, getImpl(t, moduleName));

  // Merge the extended configs without replacing the original
  util.extendDeep(getImpl(t, moduleName), moduleConfig);

  // reset the mutability check for "config.get" method.
  // we are not making t[moduleName] immutable immediately,
  // since there might be more modifications before the first config.get
  if (!util.initParam('ALLOW_CONFIG_MUTATIONS', false)) {
    checkMutability = true;
  }

  // Attach handlers & watchers onto the module config object
  return util.attachProtoDeep(getImpl(t, moduleName));
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
 * @param value {*} - (optional) Set the property value to this (otherwise leave alone)
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
 * @param [value] {* | [*]} - Property value (or array of values) to set
 *        the property to before making immutable. Only used when setting a single
 *        property. Retained for backward compatibility.
 * @return object {object} - The original object is returned - for chaining.
 */
util.makeImmutable = function(object, property, value) {
  if (Buffer.isBuffer(object)) {
    return object;
  }
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

    if (value instanceof RawConfig) {
      Object.defineProperty(object, propertyName, {
        value: value.resolve(),
        writable: false,
        configurable: false
      });
    } else if (Array.isArray(value)) {
      // Ensure object items of this array are also immutable.
      value.forEach((item, index) => { if (util.isObject(item) || Array.isArray(item)) util.makeImmutable(item) })

      Object.defineProperty(object, propertyName, {
        value: Object.freeze(value)
      });
    } else {
      Object.defineProperty(object, propertyName, {
        value: value,
        writable : false,
        configurable: false
      });

      // Ensure new properties can not be added.
      Object.preventExtensions(object)

      // Call recursively if an object.
      if (util.isObject(value)) {
        util.makeImmutable(value);
      }
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
 * Looks into an options object for a specific attribute
 *
 * <p>
 * This method looks into the options object, and if an attribute is defined, returns it,
 * and if not, returns the default value
 * </p>
 *
 * @method getOption
 * @param options {Object | undefined} the options object
 * @param optionName {string} the attribute name to look for
 * @param defaultValue { any } the default in case the options object is empty, or the attribute does not exist.
 * @return options[optionName] if defined, defaultValue if not.
 */
util.getOption = function(options, optionName, defaultValue) {
  if (options !== undefined && options[optionName] !== undefined){
    return options[optionName];
  } else {
    return defaultValue;
  }
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
 * variable (which can be overridden by using $NODE_CONFIG_ENV
 * environment variable). Defaults to 'development'.
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
 * See the Multiple Application Instances section of the main documentation page
 * for more information.
 * </p>
 *
 * @protected
 * @method loadFileConfigs
 * @param configDir { string | null } the path to the directory containing the configurations to load
 * @param options { object | undefined } parsing options. Current supported option: skipConfigSources: true|false
 * @return config {Object} The configuration object
 */
util.loadFileConfigs = function(configDir, options) {

  // Initialize
  var t = this,
      config = {};

  // Specify variables that can be used to define the environment
  var node_env_var_names = ['NODE_CONFIG_ENV', 'NODE_ENV'];

  // Loop through the variables to try and set environment
  for (const node_env_var_name of node_env_var_names) {
    NODE_ENV = util.initParam(node_env_var_name);
    if (!!NODE_ENV) {
      NODE_ENV_VAR_NAME = node_env_var_name;
      break;
    }
  }

  // If we haven't successfully set the environment using the variables, we'll default it
  if (!NODE_ENV) {
    NODE_ENV = 'development';
  }

  node_env_var_names.forEach(node_env_var_name => {
    env[node_env_var_name] = NODE_ENV;
  });

  // Split files name, for loading multiple files.
  NODE_ENV = NODE_ENV.split(',');

  CONFIG_DIR = configDir || util.initParam('NODE_CONFIG_DIR', Path.join( process.cwd(), 'config') );
  if (CONFIG_DIR.indexOf('.') === 0) {
    CONFIG_DIR = Path.join(process.cwd() , CONFIG_DIR);
  }

  APP_INSTANCE = util.initParam('NODE_APP_INSTANCE');
  HOST = util.initParam('HOST');
  HOSTNAME = util.initParam('HOSTNAME');
  CONFIG_SKIP_GITCRYPT = util.initParam('CONFIG_SKIP_GITCRYPT');

  // This is for backward compatibility
  RUNTIME_JSON_FILENAME = util.initParam('NODE_CONFIG_RUNTIME_JSON', Path.join(CONFIG_DIR , 'runtime.json') );

  NODE_CONFIG_PARSER = util.initParam('NODE_CONFIG_PARSER');
  if (NODE_CONFIG_PARSER) {
    try {
      var parserModule = Path.isAbsolute(NODE_CONFIG_PARSER)
        ? NODE_CONFIG_PARSER
        : Path.join(CONFIG_DIR, NODE_CONFIG_PARSER);
      Parser = require(parserModule);
    }
    catch (e) {
      console.warn('Failed to load config parser from ' + NODE_CONFIG_PARSER);
      console.log(e);
    }
  }

  // Determine the host name from the OS module, $HOST, or $HOSTNAME
  // Remove any . appendages, and default to null if not set
  try {
    var hostName = HOST || HOSTNAME;

    if (!hostName) {
        var OS = require('os');
        hostName = OS.hostname();
    }
  } catch (e) {
    hostName = '';
  }

  // Store the hostname that won.
  env.HOSTNAME = hostName;

  // Read each file in turn
  var baseNames = ['default'].concat(NODE_ENV);

  // #236: Also add full hostname when they are different.
  if (hostName) {
    var firstDomain = hostName.split('.')[0];

    NODE_ENV.forEach(function(env) {
      // Backward compatibility
      baseNames.push(firstDomain, firstDomain + '-' + env);

      // Add full hostname when it is not the same
      if (hostName !== firstDomain) {
        baseNames.push(hostName, hostName + '-' + env);
      }
    });
  }

  NODE_ENV.forEach(function(env) {
    baseNames.push('local', 'local-' + env);
  });

  var allowedFiles = {};
  var resolutionIndex = 1;
  var extNames = Parser.getFilesOrder();
  baseNames.forEach(function(baseName) {
    extNames.forEach(function(extName) {
      allowedFiles[baseName + '.' + extName] = resolutionIndex++;
      if (APP_INSTANCE) {
        allowedFiles[baseName + '-' + APP_INSTANCE + '.' + extName] = resolutionIndex++;
      }
    });
  });

  var locatedFiles = util.locateMatchingFiles(CONFIG_DIR, allowedFiles);
  locatedFiles.forEach(function(fullFilename) {
    var configObj = util.parseFile(fullFilename, options);
    if (configObj) {
      util.extendDeep(config, configObj);
    }
  });

  // Override configurations from the $NODE_CONFIG environment variable
  // NODE_CONFIG only applies to the base config
  if (!configDir) {
    var envConfig = {};
    if (process.env.NODE_CONFIG) {
      try {
        envConfig = JSON.parse(process.env.NODE_CONFIG);
      } catch(e) {
        console.error('The $NODE_CONFIG environment variable is malformed JSON');
      }
      util.extendDeep(config, envConfig);
      var skipConfigSources = util.getOption(options,'skipConfigSources', false);
      if (!skipConfigSources){
        configSources.push({
          name: "$NODE_CONFIG",
          parsed: envConfig,
        });
      }
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
      var skipConfigSources = util.getOption(options,'skipConfigSources', false);
      if (!skipConfigSources){
        configSources.push({
          name: "--NODE_CONFIG argument",
          parsed: cmdLineConfig,
        });
      }
    }

    // Place the mixed NODE_CONFIG into the environment
    env['NODE_CONFIG'] = JSON.stringify(util.extendDeep(envConfig, cmdLineConfig, {}));
  }

  // Override with environment variables if there is a custom-environment-variables.EXT mapping file
  var customEnvVars = util.getCustomEnvVars(CONFIG_DIR, extNames);
  util.extendDeep(config, customEnvVars);

  // Extend the original config with the contents of runtime.json (backwards compatibility)
  var runtimeJson = util.parseFile(RUNTIME_JSON_FILENAME) || {};
  util.extendDeep(config, runtimeJson);

  util.resolveDeferredConfigs(config);

  // Return the configuration object
  return config;
};

/**
 * Return a list of fullFilenames who exists in allowedFiles
 * Ordered according to allowedFiles argument specifications
 *
 * @protected
 * @method locateMatchingFiles
 * @param configDirs {string}   the config dir, or multiple dirs separated by a column (:)
 * @param allowedFiles {object} an object. keys and supported filenames
 *                              and values are the position in the resolution order
 * @returns {string[]}          fullFilenames - path + filename
 */
util.locateMatchingFiles = function(configDirs, allowedFiles) {
  return configDirs.split(Path.delimiter)
    .reduce(function(files, configDir) {
      if (configDir) {
        try {
          FileSystem.readdirSync(configDir).forEach(function(file) {
            if (allowedFiles[file]) {
              files.push([allowedFiles[file], Path.join(configDir, file)]);
            }
          });
        }
        catch(e) {}
        return files;
      }
    }, [])
    .sort(function(a, b) { return a[0] - b[0]; })
    .map(function(file) { return file[1]; });
};

// Using basic recursion pattern, find all the deferred values and resolve them.
util.resolveDeferredConfigs = function (config) {
  var deferred = [];

  function _iterate (prop) {

    // We put the properties we are going to look it in an array to keep the order predictable
    var propsToSort = [];

    // First step is to put the properties of interest in an array
    for (var property in prop) {
      if (Object.hasOwnProperty.call(prop, property) && prop[property] != null) {
        propsToSort.push(property);
      }
    }

    // Second step is to iterate of the elements in a predictable (sorted) order
    propsToSort.sort().forEach(function (property) {
      if (prop[property].constructor === Object) {
        _iterate(prop[property]);
      } else if (prop[property].constructor === Array) {
        for (var i = 0; i < prop[property].length; i++) {
          if (prop[property][i] instanceof DeferredConfig) {
            deferred.push(prop[property][i].prepare(config, prop[property], i));
          }
          else {
            _iterate(prop[property][i]);
          }
        }
      } else {
        if (prop[property] instanceof DeferredConfig) {
          deferred.push(prop[property].prepare(config, prop, property));
        }
        // else: Nothing to do. Keep the property how it is.
      }
    });
  }

  _iterate(config);

  deferred.forEach(function (defer) { defer.resolve(); });
};

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
 * All other supported file types (yaml, toml, json, cson, hjson, json5, properties, xml)
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
 * @param options { object | undefined } parsing options. Current supported option: skipConfigSources: true|false
 * @return configObject {object|null} The configuration object parsed from the file
 */
util.parseFile = function(fullFilename, options) {
  var t = this,  // Initialize
      configObject = null,
      fileContent = null,
      stat = null;

  // Note that all methods here are the Sync versions.  This is appropriate during
  // module loading (which is a synchronous operation), but not thereafter.

  try {
    // Try loading the file.
    fileContent = FileSystem.readFileSync(fullFilename, 'utf-8');
    fileContent = fileContent.replace(/^\uFEFF/, '');
  }
  catch (e2) {
    if (e2.code !== 'ENOENT') {
      throw new Error('Config file ' + fullFilename + ' cannot be read. Error code is: '+e2.code
                        +'. Error message is: '+e2.message);
    }
    return null;  // file doesn't exists
  }

  // Parse the file based on extension
  try {

    // skip if it's a gitcrypt file and CONFIG_SKIP_GITCRYPT is true
    if (CONFIG_SKIP_GITCRYPT) {
      if (gitCryptTestRegex.test(fileContent)) {
        console.error('WARNING: ' + fullFilename + ' is a git-crypt file and CONFIG_SKIP_GITCRYPT is set. skipping.');
        return null;
      }
    }

    configObject = Parser.parse(fullFilename, fileContent);
  }
  catch (e3) {
    if (gitCryptTestRegex.test(fileContent)) {
      console.error('ERROR: ' + fullFilename + ' is a git-crypt file and CONFIG_SKIP_GITCRYPT is not set.');
    }
    throw new Error("Cannot parse config file: '" + fullFilename + "': " + e3);
  }

  // Keep track of this configuration sources, including empty ones, unless the skipConfigSources flag is set to true in the options
  var skipConfigSources = util.getOption(options,'skipConfigSources', false);
  if (typeof configObject === 'object' && !skipConfigSources) {
    configSources.push({
      name: fullFilename,
      original: fileContent,
      parsed: configObject,
    });
  }

  return configObject;
};

/**
 * Parse and return the specified string with the specified format.
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
 * xml = Parsed with a XML parser
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
  var parser = Parser.getParser(format);
  if (typeof parser === 'function') {
    return parser(null, content);
  }
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
  if (toObject instanceof RawConfig) {
    return toObject;
  }

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
      child = Buffer.alloc(parent.length);
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
      } else if (util.isPromise(parent[i])) {
        child[i] = parent[i];
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
 * @param value {*} - value to set, ignoring null
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
    if (!Object.hasOwnProperty.call(object, nextKey)) {
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
 * @param substitutionMap {object} - an object whose terminal (non-subobject) values are strings
 * @param variables {object[string:value]} - usually process.env, a flat object used to transform
 *      terminal values in a copy of substitutionMap.
 * @returns {object} - deep copy of substitutionMap with only those paths whose terminal values
 *      corresponded to a key in `variables`
 */
util.substituteDeep = function (substitutionMap, variables) {
  var result = {};

  function _substituteVars(map, vars, pathTo) {
    for (var prop in map) {
      var value = map[prop];
      if (typeof(value) === 'string') { // We found a leaf variable name
        if (vars[value] !== undefined && vars[value] !== '') { // if the vars provide a value set the value in the result map
          util.setPath(result, pathTo.concat(prop), vars[value]);
        }
      }
      else if (util.isObject(value)) { // work on the subtree, giving it a clone of the pathTo
        if ('__name' in value && '__format' in value && vars[value.__name] !== undefined && vars[value.__name] !== '') {
          try {
            var parsedValue = util.parseString(vars[value.__name], value.__format);
          } catch(err) {
            err.message = '__format parser error in ' + value.__name + ': ' + err.message;
            throw err;
          }
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
 * @param CONFIG_DIR {string} - the passed configuration directory
 * @param extNames {Array[string]} - acceptable configuration file extension names.
 * @returns {object} - mapped environment variables or {} if there are none
 */
util.getCustomEnvVars = function (CONFIG_DIR, extNames) {
  var result = {};
  var resolutionIndex = 1;
  var allowedFiles = {};
  extNames.forEach(function (extName) {
    allowedFiles['custom-environment-variables' + '.' + extName] = resolutionIndex++;
  });
  var locatedFiles = util.locateMatchingFiles(CONFIG_DIR, allowedFiles);
  locatedFiles.forEach(function (fullFilename) {
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

      // save original value in deferred elements
      var fromIsDeferredFunc = mergeFrom[prop] instanceof DeferredConfig;
      var isDeferredFunc = mergeInto[prop] instanceof DeferredConfig;

      if (fromIsDeferredFunc && Object.hasOwnProperty.call(mergeInto, prop)) {
        mergeFrom[prop]._original = isDeferredFunc ? mergeInto[prop]._original : mergeInto[prop];
      }
      // Extend recursively if both elements are objects and target is not really a deferred function
      if (mergeFrom[prop] instanceof Date) {
        mergeInto[prop] = mergeFrom[prop];
      } if (mergeFrom[prop] instanceof RegExp) {
        mergeInto[prop] = mergeFrom[prop];
      } else if (util.isObject(mergeInto[prop]) && util.isObject(mergeFrom[prop]) && !isDeferredFunc) {
        util.extendDeep(mergeInto[prop], mergeFrom[prop], depth - 1);
      }
      else if (util.isPromise(mergeFrom[prop])) {
        mergeInto[prop] = mergeFrom[prop];
      }
      // Copy recursively if the mergeFrom element is an object (or array or fn)
      else if (mergeFrom[prop] && typeof mergeFrom[prop] === 'object') {
        mergeInto[prop] = util.cloneDeep(mergeFrom[prop], depth -1);
      }

      // Copy property descriptor otherwise, preserving accessors
      else if (Object.getOwnPropertyDescriptor(Object(mergeFrom), prop)){
          Object.defineProperty(mergeInto, prop, Object.getOwnPropertyDescriptor(Object(mergeFrom), prop));
      } else {
          mergeInto[prop] = mergeFrom[prop];
      }
    }
  });

  // Chain
  return mergeInto;

};

/**
 * Is the specified argument a regular javascript object?
 *
 * The argument is an object if it's a JS object, but not an array.
 *
 * @protected
 * @method isObject
 * @param obj {*} An argument of any type.
 * @return {boolean} TRUE if the arg is an object, FALSE if not
 */
util.isObject = function(obj) {
  return (obj !== null) && (typeof obj === 'object') && !(Array.isArray(obj));
};

/**
 * Is the specified argument a javascript promise?
 *
 * @protected
 * @method isPromise
 * @param obj {*} An argument of any type.
 * @returns {boolean}
 */
util.isPromise = function(obj) {
  return Object.prototype.toString.call(obj) === '[object Promise]';
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
 * @param searchFor {String} The argument name to search for
 * @return {*} false if the argument was not found, the argument value if found
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
 * @param varName {String} The environment variable name
 * @return {String} The value of the environment variable
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

/**
 * Returns a new deep copy of the current config object, or any part of the config if provided.
 *
 * @param {Object} config The part of the config to copy and serialize. Omit this argument to return the entire config.
 * @returns {Object} The cloned config or part of the config
 */
util.toObject = function(config) {
  return JSON.parse(JSON.stringify(config || this));
};

// Run strictness checks on NODE_ENV and NODE_APP_INSTANCE and throw an error if there's a problem.
util.runStrictnessChecks = function (config) {
  var sources = config.util.getConfigSources();

  var sourceFilenames = sources.map(function (src) {
    return Path.basename(src.name);
  });

  NODE_ENV.forEach(function(env) {
    // Throw an exception if there's no explicit config file for NODE_ENV
    var anyFilesMatchEnv = sourceFilenames.some(function (filename) {
        return filename.match(env);
    });
    // development is special-cased because it's the default value
    if (env && (env !== 'development') && !anyFilesMatchEnv) {
      _warnOrThrow(NODE_ENV_VAR_NAME+" value of '"+env+"' did not match any deployment config file names.");
    }
    // Throw if NODE_ENV matches' default' or 'local'
    if ((env === 'default') || (env === 'local')) {
      _warnOrThrow(NODE_ENV_VAR_NAME+" value of '"+env+"' is ambiguous.");
    }
  });

  // Throw an exception if there's no explicit config file for NODE_APP_INSTANCE
  var anyFilesMatchInstance = sourceFilenames.some(function (filename) {
      return filename.match(APP_INSTANCE);
  });
  if (APP_INSTANCE && !anyFilesMatchInstance) {
    _warnOrThrow("NODE_APP_INSTANCE value of '"+APP_INSTANCE+"' did not match any instance config file names.");
  }

  function _warnOrThrow (msg) {
    var beStrict = process.env.NODE_CONFIG_STRICT_MODE;
    var prefix = beStrict ? 'FATAL: ' : 'WARNING: ';
    var seeURL = 'See https://github.com/lorenwest/node-config/wiki/Strict-Mode';

    console.error(prefix+msg);
    console.error(prefix+seeURL);

    // Accept 1 and true as truthy values. When set via process.env, Node.js casts them to strings.
    if (["true", "1"].indexOf(beStrict) >= 0) {
      throw new Error(prefix+msg+' '+seeURL);
    }
  }
};

// Instantiate and export the configuration
var config = module.exports = new Config();

// copy methods to util for backwards compatibility
util.stripComments = Parser.stripComments;
util.stripYamlComments = Parser.stripYamlComments;

// Produce warnings if the configuration is empty
var showWarnings = !(util.initParam('SUPPRESS_NO_CONFIG_WARNING'));
if (showWarnings && Object.keys(config).length === 0) {
  console.error('WARNING: No configurations found in configuration directory:' +CONFIG_DIR);
  console.error('WARNING: To disable this warning set SUPPRESS_NO_CONFIG_WARNING in the environment.');
}
