// https://github.com/yinonavraham/GoogleAppsScripts/tree/master/EnhancedCacheService
/**
 * Enhanced cache - wraps a native Cache object and provides additional features.
 * @param {Cache} cache the cache to enhance
 * @constructor
 */
class EnhancedCache {
  constructor(cache) {

    var cache_ = cache;

    //### PUBLIC Cache methods ###
    /**
    * Put a string value in the cache
    * @param {string} key
    * @param {string} value
    * @param {number} ttl (optional) time-to-live in seconds for the key:value pair in the cache
    */
    this.put = function (key, value, ttl) {
      this.putString(key, value, ttl);
    };

    /**
    * Get a string value from the cache
    * @param {string} key
    * @return {string} The string value, or null if none is found
    */
    this.get = function (key) {
      return this.getString(key);
    };

    /**
    * Removes an entry from the cache using the given key.
    * @param {string} key
    */
    this.remove = function (key) {
      var valueDescriptor = getValueDescriptor(key);
      if (valueDescriptor.keys) {
        for (var i = 0; i < valueDescriptor.keys.length; i++) {
          var k = valueDescriptor.keys[i];
          remove_(k);
        }
      }
      remove_(key);
    };

    //### PUBLIC EnhancedCache methods ###
    /**
    * Put a string value in the cache
    * @param {string} key
    * @param {string} value
    * @param {number} ttl (optional) time-to-live in seconds for the key:value pair in the cache
    */
    this.putString = function (key, value, ttl) {
      var type = 'string';
      ensureValueType(value, type);
      putValue(key, value, type, ttl);
    };

    /**
    * Get a string value from the cache
    * @param {string} key
    * @return {string} The string value, or null if none is found
    */
    this.getString = function (key) {
      var value = getValue(key, 'string');
      return value;
    };

    /**
    * Put a numeric value in the cache
    * @param {string} key
    * @param {number} value
    * @param {number} ttl (optional) time-to-live in seconds for the key:value pair in the cache
    */
    this.putNumber = function (key, value, ttl) {
      var type = 'number';
      ensureValueType(value, type);
      putValue(key, value, type, ttl);
    };

    /**
    * Get a numeric value from the cache
    * @param {string} key
    * @return {number} The numeric value, or null if none is found
    */
    this.getNumber = function (key) {
      var value = getValue(key, 'number');
      return value;
    };

    /**
    * Put a boolean value in the cache
    * @param {string} key
    * @param {boolean} value
    * @param {number} ttl (optional) time-to-live in seconds for the key:value pair in the cache
    */
    this.putBoolean = function (key, value, ttl) {
      var type = 'boolean';
      ensureValueType(value, type);
      putValue(key, value, type, ttl);
    };

    /**
    * Get a boolean value from the cache
    * @param {string} key
    * @return {boolean} The boolean value, or null if none is found
    */
    this.getBoolean = function (key) {
      var value = getValue(key, 'boolean');
      return value;
    };

    /**
    * Put an object in the cache
    * @param {string} key
    * @param {string} value
    * @param {number} ttl (optional) time-to-live in seconds for the key:value pair in the cache
    * @param {function(object)} stringify (optional) function to use for converting the object to string. If not specified, JSON's stringify function is used:
    * <pre>stringify = function(obj) { return JSON.stringify(obj); };</pre>
    */
    this.putObject = function (key, value, ttl, stringify) {
      stringify = stringify || JSON.stringify;
      var type = 'object';
      ensureValueType(value, type);
      var sValue = value === null ? null : stringify(value);
      putValue(key, sValue, type, ttl);
    };

    /**
    * Get an object from the cache
    * @param {string} key
    * @param {function(string)} parse (optional) function to use for converting the string to an object. If not specified, JSON's parse function is used:
    * <pre>parse = function(text) { return JSON.parse(text); };</pre>
    * @return {object} The object, or null if none is found
    */
    this.getObject = function (key, parse) {
      parse = parse || JSON.parse;
      var sValue = getValue(key, 'object');
      var value = sValue === null ? null : parse(sValue);
      return value;
    };

    /**
    * Get the date an entry was last updated
    * @param {string} key
    * @return {Date} the date the entry was last updated, or null if no such key exists
    */
    this.getLastUpdated = function (key) {
      var valueDescriptor = getValueDescriptor(key);
      return valueDescriptor === null ? null : new Date(valueDescriptor.time);
    };

    // ### PRIVATE ###
    function ensureValueType(value, type) {
      if (value !== null) {
        var actualType = typeof value;
        if (actualType !== type) {
          throw new Error(Utilities.formatString('Value type mismatch. Expected: %s, Actual: %s', type, actualType));
        }
      }
    }

    function ensureKeyType(key) {
      if (typeof key !== 'string') {
        throw new Error('Key must be a string value');
      }
    }

    function createValueDescriptor(value, type, ttl) {
      return {
        value: value,
        type: type,
        ttl: ttl,
        time: (new Date()).getTime()
      };
    }

    function putValue(key, value, type, ttl) {
      ensureKeyType(key);
      var valueDescriptor = createValueDescriptor(value, type, ttl);
      splitLargeValue(key, valueDescriptor);
      var sValueDescriptor = JSON.stringify(valueDescriptor);
      put_(key, sValueDescriptor, ttl);
    }

    function put_(key, value, ttl) {
      if (ttl) {
        cache_.put(key, value, ttl);
      } else {
        cache_.put(key, value);
      }
    }

    function get_(key) {
      return cache_.get(key);
    }

    function remove_(key) {
      return cache_.remove(key);
    }

    function getValueDescriptor(key) {
      ensureKeyType(key);
      var sValueDescriptor = get_(key);
      var valueDescriptor = sValueDescriptor === null ? null : JSON.parse(sValueDescriptor);
      return valueDescriptor;
    }

    function getValue(key, type) {
      var valueDescriptor = getValueDescriptor(key);
      if (valueDescriptor === null) {
        return null;
      }
      if (type !== valueDescriptor.type) {
        throw new Error(Utilities.formatString('Value type mismatch. Expected: %s, Actual: %s', type, valueDescriptor.type));
      }
      mergeLargeValue(valueDescriptor);
      return valueDescriptor.value;
    }

    function mergeLargeValue(valueDescriptor) {
      //If the value descriptor has 'keys' instead of 'value' - collect the values from the keys and populate the value
      if (valueDescriptor.keys) {
        var value = '';
        for (var i = 0; i < valueDescriptor.keys.length; i++) {
          var k = valueDescriptor.keys[i];
          var v = get_(k);
          value += v;
        }
        valueDescriptor.value = value;
        valueDescriptor.keys = undefined;
      }
    }

    function splitLargeValue(key, valueDescriptor) {
      //Max cached value size: 128KB
      //According the ECMA-262 3rd Edition Specification, each character represents a single 16-bit unit of UTF-16 text
      var DESCRIPTOR_MARGIN = 2000;
      var MAX_STR_LENGTH = (128 * 1024 / 2) - DESCRIPTOR_MARGIN;
      //If the 'value' in the descriptor is a long string - split it and put in different keys, add the 'keys' to the descriptor
      var value = valueDescriptor.value;
      if (value !== null && typeof value === 'string' && value.length > MAX_STR_LENGTH) {
        Logger.log('Splitting string value of length: ' + value.length);
        var keys = [];
        do {
          var k = '$$$' + key + keys.length;
          var v = value.substring(0, MAX_STR_LENGTH);
          value = value.substring(MAX_STR_LENGTH);
          keys.push(k);
          put_(k, v, valueDescriptor.ttl);
        } while (value.length > 0);
        valueDescriptor.value = undefined;
        valueDescriptor.keys = keys;
      }
      //TODO Maintain previous split values when putting new value in an existing key
    }
  }
}