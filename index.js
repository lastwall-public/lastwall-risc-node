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

	if (!this.token)
		return this.output.error('No API token specified');
	if (!this.secret)
		return this.output.error('No API secret specified');

	this.http_basic_auth = (opts.http_basic_auth == true) ? true : false; // default to false
	this.verbose = (opts.verbose == true) ? true : false; // default to false
	this.use_https = (opts.https == false) ? false : true; // default to true

	this.host = opts.host || 'risc.lastwall.com';
	this.port = opts.port || (this.use_https ? 443 : 80);

	this.timeout = opts.timeout || 5000;

	if (opts.output && opts.output.info && opts.output.error && opts.output.success && opts.output.warn)
	{
		this.output = opts.output;
	}

	this.isInitialized = true;
}


RiscAccessor.prototype.verifyApiKey = function(onOk, onError)
{
	this.rest('api/verify', 'get', {}, onOk, onError);
}


RiscAccessor.prototype.createUser = function(user_id, user_name, email, phone, onOk, onError)
{
	if (!user_id)
		onError('No user ID specified');
	else if (!email)
		onError('No email address specified');
	else
	{
		var params = {
			'user_id' : user_id,
			'name': user_name,
			'email' : email,
			'phone' : phone
		};
		this.rest('api/users', 'post', params, onOk, onError);
	}
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


RiscAccessor.prototype.rest = function(functionName, method, reqParams, onOk, onError)
{
	var verbose = this.verbose;
	var that = this;
	var host = this.host;
	var port = this.port;

	if (!this.isInitialized)
	{
		this.output.error('Lastwall API Accessor has not been initialized!');
		return;
	}
	if (!reqParams)
	{
		onError('No request parameters specified!');
		return;
	}

	var getUrl = function()
	{
		var protocol = that.use_https ? 'https' : 'http';
		return protocol + '://' + host + '/';
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
		} catch (ex) {
			if (verbose)
				this.output.error('Error generating crypto-secure random guid. Resorting to pseudo-random: ' + ex);

			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16|0, v = c === 'x' ? r : (r&0x3|0x8);
				return v.toString(16);
			});
		}
	}

	var reqBody = '';
	var headers = {};
	var path = functionName;
	if (path[0] != '/')
		path = '/' + path;
	var url = getUrl() + functionName;

	if (this.http_basic_auth)
	{
		var authString = 'Basic ' + new Buffer(this.token + ':' + this.secret).toString('base64');

		outputString = 'insecure), params: ' + getKeys(reqParams);

		reqBody = qs.stringify(reqParams);
		headers = {
			'Authorization' : authString,
			'Content-Type'  : 'application/x-www-form-urlencoded',
			'Content-Length': reqBody.length
		};
	}
	else
	{
		if (!reqParams)
			reqParams = {};

		var alg = 'sha1';
		var request_id = createGuid();
		var timestamp = Math.floor((new Date()).getTime() / 1000).toString();

		var hmac = crypto.createHmac(alg, this.secret);
		var hash_str = url + request_id + timestamp;
		hmac.update(hash_str);
		var hash = hmac.digest('base64');

		outputString = 'secure), params: ' + getKeys(reqParams);

		reqBody = qs.stringify(reqParams);
		headers = {
			'Content-Type'    : 'application/x-www-form-urlencoded',
			'Content-Length'  : reqBody.length,
			'X-Lastwall-Token'      : this.token,
			'X-Lastwall-Timestamp'  : timestamp,
			'X-Lastwall-Request-Id' : request_id,
			'X-Lastwall-Signature'  : hash
		};
	}

	if (verbose)
	{
		this.output.info('Calling \'' + method + ' ' + url + '\' (' + outputString);
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

			if (code >= 200 && code < 300)
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
				onError(code + ': ' + error);
			}
		});
	};

	var request;
	if (this.use_https)
	{
		var options = {
			host : host,
			port : port,
			path : '/' + functionName,
			method : method,
			headers : headers,
			rejectUnauthorized: false,
			requestCert: true,
			agent: false
		}

		request = https.request(options, callback);
	}
	else
	{
		var options = {
			host : host,
			port : port,
			path : '/' + functionName,
			method : method,
			headers : headers
		}

		request = http.request(options, callback);
	}

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

	if (reqParams)
		request.write(reqBody);
	request.end();
};
