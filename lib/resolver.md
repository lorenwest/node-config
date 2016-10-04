# How resolution works.

After all of the config data has been read in and merged, the defer.js module's 
resolve() method is called. Its task is to recursively walk through the entire 
heirarchical data tree, and wherever there is a deferred function, to evaluate 
it, and replace that node in the tree with the return value of the function.

In order to enable other configuration values to be used inside the bodies of 
deferred functions in such a way that it doesn't depend on the order of 
evaluation (see 
[issue #266](https://github.com/lorenwest/node-config/issues/266)) proxy 
objects are used to represent those config objects during those evaluations.

For example, suppose you have config files with:

```javascript
// default.js:
var config = {
  siteTitle : 'Site title',
  header :  defer(cfg => 'Welcome to ' + cfg.siteTitle),
};

// local.js:
var config = {
  fadOfTheWeek = 'Big Data',
  siteTitle : defer(cfg => cfg.fadOfTheWeek + ' Experts!'),
};
```

During resolution, the deferred function for `header` is executed. If the 
value of the `cfg` argument inside that function were the actual config 
object, then that could cause problems, because the value for `siteTitle` also 
comes from a deferred. If the `header` function is evaluated first, then the 
value would be garbled -- it would include the default string representation 
of the DeferredConfig instance. 

Instead, the value of the `cfg` argument inside the deferred function body is 
not the actual config object, but an instance of the Resolver class. It has 
getter functions for each of the properties of the real config object. In the 
example above, when the `header` deferred is executed, the expression `cfg.
siteTitle` is evaluated, which causes that getter function to be executed. 
That function is smart enough to recognize that the value of `siteTitle` comes 
from a deferred function; so it executes it, and returns the correct result.

This approach is very powerful, and enables complex interdependencies among 
config variables, without ever having to worry about the time-ordering of the 
evaluations. Of course, circular references are not allowed.
So, for example, this wouldn't work:

```javascript
name: defer(cfg => ({
  first: 'Robert',
  nickname: cfg.name.first == 'Robert' ? 'Bob' : 'Bruce',
})),
```

At first glance, it might seem that this isn't circular, since `nickname` is 
referencing a sibling, not itself. However, when evaluating `nickname`, the 
reference to `cfg.name` must be evaluated first, and it's inside it's own 
deferred function, which makes it circular. This could be fixed easily, 
however, using a nested deferred:

```javascript
name: defer(cfg => ({
  first: 'Robert',
  nickname: defer(cfg => cfg.name.first == 'Robert' ? 'Bob' : 'Bruce'),
})),
```

To avoid making this mistake, you could adopt the convention that any "leaf" 
value that depends on other config information should be wrapped in its own 
deferred function.


## Algorithm

During resolution, the software maintains two trees of data:

1. config tree, which is the original config data, that includes atoms, 
  objects, and deferreds (no resolvers)
2. resolver tree, which proxies the config tree, and has nodes *only* of type 
  atom and resolver (no objects or deferreds). The resolver tree nodes are
  constructed dynamically by the getters, but the tree can be thought of as 
  static. 

These routines are involved during the resolution process:

***resolve(config)***

The main entry point. This function resolves the entire config tree, 
evaluating and replacing all deferreds.

It creates a new Resolver object (the "main resolver") from `config` (which is 
the "main" config, or the root of the config tree) and delegates to its 
`resolve()` method. Note that this "main resolver" is the object that gets 
passed in as the `cfg` argument of the deferred functions.

***resolver.resolve()***

This resolves the config subtree corresponding to this resolver. It is a very
simple recursive process: it iterates over its child nodes, which must be 
either atoms or resolvers:

* If atom, it is inserted into the config object.
* If resolver:
    * Recurse: call its `resolve()` method
    * Insert this child resolver's config node into our config object 

***resolver getters***

These invoke `.newNode()` to construct new nodes in the resolver tree, and 
store the results (each node is only created once).

***resolver.newNode()***

The argument to this is a node from either the config tree or the resolver 
tree (in other words, it can be of any type). If it's an atom or resolver,
this merely passes it along. If it is a deferred, this executes the deferred 
recursively, until the return value is something else. If it is an object, 
then a new Resolver object is created to wrap it, and that is returned.
