var tadpoleBackendUrl           = "http://localhost:3000/"; // change to backend url
var underwaterAccountsEndpoint  = "tadpole-backend/api/underwater_accounts";

var placeholderRes = [
  {
    "a": "0x16dfceabb08a4f0deffc28b8d7bea29ee120cab7",
    "s": "27385.14089530"
  },
  {
    "a": "0x45c544fd99166b4a41a2afa7633e224ac1ed2d67",
    "s": "25125.55700935"
  },
  {
    "a": "0x807f6ac692d3f9b135000681ac6a1646f2c9db39",
    "s": "372.53229096"
  },
  {
    "a": "0x1d85fd0bd1805aae7da112232a222c35c91e946e",
    "s": "315.30001311"
  },
  {
    "a": "0x6e059f5eaabe83dca7f18712a476c35a4f2b6bd7",
    "s": "240.34423118"
  },
  {
    "a": "0x1d70b26186047192db503a1b21bc92384688e186",
    "s": "215.19033341"
  },
  {
    "a": "0xeed3838d3a170d0426be97ee94012d1d0547cedb",
    "s": "192.13500673"
  },
  {
    "a": "0x9061327082fb027c52442e0712ae45dc9dcf9d40",
    "s": "190.82796208"
  },
  {
    "a": "0xc36d68e197f7a31729388f281f14d0e7a6dc6875",
    "s": "177.33876601"
  },
  {
    "a": "0x91db6a641a95a1ae25fa090066fdb94d276d816a",
    "s": "174.97922082"
  },
  {
    "a": "0x85113329ce3231f87aa200fec6b2614be4c7415a",
    "s": "174.13703437"
  },
  {
    "a": "0x6d6396b3209d1fe83b5606579b7faabd2f427f21",
    "s": "155.86987804"
  },
  {
    "a": "0x13dd8b8f54c3b54860f8d41a6fbff7ffc6bf01ef",
    "s": "127.15294733"
  },
  {
    "a": "0x5193df49238ad8df530462beaf2bcba21892c783",
    "s": "118.46046763"
  },
  {
    "a": "0x785aa1cedc027e83bddbbe6f557f5a0668f2f688",
    "s": "67.01359517"
  },
  {
    "a": "0x72d62d76edc8aac27a894989d3062dea907e99f3",
    "s": "63.21532830"
  },
  {
    "a": "0x2fd64ac278ea3bc8974fba3de987ba652fcf5975",
    "s": "56.17077231"
  }
];

var accountMap  = [];
var cTokenRates = [];
var usdPrices   = [];
var liquidationIncentive = 0;
var closeFactor          = 0;
const gasLimitLiquidateBorrow      = 710000;
const gasLimitLiquidateBorrowErc20 = 910000;
var bottomScrolled = false;

var fetchLiquidateList = async function() {
  // request underwater accounts to backend
  // var xmlHttp = new XMLHttpRequest();
  // var url = tadpoleBackendUrl + underwaterAccountsEndpoint;
  // xmlHttp.open("GET", url, false);
  // xmlHttp.send(null);
  // var underwaterAccountsRes = JSON.parse(xmlHttp.responseText);

  var underwaterAccountsRes = placeholderRes;

  var liquidateItems = [];
  var progress = 25;

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
    progress += Math.round((0.85 / underwaterAccountsRes.length) * 100);
  }

  $('#liquidateListProgressBarContainer').addClass('d-none');
  $('#liquidateListLoaderContainer').addClass('d-none');

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
  var userAddress = $('#receiveCollateralSelect').val();
  var currency    = $('#receiveCollateralSelect option:selected').text().toLowerCase();
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

$(document).on('click','#liquidateButton', async function() {
  // check metamask connection
  $.magnificPopup.close();
  if ( !account ) {
    Swal.fire(
      'Error',
      'Connect MetaMask to continue.',
      'error'
    )
    return;
  }

  // validate input
  var repayAmountInDecimal = $('#repayBorrowAmountToCloseInput').val();
  if ( !repayAmountInDecimal || isNaN(repayAmountInDecimal) || repayAmountInDecimal <= 0 ) {
    Swal.fire(
      'Error',
      'Enter valid amount.',
      'error'
    )
    return false;
  }

  // check allowance, if not approved yet, ask to approve
  var repayCurrency = $('#repayBorrowSelect option:selected').text().toLowerCase();
  var cont = ENV.cTokens[repayCurrency];

  if ( cont.id != 'bnb' ) {
    var token = new web3.eth.Contract(erc20Abi, cont.underlyingAddress);
    var allowance = await token.methods.allowance(account, cont.address).call();
    allowance = allowance / Math.pow(10, cont.underlyingDecimals);
    var needed_allowance = 9999999999;
    if ( cont.id == 'tad' ) needed_allowance = 500000;
    if ( allowance < needed_allowance ) { 
      pop_enable_liquidate(cont);
      return;
    }
  }

  // liquidate
  liquidateButtonLoading();

  var borrowerAddress = $('#repayBorrowSelect').val();
  var collateralCurrency = $('#receiveCollateralSelect option:selected').text().toLowerCase();
  var cTokenCollateral = ENV.cTokens[collateralCurrency].address;

  if ( cont.id == 'bnb' ) { // repay with bnb
    var cToken =  new web3.eth.Contract(cEtherAbi, cont.address);
    var repayAmountInRaw = web3.utils.toHex(web3.utils.toWei(repayAmountInDecimal, 'ether'));

    await cToken.methods.liquidateBorrow(borrowerAddress, cTokenCollateral).send({
      from  : account,
      gas   : gasLimitLiquidateBorrow,
      value : repayAmountInRaw
    }, function(err, result) {
        if (err) {
          $.magnificPopup.close();
          Swal.fire(
            'Failed',
            err.message,
            'error'
          )
          liquidateButtonEnable();

        } else {
          $.magnificPopup.close();
          Swal.fire(
            'Transaction Sent',
            result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
            'success'
          )
        }
    });
    
  } else { // repay with tokens
    var cToken =  new web3.eth.Contract(cErc20Abi, cont.address);
    var repayAmountInRaw = Math.floor(repayAmountInDecimal * Math.pow(10, cont.underlyingDecimals));

    await cToken.methods.liquidateBorrow(borrowerAddress, numberToString(repayAmountInRaw), cTokenCollateral).send({
      from  : account,
      gas   : gasLimitLiquidateBorrowErc20
    }, function(err, result) {
        if (err) {
          $.magnificPopup.close();
          Swal.fire(
            'Failed',
            err.message,
            'error'
          )
          liquidateButtonEnable();

        } else {
          $.magnificPopup.close();
          Swal.fire(
            'Transaction Sent',
            result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
            'success'
          )
        }
    });
  }

  liquidateButtonEnable();
});
var liquidateButtonLoading = function() {
  $('#liquidateButtonLoader').removeClass('d-none');
  $('#liquidateButtonText').addClass('d-none');
  $('#liquidateButton').disabled = true;
}
var liquidateButtonEnable = function () {
  $('#liquidateButtonLoader').addClass('d-none');
  $('#liquidateButtonText').removeClass('d-none');
  $('#liquidateButton').disabled = false;
}
var pop_enable_liquidate = function(cont){
  $('#enableLiquidateForm .coin_img').attr('src', cont.logo);
  $('#enableLiquidateForm .val_coin_name').html(cont.name);
  $('#enableLiquidateForm .coin_btn_lanjut').html('Continue').attr('onclick', 'go_enable_liquidate(\''+cont.id+'\'); return false;');
  $.magnificPopup.open({
    items: {
      src: '#enableLiquidateForm',
      type: 'inline'
    },
    showCloseBtn: false
  });
}
var go_enable_liquidate = async function(id) {
  var cont = ENV.cTokens[id];
  
  $('#enableLiquidateForm .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
  
  var token = new web3.eth.Contract(erc20Abi, cont.underlyingAddress);
  var raw_amount = 99999999999999999999 * Math.pow(10, cont.underlyingDecimals);
  if ( id == 'tad' ) raw_amount = 10000000 * Math.pow(10, cont.underlyingDecimals);
  var allowance = await token.methods.approve(cont.address, numberToString(raw_amount)).send({
    from : account,
    gas  : gasLimitApprove
  }, function(err, result) {
    if (err) {
      $.magnificPopup.close();
      Swal.fire(
        'Failed',
        err.message,
        'error'
      )

    } else {
      $.magnificPopup.close();
      Swal.fire(
        'Transaction Sent',
        'Please wait the transaction to be confirmed, then you can start to liquidate.<br /><br />'+result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
        'success'
      )
    }
  });
}

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
  $("#liquidateListProgressBar").css("width", "5%");

  getUsdPrices();
  $("#liquidateListProgressBar").css("width", "10%");

  getLiquidationIncentive();
  $("#liquidateListProgressBar").css("width", "15%");

  getCloseFactor();
  $("#liquidateListProgressBar").css("width", "20%");

  loadLiquidateList();
});


