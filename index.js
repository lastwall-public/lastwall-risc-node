var crypto = require('crypto');
var https = require('https');
var http = require('http');
var qs = require('qs');


module.exports = function(opts)
{
    return new RiscAccessor(opts);
}


var RiscAccessor = function(opts)
{
	this.token = opts.token;
	this.secret = opts.secret;

	if (!this.token)
		return output.error('No API token specified');
	if (!this.secret)
		return output.error('No API secret specified');

	this.http_basic_auth = (opts.http_basic_auth == true) ? true : false; // default to false
	this.verbose = (opts.verbose == true) ? true : false; // default to false
	this.use_https = (opts.https == false) ? false : true; // default to true

	this.host = opts.host || 'risc.lastwall.com';
	this.port = opts.port || (this.use_https ? 443 : 80);

	this.timeout = opts.timeout || 5000;

	this.output = {
		red: '\033[31m',
		yellow: '\033[33m',
		green: '\033[32m',
		white: '\033[37m',
		reset: '\033[0m',
		bold: '\033[1m',

		info: function(s)
		{
			console.log(this.white + this.bold + s + this.reset);
		},

		success: function(s)
		{
			console.log(this.green + this.bold + s + this.reset);
		},

		warn: function(s)
		{
			console.log(this.yellow + this.bold + s + this.reset);
		},

		error: function(s)
		{
			console.log(this.red + this.bold + s + this.reset);
		}
	}

	if (opts.output && opts.output.info && opts.output.error && opts.output.success && opts.output.warn)
	{
		this.output = opts.output;
	}

	this.isInitialized = true;
}


RiscAccessor.prototype.createUser = function(user_id, email, phone, options, onOk, onError)
{
	if (!user_id)
		onError('No user ID specified');
	if (!email)
		onError('No email address specified');
	if (!phone)
		onError('No phone number specified');
	else
	{
		var params = {
			'user_id' : user_id,
			'email' : email,
			'phone' : phone
		};
		if (options)
		{
			if (options.name)
				params['name'] = options.name;
		}
		this.rest('api/users', 'post', params, onOk, onError);
	}
}


RiscAccessor.prototype.verifyApiKey = function(onOk, onError)
{
	this.rest('api/verify', 'get', {}, onOk, onError);
}


RiscAccessor.prototype.getUser = function(user_id, onOk, onError)
{
	if (!user_id)
		onError('No user ID specified');
	else
	{
		var params = { 'user_id' : user_id };
		this.rest('api/users', 'get', params, onOk, onError);
	}
}


RiscAccessor.prototype.modifyUser = function(user_id, options, onOk, onError)
{
	if (!user_id)
		onError('No user ID specified');
	else if (!options)
		onError('No user options specified');
	else
	{
		var params = { 'user_id' : user_id };
		if (options)
		{
			if (options.email)
				params['email'] = options.email;
			if (options.phone)
				params['phone'] = options.phone;
			if (options.name)
				params['name'] = options.name;
		}
		this.rest('api/users', 'put', params, onOk, onError);
	}
}


RiscAccessor.prototype.deleteUser = function(user_id, onOk, onError)
{
	if (!user_id)
		onError('No user ID specified');
	else
	{
		var params = { 'user_id' : user_id };
		this.rest('api/users', 'delete', params, onOk, onError);
	}
}


RiscAccessor.prototype.createSession = function(user_id, onOk, onError)
{
	if (!user_id)
		onError('No user ID specified');
	else
	{
		var params = { 'user_id' : user_id };
		this.rest('api/sessions', 'post', params, onOk, onError);
	}
}


RiscAccessor.prototype.getSession = function(session_id, onOk, onError)
{
	if (!session_id)
		onError('No session ID specified');
	else
	{
		var params = { 'session_id' : session_id };
		this.rest('api/sessions', 'get', params, onOk, onError);
	}
}


RiscAccessor.prototype.rest = function(functionName, method, params, onOk, onError)
{
	var verbose = this.verbose;
	var that = this;
	var host = this.host;
	var port = this.port;

	if (!this.isInitialized)
	{
		onError('Lastwall API Accessor has not been initialized!');
		return;
	}
	if (!params)
	{
		onError('No request parameters specified!');
		return;
	}

	var getUrl = function()
	{
		var protocol = that.use_https ? 'https' : 'http';
		return protocol + '://' + host + ':' + port + '/';
	}

	var getKeys = function(obj)
	{
		var keys = [];
		for (var i in obj)
		{
			if (obj.hasOwnProperty(i))
				keys.push(i);
		}
		return keys;
	};

	var createGuid = function()
	{
		// Try to create a crypto-secure random guid
		try {
			var buf = crypto.randomBytes(16);
			var i = 0;
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r;
				if (i % 2 == 0)
					r = buf[i/2] % 16;
				else
					r = Math.floor(buf[(i-1)/2] / 16);
				var v = c === 'x' ? r : (r&0x3|0x8);
				i++;
				return v.toString(16);
			});
		// If that fails, use Math.random()
		} catch (ex) {
			if (verbose)
				this.output.error('Error generating crypto-secure random guid. Resorting to pseudo-random: ' + ex);

			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16|0, v = c === 'x' ? r : (r&0x3|0x8);
				return v.toString(16);
			});
		}
	}

	var headers = {};
	var path = functionName;
	if (path[0] != '/')
		path = '/' + path;
	var url = getUrl() + functionName;
	var securityModel = 'basic';

	if (this.http_basic_auth)
	{
		var authString = 'Basic ' + new Buffer(this.token + ':' + this.secret).toString('base64');

		headers = {
			'Authorization' : authString,
			'Content-Type'  : 'application/x-www-form-urlencoded',
		};
	}
	else
	{
		securityModel = 'digest';

		var request_id = createGuid();
		var timestamp = Math.floor((new Date()).getTime() / 1000).toString();

		var hmac = crypto.createHmac('sha1', this.secret);
		var hash_str = url + request_id + timestamp;
		hmac.update(hash_str);
		var signature = hmac.digest('base64');

		headers = {
			'Content-Type'    : 'application/x-www-form-urlencoded',
			'X-Lastwall-Token'      : this.token,
			'X-Lastwall-Timestamp'  : timestamp,
			'X-Lastwall-Request-Id' : request_id,
			'X-Lastwall-Signature'  : signature
		};
	}

	if (verbose)
	{
		this.output.info('Calling \'' + method + ' ' + url + '\' (' + securityModel + '), params: ' + getKeys(params));
	}

	var callback = function(response)
	{
		var body = '';
		response.on('data', function(data) {
			body += data;
		});
		response.on('end', function() {
			var code = response.statusCode;
			var mess = 'Received API response for \'' + method + ' ' + url + '\': response code ' + code;

			if (code >= 200 && code < 400)
			{
				if (verbose)
					that.output.success(mess);

				var result = JSON.parse(body);
				onOk(result);
			}
			else
			{
				var error;
				try
				{
					var result = JSON.parse(body);
					error = result.error;
				}
				catch (e)
				{
					error = body;
				}

				if (verbose)
					that.output.error(mess + ', error: ' + error);
				onError(code + ': ' + error, code);
			}
		});
	};

	var reqBody = qs.stringify(params);
	headers['Content-Length'] = reqBody.length;

	var options = {
		host : host,
		port : port,
		path : '/' + functionName,
		method : method,
		headers : headers
	}

	var request;
	if (that.use_https)
		request = https.request(options, callback);
	else
		request = http.request(options, callback);

	var didTimeout = false;
	request.on('socket', function (socket) {
		socket.setTimeout(that.timeout);
		socket.on('timeout', function() {
			var mess = 'HTTP request \'' + method + ' ' + url + '\' timed out';
			if (verbose)
				that.output.error(mess);
			didTimeout = true;
			request.abort();
			onError(mess);
		});
	});

	request.on('error', function(e) {
		if (didTimeout)
			return;
		var mess = 'Error calling API \'' + method + ' ' + url + '\': ' + e.message;
		if (verbose)
			that.output.error(mess);
		onError(mess);
	});

	if (params)
		request.write(reqBody);
	request.end();
};
