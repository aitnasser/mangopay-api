var rp = require('request-promise');
var _ = require('lodash');
var Promise = require('bluebird');

/**
 * Handles exchanges with MangopayAPI
 *
 * @constructor
 */
Mangopay = function(clientId, basicAuthKey) {
  this.baseUrl = 'https://api.sandbox.mangopay.com/v2/' + clientId;
  this.headers = {
    Authorization: 'Basic ' + basicAuthKey
  };
};

/**
 * Creates a Mangopay user
 *
 * @link https://docs.mangopay.com/api-references/users/natural-users/
 *
 * @param userData See API reference for required attributes
 *
 * @returns {Promise.<object>} A promise that resolves with created user data.
 *                             You need to handle the "Id" field and save it in local database.
 */
Mangopay.prototype.createUser = function(userData) {
  return rp.post({
    uri: this.baseUrl + '/users/natural',
    headers: this.headers,
    body: userData,
    json: true
  });
};

/**
 * Creates a wallet for the user
 *
 * @param userId Mangopay id for the user
 *
 * @returns @returns {Promise.<object>}
 */
Mangopay.prototype.createWallet = function(userId) {
  return rp.post({
    uri: this.baseUrl + '/wallets',
    headers: this.headers,
    body: {
      Owners: [userId],
      Description: 'Main wallet',
      Currency: 'EUR'
    },
    json: true
  });
};

/**
 * Preregisters the card and gives access to tokenization service.
 *
 * Use only if the @Mangopay.registerCard didn't complete successfully
 * and need to be amended.
 *
 * @link https://docs.mangopay.com/api-references/card-registration/
 *
 * @param mangopayUserId
 * @param cardInfo
 * @param cardInfo.currency ISO format currency string
 * @param cardInfo.cardType One of « CB_VISA_MASTERCARD », « MAESTRO » or « DINERS »
 *
 * @return {Promise.<object>} A promise that resolves with access to tokenization server and the id.
 */
Mangopay.prototype.preRegisterCard = function(mangopayUserId, cardInfo) {
  return rp.post({
    uri: this.baseUrl + '/cardregistrations',
    headers: this.headers,
    body: {
      UserId: mangopayUserId,
      Currency: cardInfo.currency,
      CardType: cardInfo.cardType
    },
    json: true
  });
};

/**
 * Calls the tokenization service to register the card.
 *
 * Use only if the @Mangopay.registerCard didn't complete successfully
 * and need to be amended.
 *
 * @link https://docs.mangopay.com/api-references/card-registration/
 *
 * @param cardData
 * @param cardData.cardNumber         The card number, without spaces or anything
 * @param cardData.cardExpirationDate The card expiration date in MMYY format.
 * @param cardData.cardCvx            The card security code
 *
 * @param preRegistrationResult       The result of preRegisterCard call
 *
 * @return {Promise.<string>} A promise resolved with data string confirming registration
 *                            or error=ERR_NUMBER if registration failed.
 */
Mangopay.prototype.tokenizeCard = function(cardData, preRegistrationResult) {
  return rp.post({
    uri: preRegistrationResult.CardRegistrationURL,
    form: _.assign(cardData, {
      accessKeyRef: preRegistrationResult.AccessKey,
      data: preRegistrationResult.PreregistrationData
    })
  });
};

/**
 * Updates Mangopay information with confirmation from tokenization service.
 *
 * Use only if the @Mangopay.registerCard didn't complete successfully
 * and need to be amended.
 *
 * @link https://docs.mangopay.com/api-references/card-registration/
 *
 * @param cardId
 * @param tokenizationData
 *
 * @returns {Promise.<object>}
 */
Mangopay.prototype.finaliseCardRegistration = function(cardId, tokenizationData) {
  return rp.post({
    uri: this.baseUrl + '/CardRegistrations/' + cardId,
    headers: this.headers,
    body: {
      RegistrationData: tokenizationData
    },
    json: true
  });
};

/**
 * Calls the chain of card registration.
 *
 * @param mangopayUserId
 * @param cardInfo                    A object containing the data inserted by user
 * @param cardInfo.type               One of « CB_VISA_MASTERCARD », « MAESTRO » or « DINERS »
 * @param cardInfo.currency           ISO currency identifier
 * @param cardInfo.cardNumber
 * @param cardInfo.cardExpirationDate In MMYY format
 * @param cardInfo.cardCvx
 *
 * @returns {Promise.<object>}        The card registration object with Status: VALIDATED if everything went OK.
 *                                    Note that this is not a Card, you get the CardId in response if you need
 *                                    to access the card directly
 */
Mangopay.prototype.registerCard = function(mangopayUserId, cardInfo) {
  var _this = this;

  return this.preRegisterCard(mangopayUserId, {
      currency: cardInfo.currency,
      cardType: cardInfo.type
    })
    .then(function(preRegistrationResult) {
      return [preRegistrationResult, _this.tokenizeCard({
        cardNumber: cardInfo.cardNumber,
        cardExpirationDate: cardInfo.cardExpirationDate,
        cardCvx: cardInfo.cardCvx
      }, preRegistrationResult)];
    })
    .spread(function(preRegistrationResult, tokenizationData) {
      if (tokenizationData.indexOf('error') !== -1) {
        return Promise.reject({ error: tokenizationData.split('=').pop() });
      }

      return _this.finaliseCardRegistration(preRegistrationResult.Id, tokenizationData);
    });
};

/**
 * Check if there is a existing credit card corresponding to cardId
 *
 * @param cardId
 */
Mangopay.prototype.existsCard = function(cardId) {
  var _this = this;

  return rp.get({
    uri: this.baseUrl + '/cards/' + cardId,
    headers: this.headers,
    json: true
  });
};

/**
 * Unactive the credit card corresponding to cardId
 *
 * @param cardId
 */
Mangopay.prototype.deleteCard = function(cardId) {
  var _this = this;

  return rp.put({
    uri: this.baseUrl + '/cards/' + cardId,
    headers: this.headers,
    body:{
      Active: false
    },
    json: true
  });
};

/**
 *
 *
 * @param mangopayUserId
 * @param bankAccount
 *
 * @returns {Promise.<object>}
 */
Mangopay.prototype.registerBankAccount = function(mangopayUserId, bankAccount) {
  return rp.post({
    uri: this.baseUrl + '/users/' + mangopayUserId + '/bankaccounts/' + bankAccount.Type,
    headers: this.headers,
    body: bankAccount,
    json: true
  });
};

/**
 * Retrieves the bank account for the given user
 *
 * @param mangopayUserId
 */
Mangopay.prototype.getBankAccount = function(mangopayUserId, accountId) {
  return rp.get({
    uri: this.baseUrl + '/users/' + mangopayUserId + '/bankaccounts/' + accountId,
    headers: this.headers,
    json: true
  });
};

/**
 * Debits fancookers credit card and puts the required amount in his wallet.
 *
 * @param fanCookerId
 * @param fanCookerCardId
 * @param amount            The value to debit, in eurocents
 * @param fanCookerWalletId
 * @param fees              The fees to debit, in eurocents
 *
 * @returns {Promise.<object>}
 */
Mangopay.prototype.debit = function(fanCookerId, fanCookerCardId, amount, fanCookerWalletId, fees = 0) {
  return rp.post({
    uri: this.baseUrl + '/payins/card/direct',
    headers: this.headers,
    body: {
      AuthorId: fanCookerId,
      CreditedUserId: fanCookerId,
      DebitedFunds: {
        Currency: 'EUR',
        Amount: amount
      },
      Fees: {
        Currency: 'EUR',
        Amount: fees
      },
      CreditedWalletId: fanCookerWalletId,
      SecureModeReturnUrl: 'http://www.bamlab.fr',
      CardId: fanCookerCardId
    },
    json: true
  });
};

/**
 * Transfers the money betweent two wallets inside Mangopay.
 * Should be called 48h after a transaction is concluded.
 *
 * @param fanCookerId
 * @param cookerId
 * @param amount
 * @param fanCookerWalletId
 * @param cookerWalletId
 *
 * @returns {Promise.<object>}
 */
Mangopay.prototype.transfer = function(fanCookerId, cookerId, amount, fees, fanCookerWalletId, cookerWalletId) {
  return rp.post({
    uri: this.baseUrl + '/transfers',
    headers: this.headers,
    body: {
      AuthorId: fanCookerId,
      CreditedUserId: cookerId,
      DebitedFunds: {
        Currency: 'EUR',
        Amount: amount
      },
      Fees: {
        Currency: 'EUR',
        Amount: fees
      },
      CreditedWalletId: cookerWalletId,
      DebitedWalletId: fanCookerWalletId
    },
    json: true
  });
};

/**
 * @param walletId
 *
 * @returns {Promise.<object>}
 */
Mangopay.prototype.getWallet = function(walletId) {
  return rp.get({
    uri: this.baseUrl + '/wallets/' + walletId,
    headers: this.headers,
    json: true
  });
};

/**
 * Transfers all the found from a wallet to the given bank account
 *
 * @param cookerId
 * @param cookerWalletId
 * @param accountId
 *
 * @returns {Promise.<object>}
 */
Mangopay.prototype.totalPayOut = function(cookerId, cookerWalletId, accountId) {
  var _this = this;

  return this.getWallet(cookerWalletId)
    .then(function(wallet) {
      var amount = wallet.Balance.Amount;

      return rp.post({
        uri: _this.baseUrl + '/payouts/bankwire',
        headers: _this.headers,
        body: {
          AuthorId: cookerId,
          DebitedWalletId: cookerWalletId,
          DebitedFunds: {
            Currency: 'EUR',
            Amount: amount
          },
          Fees: {
            Currency: 'EUR',
            Amount: 0
          },
          BankAccountId: accountId
        },
        json: true
      });
    });
};

Mangopay.prototype.getPayIn = function(payinId) {
  var _this = this;

  return rp.get({
    uri: this.baseUrl + '/payins/' + payinId,
    headers: this.headers,
    json: true
  });
};

module.exports = Mangopay;
