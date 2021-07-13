var tadpoleBackendUrl           = "https://api.tadpole.finance/stage/tadpole-backend/"; // change to backend url
var underwaterAccountsEndpoint  = "api/underwater_accounts/1";

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
  var xmlHttp = new XMLHttpRequest();
  var url = tadpoleBackendUrl + underwaterAccountsEndpoint;
  xmlHttp.open("GET", url, false);
  xmlHttp.send(null);
  var underwaterAccountsRes = JSON.parse(xmlHttp.responseText);

  var liquidateItems = [];
  var progress = 25;

  for ( var i = 0; i < underwaterAccountsRes.length; i++ ) {
    var address = underwaterAccountsRes[i].address;
    var shortfallIndex = parseFloat(underwaterAccountsRes[i].total_borrow) / parseFloat(underwaterAccountsRes[i].total_collateral);
    if ( shortfallIndex >= 1 ) {
      liquidateItems.push({
        'totalBorrow'       : parseFloat(underwaterAccountsRes[i].total_borrow).toFixed(2),
        'shortfallIndex'    : parseFloat(shortfallIndex).toFixed(2),
        'borrowerAddress'   : address
      });
    }

    $("#liquidateListProgressBar").css("width", progress+"%");
    progress += Math.round((0.85 / underwaterAccountsRes.length) * 100);
  }

  $('#liquidateListProgressBarContainer').addClass('d-none');
  $('#liquidateListLoaderContainer').addClass('d-none');

  if ( liquidateItems.length <= 0 ) {
    $('#noDataContainer').removeClass('d-none');
  }

  return liquidateItems;
}

var syncBorrowAccount = async function(address) {
  accountMap[address] = new Object();
  accountMap[address].totalBorrowInUsd     = 0;
  accountMap[address].totalCollateralInUsd = 0;

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
    
    $(html).click(async function(e){
        $('.liquidate-info-container').addClass('d-none');
        $('.liquidate-action-container').removeClass('d-none');

        // highlight selection
        $('.liquidateItem').removeClass('active');
        $(e.target).closest('.liquidateItem').addClass('active');

        // hide liquidate select content
        $('.liquidate-action-container').addClass('transparent');
        $('#liquidateContentLoader').removeClass('d-none');

        // scroll to bottom of page
        if ( !bottomScrolled ) {
          window.scroll({top: 3000, left: 0, behavior: 'smooth' });
        }

        // sync borrow account
        if (!accountMap[item.borrowerAddress]) {
          await syncBorrowAccount(item.borrowerAddress);
        }
        handleRepayBorrowSelect(item);
        handleReceiveCollateralSelect(item);

        // show liquidate select content
        $('.liquidate-action-container').removeClass('transparent');
        $('#liquidateContentLoader').addClass('d-none');
    });
    
    $('#liquidateItems').append(html);
  });
}


var handleRepayBorrowSelect = function(item) {
  resetRepayBorrowSelect();
  for ( var cTokenId in ENV.cTokens ) {
    var borrowBalance = accountMap[item.borrowerAddress][cTokenId].borrowBalance;
    if ( borrowBalance > 0 && borrowBalance.toFixed(3) != "0.000" ) {
      var append = true;
      if ( cTokenId == "bnb" && borrowBalance < 0.008 ) {
        append = false;
      }
      if ( append ) {
        $('#repayBorrowSelect').append(currencyOptionHtml(item.borrowerAddress, cTokenId));
      }
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
  var maxQuantity   = calculateMaxQuantity(userAddress, currency, borrowBalance);
  $('#repayBorrowPriceValue').html("$"+usdPrices[currency].toFixed(3));
  $('#repayBorrowUserBorrowedValue').html(borrowBalance.toFixed(3)+" "+currency.toUpperCase());
  $('#repayBorrowMaxQuantityValue').html(maxQuantity.toFixed(3)+" "+currency.toUpperCase());
  $('#amountToCloseCurrency').html(currency.toUpperCase());

  // reset receiveCollateralSelect option
  $("#receiveCollateralSelect").val($("#receiveCollateralSelect option:first").val());
  $("#receiveCollateralSelect").change();
});

var calculateMaxQuantity = function(userAddress, borrowCurrency, borrowBalance) {
  var maxQuantity = borrowBalance * closeFactor;
  var supplyCurrency = $('#receiveCollateralSelect option:selected').text().toLowerCase();
  var supplyCurrencyVal = $('#receiveCollateralSelect option:selected').val();
  if ( supplyCurrency && supplyCurrencyVal ) {
    var supplyBalance = accountMap[userAddress][supplyCurrency].underlyingBalance;

    var borrowBalanceInUsd = borrowBalance * closeFactor * usdPrices[borrowCurrency];
    var supplyBalanceInUsd = supplyBalance * usdPrices[supplyCurrency];

    if ( borrowBalanceInUsd > supplyBalanceInUsd ) {
      maxQuantity = supplyBalanceInUsd * closeFactor / usdPrices[borrowCurrency];
      maxQuantity -= 0.001;
    }
  }
  return maxQuantity;
}


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

  // recalculate max quantity
  var borrowBalance = accountMap[userAddress][borrowCurrency].borrowBalance;
  var maxQuantity = calculateMaxQuantity(userAddress, borrowCurrency, borrowBalance);
  $('#repayBorrowMaxQuantityValue').html(maxQuantity.toFixed(3)+" "+borrowCurrency.toUpperCase());

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
  setTimeout(liquidateButtonEnable, 30000);
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


