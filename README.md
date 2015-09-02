# MangopayAPI

This is an implementation of Mangopay API aiming to simplify it's integration in a Node.js project. It maps most of MangopayAPI to a simple interface as well as provides some convenience methods.

It uses `request-promise` and `bluebird` so each call returns a promise.

## Usage

Create new instance and configure you API keys:

```js
var clientId = 'myMangopayClientId';
var basicAuthKey = 'myBasicAuthGeneratedKeyWithManyRandomCharacters';

var mp = new Mangopay(clientId, basicAuthKey);
var userData = {
    Email: 'someone@example.com',
    FirstName: 'John',
    LastName: 'Doe',
    Birthday: new Date(1997, 1, 1).getTime() / 1000,
    Nationality: 'fr',
    CountryOfResidence: 'fr'
};
mp.createUser(userData)
    .then(function(mpResponse) {
        console.log('MP UserId is ' + mpResponse.Id);
    });
```

For full data specification of each method, refer to MP documentation.

## TODO

 - this library supports only basic authentification,
 - not all Mangopay interfaces are implemented

