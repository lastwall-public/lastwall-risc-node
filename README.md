# ![Lastwall Logo](logo.png) Lastwall RISC Node.js Module

Lastwall risk-based authentication module for Node.js

## Overview

This document provides pseudo-code to describe our Node.js integration module.

Before reading this, please read our general [integratrion documentation](Integration.md).

For bare-bones API documentation, please [click here](API.md).


## Initialization

```
var riscOptions =
{
    token: 'LWK150D380544E303C57E57036F628DA2195FDFEE3DE404F4AA4D7D5397D5D35010',
    secret: '2B60355A24C907761DA3B09C7B8794C7F9B8BE1D70D2488C36CAF85E37DB2C',
    verbose: true
}
var RiscAccessor = require('lastwall-risc-node');
RiscAccessor.initialize(riscOptions);
```


## Verify API Key

```
var onOk = function()
{
    console.log('API key verified');
}
var onError = function(err)
{
    console.log('Error verifying API key: ' + err);
}
RiscAccessor.verifyApiKey(onOk, onError);   
```


## Create Session

```
var onOk = function(result)
{
    session.riscSessionId = result.session_id;
    session.riscSessionUrl = result.session_url;
}
var onError = function(err)
{
    console.log('Error creating Risc session: ' + err);
}
RiscAccessor.createSession(user.id, onOk, onError);   
```


## Check Session Results

```
var onOk = function(result)
{
    console.log('Risc session ended for user ' + result.user_id + ' with score ' + result.score + ', status: ' + result.status);
    if (result.authenticated == true)
    {
        // TODO: log user in
    }
    else if (result.risky == true)
    {
        // TODO: handle risky access - force a 2FA?
    }
    else
    {
        // TODO: handle failed authentication - force logout?
    }
}
var onError = function(err)
{
    console.log('Error reading Risc session: ' + err);
}
RiscAccessor.getSession(session.riscSessionId, onOk, onError); 
```


## Create User Account

```
var onOk = function()
{
    console.log('User created');
}
var onError = function(err)
{
    console.log('Error creating user account: ' + err);
}
RiscAccessor.createUser(user.id, user.displayname, user.email, user.phone, onOk, onError);   
```


## Modify User Account

```
var onOk = function()
{
    console.log('User updated');
}
var onError = function(err)
{
    console.log('Error updating user account: ' + err);
}
var opts = {
    email: new_email_address,
    phone: new_phone_number,
    name: new_display_name
}
RiscAccessor.modifyUser(user.id, opts, onOk, onError);   
```


## Delete User Account

```
var onOk = function()
{
    console.log('User deleted');
}
var onError = function(err)
{
    console.log('Error deleted user account: ' + err);
}
RiscAccessor.deleteUser(user.id, onOk, onError);   
```
