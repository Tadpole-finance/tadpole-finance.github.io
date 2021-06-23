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

var fetchLiquidateList = async function() {
  // request underwater accounts to backend
  var underwaterAccountsRes = placeholderRes;
  var liquidateItems = [];

  for ( var i = 0; i < underwaterAccountsRes.length; i++ ) {
    var address = underwaterAccountsRes[i].a;

    await syncBorrowAccount(underwaterAccountsRes[i]);

    var shortfallIndex = accountMap[address].totalBorrowInUsd / accountMap[address].totalCollateralInUsd;

    liquidateItems.push({
      'totalBorrow'       : accountMap[address].totalBorrowInUsd.toFixed(2),
      'shortfallIndex'    : shortfallIndex.toFixed(2),
      'borrowerAddress'   : address
    });

    if (i==5)break;
  }

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
    });
    
    $('#liquidateItems').append(html);
  });
}

var getUsdPrices = async function() {
  for ( var cTokenId in ENV.cTokens ) {
    var cToken = ENV.cTokens[cTokenId];
    usdPrices[cToken.id] =  await ENV.oracleContract.methods.getUnderlyingPrice(cToken.address).call() / Math.pow(10, 36 - cToken.underlyingDecimals);
  }
}

$(function(){
  syncCont();
  getUsdPrices();
  loadLiquidateList();
});


