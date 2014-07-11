/**
 * @module FrameworkBuilders
 * @version 1.6.0
 */

'use strict';

var utils = require('./utils');

var schema = {};
var schemaValidation = {};
var schemaValidator = {};
var schemaDefaults = {};

var UNDEFINED = 'undefined';
var FUNCTION = 'function';
var OBJECT = 'object';
var STRING = 'string';
var NUMBER = 'number';
var BOOLEAN = 'boolean';
var REQUIRED = 'The field "@" is required.';

/**
 * ErrorBuilder
 * @class
 * @classdesc Object validation.
 * @param {ErrorBuilderOnResource} onResource Resource handler.
 * @property {Number} count Count of errors.
 */
function ErrorBuilder(onResource) {

    this.errors = [];
    this.onResource = onResource;
    this.resourceName = 'default';
    this.resourcePrefix = '';
    this.count = 0;
    this.replacer = [];
    this.isPrepared = false;

    if (typeof(onResource) === UNDEFINED)
        this._resource();
}

/**
 * @callback ErrorBuilderOnResource
 * @param {String} name Filename of resource.
 * @param {String} key Resource key.
 * @return {String}
 */

/**
 * UrlBuilder
 * @class
 * @classdesc CRUD parameters in URL.
 */
function UrlBuilder() {
    this.builder = {};
}

/**
 * Pagination
 * @class
 * @param {Number} items Count of items.
 * @param {Number} page Current page.
 * @param {Number} max Max items on page.
 * @param {String} format URL format for links (next, back, go to). Example: ?page={0} --- {0} = page, {1} = items count, {2} = page count
 * @property {Number} isNext Is next page?
 * @property {Number} isPrev Is previous page?
 * @property {Number} count Page count.
 * @property {Boolean} visible Is more than one page?
 * @property {String} format Format URL. Example: ?page={0} --- {0} = page, {1} = items count, {2} = page count
 */
function Pagination(items, page, max, format) {
    this.isNext = false;
    this.isPrev = false;
    this.items = items;
    this.count = 0;
    this.skip = 0;
    this.take = 0;
    this.page = 0;
    this.max = 0;
    this.visible = false;
    this.format = format || '?page={0}';
    this.refresh(items, page, max);
}

/**
 * Create schema
 * @param  {String} name chema name.
 * @param  {Object} obj Schema definition.
 * @param  {SchemaDefaults} defaults Schema defaults.
 * @param  {SchemaValidator} validator Schema validator.
 * @return {Object}
 */
exports.schema = function(name, obj, defaults, validator, properties) {

    if (typeof(obj) === UNDEFINED)
        return schema[name] || null;

    if (typeof(defaults) === FUNCTION)
        schemaDefaults[name] = defaults;

    if (typeof(validator) === FUNCTION)
        schemaValidator[name] = validator;

    if (properties instanceof Array)
        schemaValidation[name] = properties;

    schema[name] = obj;
    return obj;
};

/**
 * Default handler
 * @callback SchemaDefaults
 * @param {String} name Property name.
 * @param {Booelan} isDefault Is default (true) or prepare (false)?
 * @return {Object} Property value.
 */

/**
 * Validator handler
 * @callback SchemaValidator
 * @param {String} name Property name.
 * @param {Object} value Property value.
 * @return {Boolean} Is valid?
 */

/**
 * Check if property value is joined to other class
 * @private
 * @param {String} value Property value from Schema definition.
 * @return {Boolean}
 */
exports.isJoin = function(value) {
    if (!value)
        return false;
    if (value[0] === '[')
        return true;
    return typeof(schema[value]) !== UNDEFINED;
};

/**
 * Create validation
 * @param {String} name Schema name.
 * @param {Function or Array} fn Validator Handler or Property names as array for validating.
 * @param {String Array} properties Valid only these properties, optional.
 * @return {Function or Array}
 */
exports.validation = function(name, properties, fn) {

    if (fn instanceof Array && typeof(properties) === FUNCTION) {
        var tmp = fn;
        fn = properties;
        properties = fn;
    }

    if (typeof(fn) === FUNCTION) {

        schemaValidator[name] = fn;

        if (typeof(properties) === UNDEFINED)
            schemaValidation[name] = Object.keys(schema[name]);
        else
            schemaValidation[name] = properties;

        return true;
    }

    if (typeof(fn) === UNDEFINED) {
        var validator = schemaValidation[name];
        if (typeof(validator) === UNDEFINED)
            return Object.keys(schema[name]);
        return schema || [];
    }

    schemaValidation[name] = fn;
    return fn;
};

/**
 * Validate model
 * @param {String} name Schema name.
 * @param {Object} model Object for validating.
 * @return {ErrorBuilder}
 */
exports.validate = function(name, model, resourcePrefix, resourceName) {

    var fn = schemaValidator[name];
    var builder = new ErrorBuilder();

    if (typeof(fn) === UNDEFINED)
        return builder;

    if (resourceName)
        builder.resourceName = resourceName;

    if (resourcePrefix)
        builder.resourcePrefix = resourcePrefix;

    return utils.validate.call(this, model, name, fn, builder);
};

/**
 * Create default object according to schema
 * @param  {String} name Schema name.
 * @return {Object}
 */
exports.create = function(name) {
    return exports.defaults(name);
};

/**
 * Create default object according to schema
 * @param  {String} name Schema name.
 * @return {Object}
 */
exports.defaults = function(name) {

    var obj = exports.schema(name);

    if (obj === null)
        return null;

    var defaults = schemaDefaults[name];
    var item = utils.extend({}, obj, true);
    var properties = Object.keys(item);
    var length = properties.length;

    for (var i = 0; i < length; i++) {

        var property = properties[i];
        var value = item[property];
        var type = typeof(value);

        if (defaults) {
            var def = defaults(property, true);
            if (typeof(def) !== UNDEFINED) {
                item[property] = def;
                continue;
            }
        }

        if (type === FUNCTION) {

            if (value === Number) {
                item[property] = 0;
                continue;
            }

            if (value === Boolean) {
                item[property] = false;
                continue;
            }

            if (value === String) {
                item[property] = '';
                continue;
            }

            if (value === Date) {
                item[property] = new Date();
                continue;
            }

            if (value === Object) {
                item[property] = {};
                continue;
            }

            if (value === Array) {
                item[property] = [];
                continue;
            }

            item[property] = value();
            continue;
        }

        if (type === NUMBER) {
            item[property] = 0;
            continue;
        }

        if (type === BOOLEAN) {
            item[property] = false;
            continue;
        }

        if (type === OBJECT) {
            item[property] = value instanceof Array ? [] : {};
            continue;
        }

        if (type !== STRING) {
            item[property] = null;
            continue;
        }

        var isArray = value[0] === '[';

        if (isArray)
            value = value.substring(1, value.length - 1);

        if (isArray) {
            item[property] = [];
            continue;
        }

        var lower = value.toLowerCase();

        if (lower.contains([STRING, 'text', 'varchar', 'nvarchar', 'binary', 'data', 'base64'])) {
            item[property] = '';
            continue;
        }

        if (lower.contains(['int', NUMBER, 'decimal', 'byte', 'float', 'double'])) {
            item[property] = 0;
            continue;
        }

        if (lower.contains('bool')) {
            item[property] = false;
            continue;
        }

        if (lower.contains(['date', 'time'])) {
            item[property] = new Date();
            continue;
        }

        if (lower.contains(['object'])) {
            item[property] = {};
            continue;
        }

        if (lower.contains(['array'])) {
            item[property] = [];
            continue;
        }

        if (lower.contains(['binary', 'data', 'base64'])) {
            item[property] = null;
            continue;
        }

        item[property] = exports.defaults(value);
    }

    return item;
};

/**
 * Prepare object according to schema
 * @param {String} name Schema name.
 * @param {Object} model Object to prepare.
 * @return {Object} Prepared object.
 */
exports.prepare = function(name, model) {

    var obj = exports.schema(name);

    if (obj === null)
        return null;

    if (model === null || typeof(model) === UNDEFINED)
        return exports.defaults(name);

    var tmp;
    var item = utils.extend({}, obj, true);
    var properties = Object.keys(item);
    var defaults = schemaDefaults[name];
    var length = properties.length;

    for (var i = 0; i < length; i++) {

        var property = properties[i];
        var val = model[property];

        if (typeof(val) === UNDEFINED && defaults)
            val = defaults(property, false);

        if (typeof(val) === UNDEFINED)
            val = '';

        var value = item[property];
        var type = typeof(value);
        var typeval = typeof(val);

        if (typeval === FUNCTION)
            val = val();

        if (type === FUNCTION) {

            if (value === Number) {
                item[property] = utils.parseFloat(val);
                continue;
            }

            if (value === Boolean) {
                tmp = val.toString();
                item[property] = tmp === 'true' || tmp === '1';
                continue;
            }

            if (value === String) {
                item[property] = val.toString();
                continue;
            }

            if (value === Date) {

                tmp = null;

                switch (typeval) {
                    case OBJECT:
                        if (utils.isDate(val))
                            tmp = val;
                        else
                            tmp = null;
                        break;

                    case NUMBER:
                        tmp = new Date(val);
                        break;

                    case STRING:
                        if (val === '')
                            tmp = null;
                        else
                            tmp = val.parseDate();
                        break;
                }

                if (tmp !== null && typeof(tmp) === OBJECT && tmp.toString() === 'Invalid Date')
                    tmp = null;

                item[property] = tmp || (defaults ? isUndefined(defaults(property), null) : null);
                continue;
            }

            item[property] = defaults ? isUndefined(defaults(value), null) : null;
            continue;
        }

        if (type === OBJECT) {
            item[property] = typeval === OBJECT ? val : null;
            continue;
        }

        if (type === NUMBER) {
            item[property] = utils.parseFloat(val);
            continue;
        }

        if (val === null || typeval === UNDEFINED)
            tmp = '';
        else
            tmp = val.toString();

        if (type === BOOLEAN) {
            item[property] = tmp === 'true' || tmp === '1';
            continue;
        }

        if (type !== STRING) {
            item[property] = tmp;
            continue;
        }

        var isArray = value[0] === '[' || value === 'array';

        if (isArray) {

            if (value[0] === '[')
                value = value.substring(1, value.length - 1);
            else
                value = null;

            if (!(val instanceof Array)) {
                item[property] = (defaults ? isUndefined(defaults(property, false), []) : []);
                continue;
            }

            item[property] = [];
            var sublength = val.length;
            for (var j = 0; j < sublength; j++) {

                if (value === null) {
                    item[property].push(model[property][j]);
                    continue;
                }

                var tmp = model[property][j];

                switch (value.toLowerCase()) {
                    case 'string':
                    case 'varchar':
                    case 'text':
                        item[property].push((tmp || '').toString());
                        break;
                    case 'bool':
                    case 'boolean':
                        tmp = (tmp || '').toString().toLowerCase();
                        item[property].push(tmp === 'true' || tmp === '1');
                        break;
                    case 'int':
                    case 'integer':
                        item[property].push(utils.parseInt(tmp));
                        break;
                    case 'number':
                        item[property].push(utils.parseFloat(tmp));
                        break;
                    default:
                        item[property][j] = exports.prepare(value, model[property][j]);
                        break;
                }
            }

            continue;
        }

        var lower = value.toLowerCase();

        if (lower.contains([STRING, 'text', 'varchar', 'nvarchar'])) {

            var beg = lower.indexOf('(');
            if (beg === -1) {
                item[property] = tmp;
                continue;
            }

            var size = lower.substring(beg + 1, lower.length - 1).parseInt();
            item[property] = tmp.max(size, '...');
            continue;
        }

        if (lower.contains(['int', 'byte'])) {
            item[property] = utils.parseInt(val);
            continue;
        }

        if (lower.contains(['decimal', NUMBER, 'float', 'double'])) {
            item[property] = utils.parseFloat(val);
            continue;
        }

        if (lower.contains('bool', BOOLEAN)) {
            item[property] = tmp === 'true' || tmp === '1';
            continue;
        }

        if (lower.contains(['date', 'time'])) {

            if (typeval === 'date') {
                item[property] = val;
                continue;
            }

            if (typeval === STRING) {
                item[property] = val.parseDate();
                continue;
            }

            if (typeval === NUMBER) {
                item[property] = new Date(val);
                continue;
            }

            item[property] = isUndefined(defaults(property));
            continue;
        }

        item[property] = exports.prepare(value, model[property]);
    }

    return item;
};

function isUndefined(value, def) {
    if (typeof(value) === UNDEFINED)
        return def;
    return value;
}

// ======================================================
// PROTOTYPES
// ======================================================

/**
 * Resource setting
 * @param {String} name Resource name.
 * @param {String} prefix Resource prefix.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.resource = function(name, prefix) {
    var self = this;
    self.resourceName = name || 'default';
    self.resourcePrefix = prefix || '';
    return self._resource();
};

/**
 * Internal: Resource wrapper
 * @private
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype._resource = function() {

    var self = this;

    self.onResource = function(name) {
        var self = this;
        return framework.resource(self.resourceName, self.resourcePrefix + name);
    };

    return self;
};

/**
 * Add an error
 * @param {String} name  Property name.
 * @param {String} error Error message.
 * @param {String} path  Current path (in object).
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.add = function(name, error, path) {
    var self = this;
    self.isPrepared = false;

    if (name instanceof ErrorBuilder) {

        name.errors.forEach(function(o) {
            self.errors.push(o);
        });

        self.count = self.errors.length;
        return self;
    }

    self.errors.push({
        name: name,
        error: error || '@',
        path: path
    });

    self.count = self.errors.length;
    return self;
};

/**
 * Remove error
 * @param {String} name Property name.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.remove = function(name) {
    var self = this;

    self.errors = self.errors.remove(function(o) {
        return o.name === name;
    });

    self.count = self.errors.length;
    return self;
};

/**
 * Has error?
 * @param {String}  name Property name (optional).
 * @return {Boolean}
 */
ErrorBuilder.prototype.hasError = function(name) {
    var self = this;

    if (name) {
        return self.errors.find(function(o) {
            return o.name === name;
        }) !== null;
    }

    return self.errors.length > 0;
};

/**
 * Read an error
 * @param {String} name Property name.
 * @return {String}
 */
ErrorBuilder.prototype.read = function(name) {

    var self = this;

    if (!self.isPrepared)
        self.prepare();

    var error = self.errors.find(function(o) {
        return o.name === name;
    });

    if (error !== null)
        return error.error;

    return null;
};

/**
 * Clear error collection
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.clear = function() {
    var self = this;
    self.errors = [];
    self.count = 0;
    return self;
};

/**
 * Replace text in message
 * @param {String} search Text to search.
 * @param {String} newvalue Text to replace.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.replace = function(search, newvalue) {
    var self = this;
    self.isPrepared = false;
    self.replacer[search] = newvalue;
    return self;
};

/**
 * Serialize ErrorBuilder to JSON
 * @param {Boolean} beautify Beautify JSON.
 * @param {Function(key, value)} replacer JSON replacer.
 * @return {String}
 */
ErrorBuilder.prototype.json = function(beautify, replacer) {
    if (beautify)
        return JSON.stringify(this.prepare().errors, replacer, '\t');
    return JSON.stringify(this.prepare().errors, replacer);
};

/**
 * Serialize ErrorBuilder to JSON
 * @param {Boolean} beautify Beautify JSON.
 * @return {String}
 */
ErrorBuilder.prototype.JSON = function(beautify) {
    if (beautify)
        return JSON.stringify(this.prepare().errors, null, '\t');
    return JSON.stringify(this.prepare().errors);
};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuidler}
 */
ErrorBuilder.prototype._prepare = function() {

    var self = this;

    if (self.onResource === null)
        return self;

    var errors = self.errors;
    var length = errors.length;

    for (var i = 0; i < length; i++) {

        var o = errors[i];

        if (o.error[0] !== '@')
            continue;

        if (o.error.length === 1)
            o.error = self.onResource(o.name);
        else
            o.error = self.onResource(o.error.substring(1));

        if (typeof(o.error) === UNDEFINED)
            o.error = REQUIRED.replace('@', o.name);
    }

    return self;
};

/**
 * To string
 * @return {String}
 */
ErrorBuilder.prototype.toString = function() {

    var self = this;

    if (!self.isPrepared)
        self.prepare();

    var errors = self.errors;
    var length = errors.length;
    var builder = [];

    for (var i = 0; i < length; i++)
        builder.push(errors[i].error || errors[i].name);

    return builder.join('\n');

};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuidler}
 */
ErrorBuilder.prototype._prepareReplace = function() {

    var self = this;
    var errors = self.errors;
    var lengthBuilder = errors.length;
    var keys = Object.keys(self.replacer);
    var lengthKeys = keys.length;

    if (lengthBuilder === 0 || lengthKeys === 0)
        return self;

    for (var i = 0; i < lengthBuilder; i++) {
        var o = errors[i];
        for (var j = 0; j < lengthKeys; j++) {
            var key = keys[j];
            o.error = o.error.replace(key, self.replacer[key]);
        }
    }

    return self;
};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuidler}
 */
ErrorBuilder.prototype.prepare = function() {
    var self = this;

    if (self.isPrepared)
        return self;

    self._prepare()._prepareReplace();
    self.isPrepared = true;

    return self;
};

/**
 * Refresh pagination
 * @param {Number} items Count of items.
 * @param {Number} page Current page.
 * @param {Number} max Max items on page.
 * @return {Pagination}
 */
Pagination.prototype.refresh = function(items, page, max) {
    var self = this;

    self.count = Math.floor(items / max) + (items % max > 0 ? 1 : 0);
    self.page = page - 1;

    if (self.page < 0)
        self.page = 0;

    self.items = items;
    self.skip = self.page * max;
    self.take = max;
    self.max = max;
    self.isPrev = self.page > 0;
    self.isNext = self.page < self.count - 1;
    self.visible = self.count > 1;
    self.page++;

    return self;
};

/**
 * Get previous page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.prev = function(format) {
    var self = this;
    var page = 0;

    format = format || self.format;

    if (self.isPrev)
        page = self.page - 1;
    else
        page = self.count;

    return {
        url: format.format(page, self.items, self.count),
        page: page,
        selected: false
    };
};

/**
 * Get next page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.next = function(format) {
    var self = this;
    var page = 0;

    format = format || self.format;

    if (self.isNext)
        page = self.page + 1;
    else
        page = 1;

    return {
        url: format.format(page, self.items, self.count),
        page: page,
        selected: false
    };
};

/**
 * Create pagination
 * @param {Number} max Max pages in collection (optional).
 * @param {String} format Custom format (optional).
 * @return {Object Array} Example: [{ url: String, page: Number, selected: Boolean }]
 */
Pagination.prototype.render = function(max, format) {

    var self = this;
    var builder = [];
    format = format || self.format;

    if (typeof(max) === STRING) {
        var tmp = format;
        format = max;
        max = format;
    }

    if (typeof(max) === UNDEFINED || max === null) {
        for (var i = 1; i < self.count + 1; i++)
            builder.push({
                url: format.format(i, self.items, self.count),
                page: i,
                selected: i === self.page
            });
        return builder;
    }

    var half = Math.floor(max / 2);
    var pages = self.count;

    var pageFrom = self.page - half;
    var pageTo = self.page + half;
    var plus = 0;

    if (pageFrom <= 0) {
        plus = Math.abs(pageFrom);
        pageFrom = 1;
        pageTo += plus;
    }

    if (pageTo >= pages) {
        pageTo = pages;
        pageFrom = pages - max;
    }

    if (pageFrom < 0)
        pageFrom = 1;

    for (var i = pageFrom; i < pageTo + 1; i++)
        builder.push({
            url: format.format(i, self.items, self.count),
            page: i,
            selected: i === self.page
        });

    return builder;
};

/**
 * Add parameter
 * @param {String} name
 * @param {Object} value
 * return {UrlBuilder}
 */
UrlBuilder.prototype.add = function(name, value) {
    var self = this;

    if (typeof(name) === 'object') {
        Object.keys(name).forEach(function(o) {
            self.builder[o] = name[o];
        });
        return;
    }

    self.builder[name] = value;
    return self;
};

/**
 * Remove parameter
 * @param {String} name
 * @return {UrlBuilder}
 */
UrlBuilder.prototype.remove = function(name) {
    var self = this;
    delete self.builder[name];
    return self;
};

/**
 * Read value
 * @param {String} name
 * @return {Object}
 */
UrlBuilder.prototype.read = function(name) {
    return this.builder[name] || null;
};

/**
 * Clear parameter collection
 * @return {UrlBuilder}
 */
UrlBuilder.prototype.clear = function() {
    var self = this;
    self.builder = {};
    return self;
};

/**
 * Create URL
 * @return {String}
 */
UrlBuilder.prototype.toString = function() {

    var self = this;
    var builder = [];

    Object.keys(self.builder).forEach(function(o) {
        builder.push(o + '=' + encodeURIComponent(self.builder[o] || ''));
    });

    return builder.join('&');
};

/**
 * Has these parameters?
 * @param {String Array} keys Keys.
 * @return {Boolean}
 */
UrlBuilder.prototype.hasValue = function(keys) {

    if (typeof(keys) === UNDEFINED)
        return false;

    var self = this;

    if (typeof(keys) === 'string')
        keys = [keys];

    for (var i = 0; i < keys.length; i++) {
        var val = self.builder[keys[i]];
        if (typeof(val) === UNDEFINED || val === null)
            return false;
    }

    return true;
};

/**
 * Render paramerters
 * @param {String Array} keys Keys.
 * @param {String} delimiter Delimiter (default &).
 * @return {String}
 */
UrlBuilder.prototype.toOne = function(keys, delimiter) {

    var self = this;
    var builder = [];

    keys.forEach(function(o) {
        builder.push(self.builder[o] || '');
    });

    return builder.join(delimiter || '&');
};

// ======================================================
// EXPORTS
// ======================================================

exports.ErrorBuilder = ErrorBuilder;
exports.Pagination = Pagination;
exports.UrlBuilder = UrlBuilder;