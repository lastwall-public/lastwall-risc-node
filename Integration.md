# ![Lastwall Logo](logo.png) Lastwall RISC Integration

Lastwall RISC authentication engine integration instructions and sample Node.js implementation. For API docs, please [click here](API.md).

## Overview

The Lastwall RISC platform allows your website to perform risk-based spot checks on a user's browsing session and verify his identity. You may perform RISC spot checks at any point during a user's browsing session. These spot checks will occur automatically and invisibly to your end users. For simplicity, this document will describe a typical integration where the RISC engine is used only once as a login supplement to enhance account security.

Integration with Lastwall RISC is a fairly straightforward process. The interaction flow goes like this:

1. The end user performs an action on your website that requires risk analysis, for example a login attempt (the most common use).
2. Instead of submitting the login request directly to your server, your web page should first launch an asynchronous client-side javascript (sample code below - see `loadRiscScript()` and `initLastwallRisc()`). This script will capture a comprehensive snapshot of the end-user's system and send it directly to the Lastwall RISC server. This snapshot will be immediately analyzed in detail by our risk engine to determine a risk score.
3. The Lastwall RISC server will respond to the client browser by triggering a finalization function call to `lastwallRiscFinished(result)`. You must define this function in the web page. The `result` parameter is an encrypted data blob containing the RISC analysis. This function should submit your user's login request to your web server as it would have worked originally, but it should also include the encrypted RISC data blob alongside the username and password.
4. Your backend server should use your private API secret to decrypt this blob and extract the RISC score and snapshot status. You may do this with one of the modules we provide (see our [Github page](https://github.com/lastwall-public)), or you can write your own based on our [example below](#decrypting-risc-snapshots). Either the numerical score or the status may be used to determine how to proceed with the login attempt. For ideas and examples, see the section below on evaluating RISC scores.
5. (optional) You may choose to validate the RISC score with an API call to `/validate` (sample code below - see `validateRisc()`). This will ensure the integrity of the RISC score blob, which could only be altered if a hacker got your API secret. If you are 100% certain your API secret is, and will remain, secure, then you can skip this step. For information on this API call, please read our [API documentation](API.md).


## RISC Result Format

The RISC snapshot result must be decrypted using your API secret before you can access the data within. Lastwall-provided modules all contain functions to handle this decryption for you. For information on the decryption process, or to write your own module, see the section on decryption at the bottom of this document.

The RISC snapshot result blob, when decryped, will result in a JSON-encoded string containing the following variables:

- **snapshot_id** - The unique snapshot ID
- **browser_id** - The unique ID for the user's web browser, as identified by the RISC server
- **date** - The exact time of the snapshot (Javascript-formatted ISO 8601 date string)
- **score** - The resulting RISC score (percentage from 0-100 - lower is safer)
- **status** - The snapshot status (string valued either 'passed', 'risky', or 'failed')

To make the `status` variable easier to use, all of our published modules automatically append three more variables when they decrypt RISC results:

- **passed** - A boolean value indicating whether (status == 'passed')
- **risky** - A boolean value indicating whether (status == 'risky')
- **failed** - A boolean value indicating whether (status == 'failed')

If you write your own module, we recommend using the same approach with the three booleans 'passed', 'risky', and 'failed'.


## Evaluating RISC Scores

During evaluation, you can use either the score, the status, or the three booleans to evaluate the snapshot and take appropriate action. How you use your RISC scores is entirely up to you, but we do recommend either of the following two standard practices as the most common uses of the RISC system:

- The most common usage would be to enforce a second-factor authentication on any RISC snapshot that isn't passed (ie. is risky or failed). You may use any second-factor authentication you like (eg. Google Authenticator). Our recommended option is the Lastwall SAVE platform, which allows for simple, integrated 2FA by email, phone, TOTP, and other more advanced options. SAVE is currently in invitation-only beta and will be publicly available in early 2016. Please contact us to sign up.
- Some customers may not wish to perform any RISC-specific actions, and will just use the RISC system to quietly collect risk-based user and login data. If this is your intention, you may choose to skip the integration into your server backend (steps 4-5 above). While this will simplify integration, you will not have access to real-time risk data to evaluate logins. However, you will still be able to use the RISC web portal to view statistics on failed sessions and risky user accounts.

Some other example actions to take on risky or failed snapshots may be: email to administrator, automatic logout, limited login, or redirect to a honeypot. If you would like advice on recommended actions and their implementation, please contact our professional team at Lastwall - we're happy to help.


## Sample code

### Client-side Javascript and HTML

Snippet from `login.ejs` to run the client-side javascript (**step 2**):

```
var initLastwallRisc = function()
{
    // Get the username from the login form, and use it to construct the script URL.
    var username = document.getElementById('usernametext').value;
    // Pull the base RISC url from an EJS variable and append the username to get the full script URL.
    var script_url = '<%= risc_url %>' + encodeURIComponent(username);
    // The risc_url varible should look like this:   https://risc.lastwall.com/risc/script/API_TOKEN
    // The final script url will look like this:     https://risc.lastwall.com/risc/script/API_TOKEN/USER_ID
    loadRiscScript(script_url);
}
```

```
var loadRiscScript = function(script_url)
{
    var scr = document.createElement('script');
    scr.setAttribute('async', 'true');
    scr.type = 'text/javascript';
    scr.src = script_url;
    ((document.getElementsByTagName('head') || [null])[0] ||
    document.getElementsByTagName('script')[0].parentNode).appendChild(scr);
}
```

Submit the hidden login form on RISC completion, also in `login.ejs` (**step 3**):

```
var lastwallRiscFinished = function(result)
{
    // Copy the username and password from the user-typed login form to the hidden one
    document.getElementById('username').value = document.getElementById('usernametext').value;
    document.getElementById('password').value = document.getElementById('passwordtext').value;
    // Include the encrypted RISC result, then submit the hidden form
    document.getElementById('riscdata').value = result;
    document.getElementById('hiddenform').submit();
}
```

```
<!-- EXAMPLE: original login form has its action changed to call Javascript:initLastwallRisc() -->
<form id="loginform" action="Javascript:initLastwallRisc()">
...
<!-- new hidden login form calls the original POST to /login -->
<form id="hiddenform" action="/login" method="post">
    <input type="hidden" id="username" name="username"/>
    <input type="hidden" id="password" name="password"/>
    <input type="hidden" id="riscdata" name="riscdata"/>
</form>
```


### Server-side Node.js examples

The following snippets show the most important sections of a sample Node.js passport-based authentication site, integrated with Lastwall RISC.

First, import the NPM module (replace with your own API token and secret):

```
var riscOptions =
{
    token : 'LWK150D380544E303C57E57036F628DA2195FDFEE3DE404F4AA4D7D5397D5D35010',
    secret : '2B60355A24C907761DA3B09C7B8794C7F9B8BE1D70D2488C36CAF85E37DB2C',
    verbose: true
}
var RiscAccessor = require('lastwall-risc-node')(riscOptions);
```


After a successful username/password check, the RISC snapshot is decrypted and evaluated before allowing the user to continue (**steps 4/5**):

```
// Run the basic passport authentication to validate the username/password. Then proceed to evaluate the RISC result via the function postLogin().
app.post('/login', passport.authenticate('local'), postLogin);
...
var postLogin = function(req, res, next)
{
    var onError = function(msg)
    {
        // Here, the snapshot has been modified somehow (this should be incredibly rare). Unless this is a 500 error, your API secret has been compromised!
        // TODO: notify the site administrator that his API secret isn't safe! He must generate a new API key using the Lastwall RISC portal.
        console.log('Error validating snapshot: ' + msg);
        // Force a user logout if the snapshot has been illegally modified.
        req.logout();
        res.redirect('/login');
    }
    var onOk = function(result)
    {
        if (result.failed)
        {
            // Here, the user has failed the RISC analysis. In this simple example, we will just automatically log him out.
            // In a production environment, a better response might be to enforce a second-factor authentication or to make an internal note of the high-risk user.
            console.log('Risc score: ' + result.score + '. Logging user out...');
            req.logout();
            res.redirect('/login');
        }
        else if (result.risky || result.passed)
        {
            // The user did not explicitly fail the RISC analysis (althought he may have been deemed 'risky'). In this example, we let him proceed to his account page.
            console.log('Risc score: ' + result.score + '. User validated.');
            res.redirect('/account');
        }
    }
    // Get the encrypted RISC snapshot from the submitted form (req.body.riscdata), and decrypt it.
    var result = RiscAccessor.decryptSnapshot(req.body.riscdata);
    // Call the RISC API /validate to ensure the snapshot is valid
    RiscAccessor.validateSnapshot(result, onOk, onError);
}
```


## Decrypting RISC Snapshots

The RISC snapshot result blob is a JSON-encoded string containing the following variables:

- **ix** - Numerical index into your API secret (range 0-63). The 32 hex characters starting from this index generate the AES128 secret used to encode the data (NOTE: for indices greater than 32, we treat the API secret as a circular string).
- **iv** - The randomly-generated AES128 initialization vector for this result (hex string)
- **data** - Base64-encoded string containing the encrypted result data

The `data` parameter is an AES128-CBC-encrypted string containing the snapshot result data. We provide modules in several languages that contain a decrypt function for this blob. If you choose to write your own, you can start with our Node.js version as a reference:

```
var decryptSnapshot = function(api_secret, riscstring)
{
    // JSON parsing the RISC string should yield an object with the 'ix', 'iv', and 'data' values.
    var result = JSON.parse(riscstring);
    try
    {
        // Compute the decryption secret key as a 32-character substring of the API secret starting with index 'ix'.
        // NOTE: we do the substring of (api_secret + api_secret) in order to simulate the API secret as a circular buffer.
        var dec_secret = (api_secret + api_secret).substr(result.ix, 32);
        // Create the AES128-CBC decipher with the secret key and initialization vector 'iv'
        var decipher = crypto.createDecipheriv('aes-128-cbc', new Buffer(dec_secret, 'hex'), new Buffer(result.iv, 'hex'));
        // Pump the base-64 encoded data into the decipher to decrypt it.
        var dec = decipher.update(result.data, 'base64', 'utf8');
        dec += decipher.final('utf8');
        // JSON-parse the decrypted string, verify its integrity, and return the result.
        var snapshot = JSON.parse(dec);
        return verifySnapshot(snapshot);
    }
    catch (e)
    {
        console.log('Unable to decrypt snapshot data: ' + e);
        return null;
    }
}
```

```
var verifySnapshot = function(snapshot)
{
    // Make sure the snapshot date is accurate within 10 minutes
    var datediff = Math.abs(new Date(snapshot.date) - new Date()) / 1000;
    if (datediff > 600)
    {
        console.log('Result is too far out of date.');
        return null;
    }
    // Include the three status booleans for convenience
    snapshot.risky = (snapshot.status == 'risky');
    snapshot.passed = (snapshot.status == 'passed');
    snapshot.failed = (snapshot.status == 'failed');
    return snapshot;
}
```
