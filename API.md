# ![Lastwall Logo](logo.png) Lastwall RISC API

Lastwall risk-based authentication API

## Overview

This document describes the bare-bones API. For integration documentation, please [click here](Integration.md).


## API Calls

All API calls should be prefixed with the following address: `https://risc.lastwall.com/api/`. For example, to perform a GET on `/sessions`, you would use the following URL: `https://risc.lastwall.com/api/sessions`

Parameters for all API calls (GET, PUT, POST, and DELETE) should be included as JSON in the message body. For GET requests, parameters may be included either in the request URL or in the message body.

NOTE: remember to set the **Content-Type** request header to **application/json** to indicate a JSON-formatted message body.    


## API Security

We offer two security models for API requests: Basic (simple) and Digest (more secure). If your goal is to simplify and speed up the integration process, we recommend basic authentication. For enhanced security, we recommend the digest model. You may enable either security model, or both, in your service settings.

Both models require a two-part API key: a public token and a private, secret key. Your private key must be stored in a secure environment, as it is used to ensure the identity of our customers during API requests. Do NOT share or publish your private key!

If you do not have an API key, please visit the [Lastwall website](http://www.lastwall.com/) to request one.


### HTTP Basic Authentication

Lastwall API calls using basic authentication must be sent with the following request header:    

- **Authorization** - a standard HTTP Basic Authentication header    

To construct the header value, take your API public token and secret key, and treat them as a user name and password using standard HTTP basic auth.    

Example: lets say your API public token is "**test**" and your secret key is "**secret**". Then the header value is the base-64 encoding of the string "**test:secret**", preceded by the word "**Basic**" and a separating space. This results in the following header value: "**Basic dGVzdDpzZWNyZXQ=**"    

For more information on HTTP Basic Authentication, see [Basic Authenticaion](http://www.httpwatch.com/httpgallery/authentication/)


### Digest Authentication

Lastwall API calls using digest authentication must be sent with the following request headers:

- **X-Lastwall-Token** - The public token part of the API key    
- **X-Lastwall-Timestamp** - The time at which the request was sent. Must match the Lastwall server time within 5 minutes    
- **X-Lastwall-Request-Id** - A unique ID representing this request. Can be any globally-unique string (eg. a random UUID)    
- **X-Lastwall-Signature** - The request signature, described below    

The request signature is calculated in the following way:    

 1. Take the full URL of the request, excluding any parameters (eg. `https://risc.lastwall.com/api/sessions`)     
 2. Append the request timestamp to the URL string    
 3. Append the unique request ID to the resulting string    
 4. Sign the resulting string with an HMAC-SHA1 using your private api key    

Our server will use the public token and request signature to confirm that you are authorized to use this service. The exact timestamp and request ID must be provided so that we can create the same signature on the server and verify authenticity.

For examples and sample code, please see our [helper libraries](http://www.github.com/lastwall-public)    


## API Return Values

All Lastwall API calls will return one of the following status codes:

- **200** - OK: the API call was successful
- **400** - Error: the API call failed due to invalid input or caller error
- **401** - Authorization Error: the API call failed due to an API key authentication failure
- **500** - Fatal: the API call failed due to an internal Lastwall system error (not your fault)

For all successful API calls (code 200), the relevant response data will be returned as JSON in the message body. If there is no data to return, the result will be:

`{ "status": "OK" }`

For all failed API calls (codes 400, 401, or 500), the result will be:

`{ "status": "Error", "error": "(specific error message)" }`



---------------------------------------

## GET - /validate

Validates a decrypted RISC score to ensure it hasn't been modified. This provides optional extra protection against the risk of your API secret being compromised.


#### Required Parameters
- **snapshot_id** - The unique snapshot ID
- **browser_id** - The unique browser ID
- **date** - The Javascript-formatted (ISO 8601) date/time of the session
- **score** - The resulting RISC score
- **status** - The snapshot status - passed, risky, or failed


#### Return Values

- **status** - String 'OK' or 'Error'. If it's an error, the specific message is included in the 'error' return value.
- **error** - Undefined or specific error message.


### Examples

**Request:** `curl -X POST -H "(headers)" "https://risc.lastwall.com/api/validate" -d '{"snapshot_id":"(some guid)", "score":...}'"`    

**Response:** `HTTP/1.1 200 OK`    `{ "status": "OK" }`

---------------------------------------
