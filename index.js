/*jslint node: true */
var request = require('request');
var util = require('util');

var MozError = exports.MozError = function(message) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'MozError';
  this.message = message;
};
MozError.fromResponse = function(incoming_message) {
  var moz_error = new MozError(incoming_message.body.error_message);
  moz_error.statusCode = incoming_message.statusCode;
  moz_error.body = incoming_message.body;
  moz_error.headers = incoming_message.headers;
  moz_error.request_method = incoming_message.request.method;
  moz_error.request_uri = incoming_message.request.uri.href;
  moz_error.request_headers = incoming_message.request.headers;
  Error.captureStackTrace(moz_error, arguments.callee);
  return moz_error;
};
MozError.prototype.toString = function() {
  return this.message;
};


/**
 * Translate an array of keys and an object lookup table
 * into a bit mask.
 */
function translateBitfield(columns, lookup) {
  var bits = 0;

  for (var key in columns) {
    if (lookup[columns[key]] !== undefined) {

      /*
       * javascript has a "documented bug" in that it will only
       * use the lower 32 bit of a number in binary OR operations.
       * Some of the bitfields in the Mozscape API have more than 32 bits.
       * Therefore we replace binary OR (|=) with addition (+=)
       * which has the same effect, except that it works. - yas4891
       */

      bits += lookup[columns[key]];
    }
  }

  return bits;
}

function serializeQuerystring(query) {
  var pairs = [];
  for (var key in query) {
    pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
  }
  return pairs.length > 0 ? '?' + pairs.join('&') : '';
}

var Client = exports.Client = function(access_id, secret_key) {
  this.hostname  = 'lsapi.seomoz.com';
  this.path = 'linkscape';
  this.userAgent = 'mozscape (https://github.com/chbrown/mozscape)';

  this.access_id = access_id;
  this.secret_key = secret_key;
};

/**
 * URL Metrics API
 *
 * http://apiwiki.moz.com/url-metrics
 */
Client.prototype.urlMetrics = function(url, cols, callback) {
  var apiPath = 'url-metrics/' + encodeURIComponent(url);
  var params = {
    Cols: translateBitfield(cols, URL_METRICS_FLAGS)
  };

  this.get(apiPath, params, callback);
};

/**
 * Links API
 *
 * http://apiwiki.moz.com/link-metrics
 */
Client.prototype.links = function(url, scope, options, callback) {
  var params = {
    Scope: scope
  };

  if (options.sort !== undefined) {
    params.Sort = options.sort;
  }

  if (options.filter !== undefined) {
    params.Filter = options.filter.join('+');
  }

  if (options.targetCols !== undefined) {
    params.TargetCols = translateBitfield(options.targetCols, URL_METRICS_FLAGS);
  }

  if (options.sourceCols !== undefined) {
    params.SourceCols = translateBitfield(options.sourceCols, URL_METRICS_FLAGS);
  }

  if (options.linkCols !== undefined) {
    params.LinkCols = translateBitfield(options.linkCols, LINK_FLAGS);
  }

  this.get('links/' + encodeURIComponent(url), params, callback);
};

/**
 * Anchor Text API
 *
 * http://apiwiki.moz.com/anchor-text-metrics
 */
Client.prototype.anchorText = function(url, scope, cols, callback) {
  var apiPath = 'anchor-text/' + encodeURIComponent(url);
  var params = {
    Scope: scope,
    Cols: translateBitfield(cols, ANCHOR_TEXT_FLAGS),
    Sort: 'domains_linking_page'
  };

  this.get(apiPath, params, callback);
};

/**
 * Top Pages API
 *
 * http://apiwiki.moz.com/top-pages
 */
Client.prototype.topPages = function(url, cols, options, callback) {
  var apiPath = 'top-pages/' + encodeURIComponent(url);
  var params = {
    Cols: translateBitfield(cols, URL_METRICS_FLAGS)
  };

  params.Offset = options.offset === undefined ? 0 : options.offset;
  params.Limit = options.limit === undefined? 1000 : options.limit;

  this.get(apiPath, params, callback);
};

/**
 * Metadata API
 * option: last_update, next_update, index_status
 * http://apiwiki.moz.com/metadata
 */
Client.prototype.metadata = function(option, callback) {
  this.get('metadata/' + option, {}, callback);
};

/**
 * Send request to the MOZ API
 */
Client.prototype.get = function(path, params, callback) {
  // console.log("Calling: %s", options.url);
  return request.get({
    url: 'http://' + this.hostname + '/' + this.path + '/' + path,
    qs: params,
    json: true,
    auth: {
      username: this.access_id,
      password: this.secret_key,
    },
    headers: {
      'User-Agent': this.userAgent,
      // 'Authorization': 'Basic ' + new Buffer(this.access_id + ':' + this.secret_key).toString('base64'),
      // 'Content-Length': 0
    }
  }, function(err, response, body) {
    if (err) {
      console.error('Encountered error', err);
      return callback(err);
    }
    if (response.statusCode != 200) {
      return callback(MozError.fromResponse(response));
    }

    callback(null, body);
  });
};

/**
 * URL Metrics Columns
 */
var URL_METRICS_FLAGS = exports.URL_METRICS_FLAGS = {
  'title'                         : 1,
  'url'                           : 4,
  'subdomain'                     : 8,
  'root_domain'                   : 16,
  'external_links'                : 32,
  'subdomain_external_links'      : 64,
  'domain_external_links'         : 128,
  'juice_passing_links'           : 256,
  'subdomains_linking'            : 512,
  'domains_linking'               : 1024,
  'links'                         : 2048,
  'subdomain_subs_linking'        : 4096,
  'domain_domains_linking'        : 8192,
  'mozRank'                       : 16384,
  'subdomain_mozRank'             : 32768,
  'domain_mozRank'                : 65536,
  'mozTrust'                      : 131072,
  'subdomain_mozTrust'            : 262144,
  'domain_mozTrust'               : 524288,
  'external_mozRank'              : 1048576,
  'subdomain_external_juice'      : 2097152,
  'domain_external_juice'         : 4194304,
  'subdomain_domain_juice'        : 8388608,
  'domain_domain_juice'           : 16777216,
  'canonical_url'                 : 268435456,
  'http_status'                   : 536870912,
  'subdomain_links'               : 4294967296,
  'domain_links'                  : 8589934592,
  'domains_linking_to_subdomain'  : 17179869184,
  'page_authority'                : 34359738368,
  'domain_authority'              : 68719476736
};

/**
 * Link Columns
 */
var LINK_FLAGS = exports.LINK_FLAGS = {
  'flags'                         : 2,
  'anchor_text'                   : 4,
  'moxRank_passed'                : 16
};

/**
 * Anchor Text Columns
 */
var ANCHOR_TEXT_FLAGS = exports.ANCHOR_TEXT_FLAGS = {
  'phrase'                        : 2,
  'internal_pages_linking'        : 8,
  'internal_subdomains_linking'   : 16,
  'external_pages_linking'        : 32,
  'external_subdomains_linking'   : 64,
  'external_domains_linking'      : 128,
  'internal_mozRank_passed'       : 256,
  'external_mozRank_passed'       : 512,
  'flags'                         : 1024
};
