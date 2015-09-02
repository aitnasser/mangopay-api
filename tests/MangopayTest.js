var chai = require('chai');
var sinon = require('sinon');

chai.use(require('chai-as-promised'));

expect = chai.expect;

var Mangopay = require(process.env.PROJECT_ROOT + '/api/services/Mangopay.js');

/**
 * /!\ WARNING /!\
 *
 * These tests have only been written to speed up implementation.
 * Do not use them in continuous integration, as they will spam Mangopay API.
 *
 * The API url is not mocked, nor are the API results.
 * You can activate these tests to check for API downtime, compatibility, connection problems etc.
 */
describe('mangopay client', function() {
  var mango;

  // the variables below are created by tests and linked to the test account
  // they may be subject to change, verify them in your dashboard
  var sellerId = '6829679';
  var sellerBankAccountId = '6829741';
  var sellerWalletId = '6831961';

  var buyerId = '6829682';
  var buyerCardId = '6829692';
  var buyerWalletId = '6832008';

  beforeEach(function() {
    mango = new Mangopay();
  });

  // xit means the test is disabled, it was only used to test rapidly during development
  xit('allows to create a user for buyer or seller', function() {
    var user = {
      Email: 'mc-buyer@yopmail.com',
      FirstName: 'buyer',
      LastName: 'buyer',
      Birthday: new Date(1987, 9 - 1, 14, 0, 0, 0).getTime() / 1000, // month is 0 based
      Nationality: 'pl',
      CountryOfResidence: 'pl'
    };

    expect(mango.createUser).to.be.a('function');

    return expect(mango.createUser(user))
      .to.eventually.have.property('Id');
  });

  xit('allows to register payment card', function() {
    this.timeout(10000);

    var cardInfo = {
      cardNumber: '4970100000000154',
      cardExpirationDate: '0118',
      cardCvx: 123,
      currency: 'EUR',
      type: 'CB_VISA_MASTERCARD'
    };

    return expect(mango.registerCard(buyerId, cardInfo))
      .to.eventually.have.property('Status', 'VALIDATED');
  });

  xit('allows to register the bank account of a seller', function(done) {
    this.timeout(10000);

    var bankAccount = {
      Type: 'IBAN',
      OwnerName: 'BAM',
      OwnerAddress: '4, avenue du Bel-Air, 75012 Paris',
      Userid: sellerId,
      IBAN: '' // @todo Put a fake IBAN here
    };

    mango.registerBankAccount(sellerId, bankAccount)
      .then(function(response) {
        expect(response).to.have.property('CreationDate');
        expect(response).to.have.property('UserId', sellerId);

        // this marks the test as finished
        done();
      })
      .catch(function(err) {
        throw new Error('Promise was unexpectedly rejected with the following error: ' + err);
      });
  });

  xit('allows to debit the user using a registered card', function(done) {
    this.timeout(10000);

    mango.debit(buyerId, buyerCardId, 1000, buyerWalletId).then(function(response) {
      console.log(response);
      expect(response).to.have.property('Status', 'SUCCEEDED');

      done();
    });
  });

  xit('allows to create a wallet for a user', function() {

    return expect(mango.createWallet(buyerId)).to.eventually.have.property('CreationDate');
  });

  xit('allows to declare a transfer from buyers account to sellers account', function() {
    this.timeout(5000);

    return expect(mango.transfer(buyerId, sellerId, 1000, 100, buyerWalletId, sellerWalletId))
      .to.eventually.have.property('Status', 'SUCCEEDED');
  });

  xit('allows a seller to pay out the total of his wallet', function() {
    return expect(mango.totalPayOut(sellerId, sellerWalletId, sellerBankAccountId))
      .to.eventually.have.property('Status', 'CREATED');
  });

  xit('executes the whole mangopay payment chain', function(done) {
    this.timeout(10000);

    // create seller account
    var seller = {
      Email: 'mc-seller@yopmail.com',
      FirstName: 'seller',
      LastName: 'Random',
      Birthday: new Date(1987, 9 - 1, 14, 0, 0, 0).getTime() / 1000, // month is 0 based
      Nationality: 'pl',
      CountryOfResidence: 'pl'
    };

    var buyer = {
      Email: 'mc-buyer@yopmail.com',
      FirstName: 'buyer',
      LastName: 'Random',
      Birthday: new Date(1987, 9 - 1, 14, 0, 0, 0).getTime() / 1000, // month is 0 based
      Nationality: 'pl',
      CountryOfResidence: 'pl'
    };

    mango.createUser(seller)
      .then(function(mpseller) {
        expect(mpseller).to.have.property('Id');
        expect(mpseller.Id).to.be.ok;

        seller.mpId = mpseller.Id;

        return mango.createWallet(seller.mpId)
      })
      .then(function(sellerWallet) {
        seller.wallet = sellerWallet;

        return mango.createUser(buyer);
      })
      .then(function(mpbuyer) {
        expect(mpbuyer).to.have.property('Id');
        expect(mpbuyer.Id).to.be.ok;

        buyer.mpId = mpbuyer.Id;

        return mango.createWallet(buyer.mpId)
      })
      .then(function(buyerWallet) {
        buyer.wallet = buyerWallet;

        var cardInfo = {
          cardNumber: '4970101122334422',
          cardExpirationDate: '0120',
          cardCvx: 123,
          currency: 'EUR',
          type: 'CB_VISA_MASTERCARD'
        };

        return mango.registerCard(buyer.mpId, cardInfo);
      })
      .then(function(mpCreditCard) {
        expect(mpCreditCard).to.have.property('Status', 'VALIDATED');
        expect(mpCreditCard).to.have.property('CardId');

        buyer.card = mpCreditCard;

        return mango.debit(buyer.mpId, buyer.card.CardId, 1000, buyer.wallet.Id);
      })
      .then(function(cardPayment) {
        expect(cardPayment).to.have.property('Status', 'SUCCEEDED');

        done();
      })
      .catch(function(err) {
        done(err);
      });

    // @todo - transfer from buyer to seller
    // @todo - test seller payout
  });

  it('handles payment errors')
});
