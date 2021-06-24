var placeholderRes =   [
  {
    "a": "0x91db6a641a95a1ae25fa090066fdb94d276d816a",
    "s": "164.85672452"
  },
  {
    "a": "0x85113329ce3231f87aa200fec6b2614be4c7415a",
    "s": "161.95070931"
  },
  {
    "a": "0x6d6396b3209d1fe83b5606579b7faabd2f427f21",
    "s": "150.59972827"
  },
  {
    "a": "0x13dd8b8f54c3b54860f8d41a6fbff7ffc6bf01ef",
    "s": "112.49825767"
  },
  {
    "a": "0x5193df49238ad8df530462beaf2bcba21892c783",
    "s": "108.22830910"
  },
  {
    "a": "0xd1d62b01017b4687ad63d87ad199c97740c28e2f",
    "s": "71.95134583"
  },
  {
    "a": "0x785aa1cedc027e83bddbbe6f557f5a0668f2f688",
    "s": "64.88401184"
  },
  {
    "a": "0x72d62d76edc8aac27a894989d3062dea907e99f3",
    "s": "61.20528770"
  },
  {
    "a": "0x2fd64ac278ea3bc8974fba3de987ba652fcf5975",
    "s": "54.33301079"
  }
];

var accountMap  = [];
var cTokenRates = [];
var usdPrices   = [];
var liquidationIncentive = 0;
var closeFactor = 0;
var bottomScrolled = false;

var fetchLiquidateList = async function() {
  // request underwater accounts to backend
  var underwaterAccountsRes = placeholderRes;
  var liquidateItems = [];
  var progress = 0;

  for ( var i = 0; i < underwaterAccountsRes.length; i++ ) {
    var address = underwaterAccountsRes[i].a;

    await syncBorrowAccount(underwaterAccountsRes[i]);

    var shortfallIndex = accountMap[address].totalBorrowInUsd / accountMap[address].totalCollateralInUsd;

    liquidateItems.push({
      'totalBorrow'       : accountMap[address].totalBorrowInUsd.toFixed(2),
      'shortfallIndex'    : shortfallIndex.toFixed(2),
      'borrowerAddress'   : address
    });

    $("#liquidateListProgressBar").css("width", progress+"%");
    progress += Math.round((i / underwaterAccountsRes.length * 100)-2);

    if (i==5)break;
  }

  $('#liquidateListProgressBarContainer').addClass('d-none');
  $('#liquidateListLoaderContainer').addClass('d-none');

  console.log('accountMap: ')
  console.log(accountMap)

  return liquidateItems;
}

var syncBorrowAccount = async function(underwaterAccount) {
  var address   = underwaterAccount.a;
  var shortfall = underwaterAccount.s;
  accountMap[address] = new Object();
  accountMap[address].totalBorrowInUsd     = 0;
  accountMap[address].totalCollateralInUsd = 0;
  accountMap[address].shortfall            = shortfall;

  for ( var cTokenId in ENV.cTokens ) {
    var cToken = ENV.cTokens[cTokenId];

    accountMap[address][cToken.id] = new Object();

    var exchangeRateStored  = await cToken.contract.methods.exchangeRateStored().call();
    var cTokenBalance       = await cToken.contract.methods.balanceOf(address).call();
    var underlyingBalance   = cTokenBalance * exchangeRateStored / (Math.pow (10, 18 + cToken.underlyingDecimals));
    var borrowBalanceStored = await cToken.contract.methods.borrowBalanceStored(address).call();
    var borrowBalance       = borrowBalanceStored / Math.pow(10, cToken.underlyingDecimals);

    if ( !cTokenRates[cToken.id] ) {
      cTokenRates[cToken.id] = new Object();
      var collateralFactorMantissa = await ENV.comptrollerContract.methods.getcollateralFactorMantissa(cToken.address).call();
      var collateralFactor = collateralFactorMantissa / mentissa;
      cTokenRates[cToken.id].collateralFactor = collateralFactor;
    }

    accountMap[address][cToken.id].cTokenBalance        = cTokenBalance;
    accountMap[address][cToken.id].borrowBalance        = borrowBalance;
    accountMap[address][cToken.id].underlyingBalance    = underlyingBalance;
    accountMap[address][cToken.id].totalBorrowInUsd     = borrowBalance * usdPrices[cToken.id];
    accountMap[address][cToken.id].totalCollateralInUsd = underlyingBalance * usdPrices[cToken.id] * cTokenRates[cToken.id].collateralFactor;

    accountMap[address].totalBorrowInUsd     += accountMap[address][cToken.id].totalBorrowInUsd;
    accountMap[address].totalCollateralInUsd += accountMap[address][cToken.id].totalCollateralInUsd;
  }
}

var loadLiquidateList = async function() {
  $('#liquidateItems').html('');

  var liquidateItems = await fetchLiquidateList();

  Object.values(liquidateItems).forEach(function(item, index){
    var html = $($('#template_liquidateItem').html());
    $(html).find('.totalBorrow').html('$'+item.totalBorrow);
    $(html).find('.shortfallIndex').html(item.shortfallIndex);
    $(html).find('.borrowerAddress').html(item.borrowerAddress);
    
    $(html).click(function(e){
        $('.liquidateItem').removeClass('active');
        $(e.target).closest('.liquidateItem').addClass('active');

        $('.liquidate-info-container').addClass('d-none');
        $('.liquidate-action-container').removeClass('d-none');

        // scroll to bottom of page
        if ( !bottomScrolled ) {
          window.scroll({top: 1000, left: 0, behavior: 'smooth' });
          bottomScrolled = true;
        }

        handleRepayBorrowSelect(item);
        handleReceiveCollateralSelect(item);
    });
    
    $('#liquidateItems').append(html);
  });
}


var handleRepayBorrowSelect = function(item) {
  resetRepayBorrowSelect();
  for ( var cTokenId in ENV.cTokens ) {
    var borrowBalance = accountMap[item.borrowerAddress][cTokenId].borrowBalance;
    if ( borrowBalance > 0 && borrowBalance.toFixed(3) != "0.000" ) {
      $('#repayBorrowSelect').append(currencyOptionHtml(item.borrowerAddress, cTokenId));
    }
  }
}
var resetRepayBorrowSelect = function() {
  $('#repayBorrowSelect').html('<option value="" disabled="" selected>Select Borrow To Close</option>');
  $('#repayBorrowPriceValue').html("...");
  $('#repayBorrowUserBorrowedValue').html("...");
  $('#repayBorrowMaxQuantityValue').html("...");
  $('#amountToCloseCurrency').html("...");
}
$(document).on('change','#repayBorrowSelect',function(){
  var userAddress   = $(this).val();
  var currency      = $('#repayBorrowSelect option:selected').text().toLowerCase();
  var borrowBalance = accountMap[userAddress][currency].borrowBalance;
  var maxQuantity   = borrowBalance * closeFactor;
  $('#repayBorrowPriceValue').html("$"+usdPrices[currency].toFixed(3));
  $('#repayBorrowUserBorrowedValue').html(borrowBalance.toFixed(3)+" "+currency.toUpperCase());
  $('#repayBorrowMaxQuantityValue').html(maxQuantity.toFixed(3)+" "+currency.toUpperCase());
  $('#amountToCloseCurrency').html(currency.toUpperCase());

  // reset receiveCollateralSelect option
  $("#receiveCollateralSelect").val($("#receiveCollateralSelect option:first").val());
  $("#receiveCollateralSelect").change();
});


var handleReceiveCollateralSelect = function(item) {
  resetReceiveCollateralSelect();
  for ( var cTokenId in ENV.cTokens ) {
    var underlyingBalance = accountMap[item.borrowerAddress][cTokenId].underlyingBalance;
    if ( underlyingBalance > 0 && underlyingBalance.toFixed(3) != "0.000" ) {
      $('#receiveCollateralSelect').append(currencyOptionHtml(item.borrowerAddress, cTokenId));
    }
  }
}
var resetReceiveCollateralSelect = function() {
  $('#receiveCollateralSelect').html('<option value="" disabled="" selected>Select Desired Collateral</option>');
  $('#receiveCollateralPriceValue').html("...");
  $('#receiveCollateralBonusPriceValue').html("...");
  $('#receiveCollateralUserSuppliedValue').html("...");
  $('#receiveCollateralYouWillReceiveValue').html("...");
}

var updateReceiveCollateralPanel = function() {
  var userAddress       = $('#receiveCollateralSelect').val();
  var currency          = $('#receiveCollateralSelect option:selected').text().toLowerCase();
  if ( currency.length > 5 ) {
    return false;
  }

  var underlyingBalance = accountMap[userAddress][currency].underlyingBalance;
  var bonusRate         = 1 - (liquidationIncentive - 1);
  var bonusPrice        = bonusRate * usdPrices[currency];

  var amountToCloseValue = $('#repayBorrowAmountToCloseInput').val();
  var borrowCurrency     = $('#repayBorrowSelect option:selected').text().toLowerCase();
  var youWillReceive     = estimateSeizedAsset(amountToCloseValue, borrowCurrency, currency);

  $('#receiveCollateralPriceValue').html("$"+usdPrices[currency].toFixed(3));
  $('#receiveCollateralBonusPriceValue').html("$"+bonusPrice.toFixed(3)+" ("+(bonusRate*100).toFixed(2)+"%)");
  $('#receiveCollateralUserSuppliedValue').html(underlyingBalance.toFixed(3)+" "+currency.toUpperCase());
  $('#receiveCollateralYouWillReceiveValue').html(parseFloat(youWillReceive).toFixed(3)+" "+currency.toUpperCase());
}
$(document).on('change','#receiveCollateralSelect, #repayBorrowAmountToCloseInput', updateReceiveCollateralPanel);
$(document).on('keyup','#repayBorrowAmountToCloseInput', updateReceiveCollateralPanel);

var estimateSeizedAsset = function(amountToClose, borrowCurrency, collateralCurrency) {
  estimateSeizedAmount = 0;
  if ( !amountToClose || isNaN(amountToClose) || parseFloat(amountToClose) <= 0 ) {
    return 0;
  }

  var liquidationInUsd = liquidationIncentive * amountToClose * usdPrices[borrowCurrency];
  estimateSeizedAmount = liquidationInUsd / usdPrices[collateralCurrency];

  return estimateSeizedAmount;
}

var liquidate = async function() {

}
$(document).on('click','#liquidateButton', function() {
  $('#liquidateButtonLoader').removeClass('d-none');
  $('#liquidateButtonText').addClass('d-none');
});


var currencyOptionHtml = function(address, currency) {
  return '<option value="'+address+'">'+currency.toUpperCase()+'</option>';
}

var getUsdPrices = async function() {
  for ( var cTokenId in ENV.cTokens ) {
    var cToken = ENV.cTokens[cTokenId];
    usdPrices[cToken.id] =  await ENV.oracleContract.methods.getUnderlyingPrice(cToken.address).call() / Math.pow(10, 36 - cToken.underlyingDecimals);
  }
}
var getLiquidationIncentive = async function () {
  liquidationIncentive = await ENV.comptrollerContract.methods.liquidationIncentiveMantissa().call() / mentissa;
}
var getCloseFactor = async function() {
  closeFactor = await ENV.comptrollerContract.methods.closeFactorMantissa().call() / mentissa;
}
$(function(){
  syncCont();
  getUsdPrices();
  getLiquidationIncentive();
  getCloseFactor();
  loadLiquidateList();
});


