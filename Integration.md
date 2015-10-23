# ![Lastwall Logo](logo.png) Lastwall RISC Integration

Lastwall RISC authentication engine integration instructions and sample Node.js implementation. For API docs, please [click here](README.md).

## Overview

The Lastwall RISC platform allows your website to perform risk-based spot checks on a user's browsing session and verify his identity. In a typical integration, a spot check will occur only once at login to validate a login session.

Integration with Lastwall RISC is a fairly straightforward process. The interaction flow goes like this:

1. The end user performs an action on your website that requires risk analysis, for example a login attempt (the most common use).
2. Your server receives the login request, and before responding to it, creates a Lastwall RISC session via a POST to `https://risc.lastwall.com/api/sessions`. The response from Lastwall will include a session URL pointing to a Lastwall-hosted javascript.
3. Your server returns a response to the user's login attempt that includes this javascript URL. How this URL is transmitted to the client browser is up to you. In the Node.js example below, the user is redirected to a new page called 'loginRisc', where the URL is passed through an EJS template.
4. The user's browser should take this javascript URL and load it via asynchronous HTTPRequest (sample code supplied below - see `initLastwallRisc()`).
5. When the script is completed and the risk score is evaluated, the client browser will trigger a finalization function call to `lastwallRiscFinished()`. You must define this function in the web page. This function should trigger a call back to your server, letting your server know that the RISC session has been completed (eg. using a hidden form submission - sample code supplied below).
6. Your server checks with Lastwall to see the results of the session via a GET request to `https://risc.lastwall.com/api/sessions`. The response from Lastwall will include a percentage-based risk score, a risk status value (one of 'Risky', 'Authenticated', or 'Failed'), and a boolean value indicating whether the user was authenticated. You can use any of these three metrics to evaluate the risk and take appropriate action (eg. email to administrator, forced logout, limited login, honeypot site, etc).
7. Lastly, you should update all of your page-access authentication checks to ensure that users have both logged in AND passed a RISC check before allowing access (example below).


## Sample code

### Client-side Javascript and EJS

Snippet from `views/loginRisc.ejs` to run the client-side javascript (**step 4**):

```
    window.onload = function() {
        initLastwallRisc('<%= lastwall_url %>');  // renders the session URL as a string in quotes, and calls the init function on it
    }
```

```
    var initLastwallRisc = function(url)
    {
        var scr = document.createElement('script');
        scr.setAttribute('async', 'true');
        scr.type = 'text/javascript';
        scr.src = url;
        ((document.getElementsByTagName('head') || [null])[0] ||
        document.getElementsByTagName('script')[0].parentNode).appendChild(scr);
    }
```

Hidden form to submit on RISC completion, also in `views/loginRisc.ejs` (**step 5**):

```
    var lastwallRiscFinished = function()
    {
        document.forms['lw_finished_form'].submit();
    }
```

```
    <form id="lw_finished_form" name="lw_finished_form" action="/finishedRisc" method="post"></form>
```

### Server-side Node.js examples

The following snippets show the most important sections of a sample Node.js passport-based authentication site, integrated with Lastwall RISC.

Snippet from `app.js`. After a successful username/password check, a RISC session is created and the user briefly redirected to a RISC handling page (**step 2**):

```
    app.post('/login', passport.authenticate('local', { failureRedirect: '/', failureFlash: true }), createRiscSession);
    ...
    var createRiscSession = function(req, res, next)
    {
        var session = getSessionFromRequest(req);
        if (!session)
        {
            return res.status(400).send('Session not found');
        }
        var onOk = function(result)
        {
            session.riscSessionId = result.session_id;
            session.riscSessionUrl = result.session_url;  // session URL stored here
            session.riscSessionInProgress = true;
            res.redirect('/loginRisc');   // load the loginRisc page, which will call the javascript
        }
        var onError = function(err)
        {
            res.status(400).send('Error creating Risc session: ' + err);
        }
        RiscAccessor.createSession(session.username, onOk, onError);  // RiscAccessor is a reference to the NPM module lastwall-risc-node
    }
```

Another snippet from `app.js`. Loads the followup page after initial login to run the RISC analysis (**step 3**):

```
    app.get('/loginRisc', ensureUserPass, loginRisc);
    ...
    var loginRisc = function(req, res)
    {
        var session = getSessionFromRequest(req);
        if (!session)
        {
            return res.status(400).send('Session not found');
        }
        res.render('loginRisc', {   // renders the EJS file 'views/loginRisc.ejs'
            title: 'Login Risk Followup',
            lastwall_url: session.riscSessionUrl,  // pass the session URL to the EJS renderer
            ... (other params)
        });
    };
```

On RISC completion, do the following (**step 6**):

```
    app.post('/finishedRisc', ensureUserPass, finishedRisc);
    ...
    var finishedRisc = function(req, res, next)
    {
        var session = getSessionFromRequest(req);
        if (!session)
        {
            return res.status(400).send('Session not found');
        }
        if (!session.riscSessionId || !session.riscSessionInProgress)
        {
            res.status(400).send("There is no RISC session in progress");
        }
        var onOk = function(result)
        {
            // First, clear out the session data
            session.riscSessionInProgress = false;
            session.riscSessionId = null;
            session.riscSessionUrl = null;
            session.riscScore = result.score;
            console.log('Risc session ended with score ' + result.score + ', status: ' + result.status);
            if (result.status == 'Authenticated' || result.status == 'Risky')
            {
                // Lenient example - user was not automatically failed, so let him in.
                session.riscStatus = 'passed';
                res.redirect('/account');
            }
            else
            {
                // Force logout on RISC failure.
                req.logout();
                res.redirect('/login');
            }
        }
        var onError = function(err)
        {
            res.status(400).send('Error closing Risc session: ' + err);
        }
        RiscAccessor.getSession(session.riscSessionId, onOk, onError); 
    }
```

Authentication functions in `app.js`. All of the account pages are protected by `ensureAuthenticated()` (**step 7**):

```
    app.get('/account', ensureAuthenticated, account);
    ...
    function ensureUserPass(req, res, next)
    {
        if (req.isAuthenticated()) { return next(); }
        res.redirect('/login');
    }
    function ensureAuthenticated(req, res, next)
    {
        if (req.isAuthenticated())
        {
            var session = getSessionFromRequest(req);
            if (session.riscStatus != 'passed')
                res.redirect('/loginRisc');
            return next();
        }
        res.redirect('/login');
    }
```
