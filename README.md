# ![Lastwall Logo](logo.png) Lastwall RISC Node.js Module

Lastwall risk-based authentication module for Node.js

## Overview

The Lastwall RISC platform allows your website to perform risk-based spot checks on a user's browsing session and verify his identity. You may perform RISC spot checks at any point during a user's browsing session. These spot checks will occur automatically and invisibly to your end users.

This document provides pseudo-code to describe our Node.js integration module.

Before reading this document, please read our general [integratrion documentation](Integration.md).

For bare-bones API documentation, please [click here](API.md).


## Initialization

First, import our NPM module `lastwall-risc-node`, then initialize it, filling in your own token/secret here:

```
var riscOptions =
{
    token: 'LWK150D380544E303C57E57036F628DA2195FDFEE3DE404F4AA4D7D5397D5D35010',  // replace with your own token
    secret: '2B60355A24C907761DA3B09C7B8794C7F9B8BE1D70D2488C36CAF85E37DB2C',     // replace with your own secret
    verbose: true             // prints API results to the console
}
var RiscAccessor = require('lastwall-risc-node')(riscOptions);
```


## Verify API Key

Not really necessary, but good for peace of mind.

```
var onOk = function()
{
    console.log('API key verified!');
}
var onError = function(err)
{
    console.log('API key not verified: ' + err);
}
RiscAccessor.Verify(onOk, onError);
```


## Get URL for RISC Script

Our javascript requires both a public API token and a user ID in the URL. The specific format is `https://risc.lastwall.com/risc/script/API_TOKEN/USER_ID`. To construct this URL, we provide a convenient shortcut function in our Node module. You can do it like this:

```
// (SERVER-SIDE) Get the base url for the script. This string still needs the username appended to the end.
var base_url = RiscAccessor.getScriptUrl();
// base_url looks like this: https://risc.lastwall.com/risc/script/API_TOKEN/
```

```
// (CLIENT-SIDE) Username can be appended on the client side, if it is available.
var complete_url = '<%= base_url %>' + encodeURIComponent(username);
// complete_url looks like this: https://risc.lastwall.com/risc/script/API_TOKEN/USER_ID
loadRiscScript(complete_url);
```

NOTE: when you append the username to the URL, don't forget to URI-encode it!


## Decrypt Snapshot

An encrypted snapshot is obtained by the client browser by running the asynchronous RISC javascript. This encrypted blob (which is just a string) must be passed to your server somehow (typically via hidden form submission). Only your server can decrypt it, using your API secret.

```
// encr_snapshot is the Lastwall encrypted snapshot
var result = RiscAccessor.decryptSnapshot(encr_snapshot);
if (result)
{
    console.log('RISC session ended with score ' + result.score + ', status: ' + result.status);
}
else
{
    // If there was an error decrypting, result will be null - this should never happen in production.
    // TODO: throw some kind of backend hissyfit. Log errors or something?
}
```


## Validate Snapshot (optional, recommended)

The `validate` API call will compare your decrypted RISC snapshot result against the one saved in the Lastwall database. They should be identical. If they aren't, the only explanation is that a hacker has decrypted the result client-side, modified it, then re-encrypted it before sending it to your server. This is only possible if he has access to your API secret, or the computing power of an array of super computers stretching from here to Saturn.

```
// Decrypt the snapshot first, then validate it by API call to Lastwall
var result = RiscAccessor.decryptSnapshot(req.body.riscdata);
if (result)
{
    var onError = function(msg)
    {
        // Snapshot is invalid. This is bad news - it means your API secret likely isn't a secret, and a hacker is logging in.
        console.log('Error validating snapshot: ' + msg);
        // TODO: Panic. Call the admins. Then go to the RISC admin console and generate a new API key.
    }
    var onOk = function(result)
    {
        // Snapshot is valid. Lets use the result.
        if (result.failed)
        {
            // User failed the RISC session. We can force a logout here, or do something fancier like track the user.
            console.log('Risc score: ' + result.score + '. Logging user out...');
            // TODO: force logout
        }
        else if (result.risky)
        {
            // User passed the RISC session but not by much.
            console.log('Risc score: ' + result.score + '. User validated.');
            // TODO: redirect user to main site
        }
        else if (result.passed)
        {
            // User passed the RISC session with no issues.
            console.log('Risc score: ' + result.score + '. User validated.');
            // TODO: redirect user to main site
        }
        else
        {
            // NO-MAN's land. This code should never be reached - all RISC results are either risky, passed or failed.
        }
    }
    RiscAccessor.validateSnapshot(result, onOk, onError);
}
```


## Pre-authenticate User for a Specific Browser (optional)

The `preauth` API call can be used when a user has a high RISC score on a particular browser, but you are certain it is the correct user. This API call will effectively set the RISC score back to 0% the next time the user does a RISC snapshot from that specific browser. This can be used in a variety of scenarios, the most common being after you have performed a successful second-factor authentication for that user, and you want his next RISC snapshot to be successful.

You will need a valid user ID and browser ID to call this API function. The browser ID will be contained in the most recent RISC snapshot result.

```
var onOk = function()
{
    console.log('User is pre-authed. His next login will yield a 0% RISC score.');
}
var onError = function(err)
{
    console.log('Error pre-authing user: ' + err);
}
RiscAccessor.preAuthenticateUser(user_id, browser_id, onOk, onError);
```


## Email-based Second Factor Authentication (optional)

The `save_email` API call can be used to force an email-based second factor authentication when a user has a high RISC score on a particular browser. The goal is to verify a user's identity by ensuring he has access to the specified email account. An email will be sent to the specified address with a one-time unlock link. If the user logs into his email and clicks the unlock link, his RISC score will be set back to 0% the next time he does a RISC snapshot from the specified browser. This API call is typically used after a risky or failed RISC snapshot, in order to allow the user a chance to recover access from that browser.

You will need a valid user ID and browser ID to call this API function. The browser ID will be contained in the most recent RISC snapshot result. You may optionally specify the email address to use. If you don't specify one, we will try to use the one stored in the RISC user account (if there is one).

```
var onOk = function()
{
    console.log('An authentication email has been sent. The user should be instructed to check his email to recover access.');
}
var onError = function(err)
{
    console.log('Error email-authing user: ' + err);
}
RiscAccessor.emailAuthenticateUser(user_id, browser_id, user_email, onOk, onError);
```
