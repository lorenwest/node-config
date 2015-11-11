
var defer = require('../../defer').deferConfig;

var config = {
  siteTitle : 'Site title',
  latitude  : 1,
  longitude : 2,

};

function DeferLike() {}
DeferLike.prototype.resolve = function() {
  return "cFunc resolved!";
};

// Set up a default value which refers to another value.
// The resolution of the value is deferred until all the config files have been loaded
// So that if 'config.siteTitle' is overridden, this will point to the correct value.
config.welcomeEmail = {
  subject :  defer(function (cfg) {
    return "Welcome to "+cfg.siteTitle;
  }),
  // A plain function should be not disturbed.
  aFunc  : function () {
    return "Still just a function.";
  },
  // plain objects with a resolve function are still a function
  bFunc : {
    resolve: function() {
      return "Still just a function.";
    }
  },
  // proper objects with a resolve function are resolved
  cFunc : Object.create(DeferLike.prototype),

  // Look ma, no arg passing. The main config object is bound to 'this'
  justThis: defer(function () {
    return "Welcome to this "+this.siteTitle;
  }),
};

config.map = {
  centerPoint : defer(function () {
    return { lat: this.latitude, lon: this.longitude };
  }),
};

module.exports = config;
