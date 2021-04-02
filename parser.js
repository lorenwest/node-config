// External libraries are lazy-loaded only if these file types exist.
var Yaml = null,
    VisionmediaYaml = null,
    Coffee = null,
    Iced = null,
    CSON = null,
    PPARSER = null,
    JSON5 = null,
    TOML = null,
    HJSON = null,
    XML = null;

// Define soft dependencies so transpilers don't include everything
var COFFEE_2_DEP = 'coffeescript',
    COFFEE_DEP = 'coffee-script',
    ICED_DEP = 'iced-coffee-script',
    JS_YAML_DEP = 'js-yaml',
    YAML_DEP = 'yaml',
    JSON5_DEP = 'json5',
    HJSON_DEP = 'hjson',
    TOML_DEP = 'toml',
    CSON_DEP = 'cson',
    PPARSER_DEP = 'properties',
    XML_DEP = 'x2js',
    TS_DEP = 'ts-node';

var Parser = module.exports;

Parser.parse = function(filename, content) {
  var parserName = filename.substr(filename.lastIndexOf('.') +1);  // file extension
  if (typeof definitions[parserName] === 'function') {
    return definitions[parserName](filename, content);
  }
  // TODO: decide what to do in case of a missing parser
};

Parser.xmlParser = function(filename, content) {
  if (!XML) {
    XML = require(XML_DEP);
  }
  var x2js = new XML();
  var configObject = x2js.xml2js(content);
  var rootKeys = Object.keys(configObject);
  if(rootKeys.length === 1) {
    return configObject[rootKeys[0]];
  }
  return configObject;
};

Parser.jsParser = function(filename, content) {
  return require(filename);
};

Parser.tsParser = function(filename, content) {
  if (!require.extensions['.ts']) {
    require(TS_DEP).register({
      lazy: true,
      transpileOnly: true,
      compilerOptions: {
        allowJs: true,
      }
    });
  }

  // Imports config if it is exported via module.exports = ...
  // See https://github.com/lorenwest/node-config/issues/524
  var configObject = require(filename);

  // Because of ES6 modules usage, `default` is treated as named export (like any other)
  // Therefore config is a value of `default` key.
  if (configObject.default) {
    return configObject.default
  }
  return configObject;
};

Parser.coffeeParser = function(filename, content) {
  // .coffee files can be loaded with either coffee-script or iced-coffee-script.
  // Prefer iced-coffee-script, if it exists.
  // Lazy load the appropriate extension
  if (!Coffee) {
    Coffee = {};

    // The following enables iced-coffee-script on .coffee files, if iced-coffee-script is available.
    // This is commented as per a decision on a pull request.
    //try {
    //  Coffee = require('iced-coffee-script');
    //}
    //catch (e) {
    //  Coffee = require('coffee-script');
    //}
    try {
      // Try to load coffeescript
      Coffee = require(COFFEE_2_DEP);
    }
    catch (e) {
      // If it doesn't exist, try to load it using the deprecated module name
      Coffee = require(COFFEE_DEP);
    }
    // coffee-script >= 1.7.0 requires explicit registration for require() to work
    if (Coffee.register) {
      Coffee.register();
    }
  }
  // Use the built-in parser for .coffee files with coffee-script
  return require(filename);
};

Parser.icedParser = function(filename, content) {
  Iced = require(ICED_DEP);

  // coffee-script >= 1.7.0 requires explicit registration for require() to work
  if (Iced.register) {
    Iced.register();
  }
};

Parser.yamlParser = function(filename, content) {
  if (!Yaml && !VisionmediaYaml) {
    // Lazy loading
    try {
      // Try to load the better js-yaml module
      Yaml = require(JS_YAML_DEP);
    }
    catch (e) {
      try {
        // If it doesn't exist, load the fallback visionmedia yaml module.
        VisionmediaYaml = require(YAML_DEP);
      }
      catch (e) { }
    }
  }
  if (Yaml) {
    return Yaml.load(content);
  }
  else if (VisionmediaYaml) {
    // The yaml library doesn't like strings that have newlines but don't
    // end in a newline: https://github.com/visionmedia/js-yaml/issues/issue/13
    content += '\n';
    if (typeof VisionmediaYaml.eval === 'function') {
      return VisionmediaYaml.eval(Parser.stripYamlComments(content));
    }
    return VisionmediaYaml.parse(Parser.stripYamlComments(content));
  }
  else {
    console.error('No YAML parser loaded.  Suggest adding js-yaml dependency to your package.json file.')
  }
};

Parser.jsonParser = function(filename, content) {
  try {
    return JSON.parse(content);
  }
  catch (e) {
    // All JS Style comments will begin with /, so all JSON parse errors that
    // encountered a syntax error will complain about this character.
    if (e.name !== 'SyntaxError' || e.message.indexOf('Unexpected token /') !== 0) {
      throw e;
    }
    if (!JSON5) {
      JSON5 = require(JSON5_DEP);
    }
    return JSON5.parse(content);
  }
};

Parser.json5Parser = function(filename, content) {
  if (!JSON5) {
    JSON5 = require(JSON5_DEP);
  }
  return JSON5.parse(content);
};

Parser.hjsonParser = function(filename, content) {
  if (!HJSON) {
    HJSON = require(HJSON_DEP);
  }
  return HJSON.parse(content);
};

Parser.tomlParser = function(filename, content) {
  if(!TOML) {
    TOML = require(TOML_DEP);
  }
  return TOML.parse(content);
};

Parser.csonParser = function(filename, content) {
  if (!CSON) {
    CSON = require(CSON_DEP);
  }
  // Allow comments in CSON files
  if (typeof CSON.parseSync === 'function') {
    return CSON.parseSync(Parser.stripComments(content));
  }
  return CSON.parse(Parser.stripComments(content));
};

Parser.propertiesParser = function(filename, content) {
  if (!PPARSER) {
    PPARSER = require(PPARSER_DEP);
  }
  return PPARSER.parse(content, { namespaces: true, variables: true, sections: true });
};

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
 * @param fileStr {string} The string to strip comments from
 * @param stringRegex {RegExp} Optional regular expression to match strings that
 *   make up the config file
 * @return {string} The string with comments stripped.
 */
Parser.stripComments = function(fileStr, stringRegex) {
  stringRegex = stringRegex || /(['"])(\\\1|.)+?\1/g;

  var uid = '_' + +new Date(),
    primitives = [],
    primIndex = 0;

  return (
    fileStr

    /* Remove strings */
      .replace(stringRegex, function(match){
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
 * Strip YAML comments from the string
 *
 * The 2.0 yaml parser doesn't allow comment-only or blank lines.  Strip them.
 *
 * @protected
 * @method stripYamlComments
 * @param fileStr {string} The string to strip comments from
 * @return {string} The string with comments stripped.
 */
Parser.stripYamlComments = function(fileStr) {
  // First replace removes comment-only lines
  // Second replace removes blank lines
  return fileStr.replace(/^\s*#.*/mg,'').replace(/^\s*[\n|\r]+/mg,'');
};

/**
 * Parses the environment variable to the boolean equivalent.
 * Defaults to false
 *
 * @param {String} content - Environment variable value
 * @return {boolean} - Boolean value fo the passed variable value
 */
Parser.booleanParser = function(filename, content) {
  return content === 'true';
};

/**
 * Parses the environment variable to the number equivalent.
 * Defaults to undefined
 *
 * @param {String} content - Environment variable value
 * @return {Number} - Number value fo the passed variable value
 */
Parser.numberParser = function(filename, content) {
  const numberValue = Number(content);
  return Number.isNaN(numberValue) ? undefined : numberValue;
};

var order = ['js', 'cjs', 'ts', 'json', 'json5', 'hjson', 'toml', 'coffee', 'iced', 'yaml', 'yml', 'cson', 'properties', 'xml',
  'boolean', 'number'];
var definitions = {
  cjs: Parser.jsParser,
  coffee: Parser.coffeeParser,
  cson: Parser.csonParser,
  hjson: Parser.hjsonParser,
  iced: Parser.icedParser,
  js: Parser.jsParser,
  json: Parser.jsonParser,
  json5: Parser.json5Parser,
  properties: Parser.propertiesParser,
  toml: Parser.tomlParser,
  ts: Parser.tsParser,
  xml: Parser.xmlParser,
  yaml: Parser.yamlParser,
  yml: Parser.yamlParser,
  boolean: Parser.booleanParser,
  number: Parser.numberParser
};

Parser.getParser = function(name) {
  return definitions[name];
};

Parser.setParser = function(name, parser) {
  definitions[name] = parser;
  if (order.indexOf(name) === -1) {
    order.push(name);
  }
};

Parser.getFilesOrder = function(name) {
  if (name) {
    return order.indexOf(name);
  }
  return order;
};

Parser.setFilesOrder = function(name, newIndex) {
  if (Array.isArray(name)) {
    return order = name;
  }
  if (typeof newIndex === 'number') {
    var index = order.indexOf(name);
    order.splice(newIndex, 0, name);
    if (index > -1) {
      order.splice(index >= newIndex ? index +1 : index, 1);
    }
  }
  return order;
};
