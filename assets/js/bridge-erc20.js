var BN = web3.utils.BN;

const gasLimitApprove = 70000;

var formatter = new Intl.NumberFormat('us-US', {
  style: 'currency',
  currency: 'USD',
});

var ENV = {
	"id": 1,
	"comptrollerAddress": "0x",
	"oracleAddress": "0x",
	"tadAddress": "0x9f7229aF0c4b9740e207Ea283b9094983f78ba04",
	"genesisMiningAddress": "0x8Cb331D8F117a5C914fd0f2579321572A27bf191",
	"uniswapMiningAddress": "0x0c14e822E43796d955a30b6d974f62031dA845e3",
	"lpAddress": "0x9D8D4550637e3fc86CB465734Ab33280e4838E08",
	"uniswapAddress": "0x9D8D4550637e3fc86CB465734Ab33280e4838E08",
	"bridgeAddress": "0x4618C019a0Ed3B1B560ebc3Cc80ee4eB52c96230",
	"etherscan": "https://etherscan.io/",
	"cTokens": {
		"usdt": {
			"id": "usdt",
			"name": "USDT",
			"index": "tether",
			"unit": "USDT",
			"logo": "./assets/libs/cryptocurrency-icons/32/color/usdt.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 6,
			"address": "0x",
			"underlyingAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
		},
		"wbtc": {
			"id": "wbtc",
			"name": "WBTC",
			"index": "wbtc",
			"unit": "WBTC",
			"logo": "./assets/images/tokens/wbtc_32.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 8,
			"address": "0x",
			"underlyingAddress": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
		},
		"weth": {
			"id": "weth",
			"name": "WETH",
			"index": "weth",
			"unit": "WETH",
			"logo": "./assets/images/tokens/weth_32.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 18,
			"address": "0x",
			"underlyingAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
		},
		"idk": {
			"id": "idk",
			"name": "IDK",
			"index": "idk",
			"unit": "IDK",
			"logo": "./assets/images/tokens/idk_32.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 8,
			"address": "0x",
			"underlyingAddress": "0x61fd1c62551850D0c04C76FcE614cBCeD0094498"
		},
		"ten": {
			"id": "ten",
			"name": "TEN",
			"index": "tokenomy",
			"unit": "TEN",
			"logo": "./assets/images/tokens/ten_32.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 18,
			"address": "0x",
			"underlyingAddress": "0xDD16eC0F66E54d453e6756713E533355989040E4"
		}
	}
}

change_environment = function(chainId){
	init_bridge();
	return true;
}

var syncCont = function(){
	return false;
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

var syncRate = function(){
	
	return;
	
}

var getBalance = async function(cToken, address){
			
	if(!address){
		return 0;
	}
	
	if(cToken.id=='eth'){
		var balance = await web3.eth.getBalance(address);
		balance = web3.utils.fromWei(balance);
		return balance;
	}
	
	var token = new web3.eth.Contract(erc20Abi, cToken.underlyingAddress);
	var balance = await token.methods.balanceOf(address).call();
	
	balance = balance / Math.pow(10, cToken.underlyingDecimals);
	
	return balance;
	
}

var syncAccount = async function(address){
	
	return;
}

var refreshData = function(){
	return;
}

function numberToString(num)
{
    let numStr = String(num);

    if (Math.abs(num) < 1.0)
    {
        let e = parseInt(num.toString().split('e-')[1]);
        if (e)
        {
            let negative = num < 0;
            if (negative) num *= -1
            num *= Math.pow(10, e - 1);
            numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
            if (negative) numStr = "-" + numStr;
        }
    }
    else
    {
        let e = parseInt(num.toString().split('+')[1]);
        if (e > 20)
        {
            e -= 20;
            num /= Math.pow(10, e);
            numStr = num.toString() + (new Array(e + 1)).join('0');
        }
    }

    return numStr;
}


/* bridge */

var init_bridge = async function(){
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	
	if(account){
		var tadBalance = await tadCont.methods.balanceOf(account).call();
	
		$('.val_tad_balance').html(toMaxDecimal(web3.utils.fromWei(tadBalance)));
	}
	
	
}

var convert_erc20 = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var bridge_amount = $('#erc20_convert_amount').val();
	var bridge_raw_amount = web3.utils.toWei(bridge_amount);
	
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	var bridgeCont =  new web3.eth.Contract(bridgeErc20Abi, ENV.bridgeAddress);
	
	var allowance = await tadCont.methods.allowance(account, ENV.bridgeAddress).call();
	allowance = allowance / Math.pow(10, 18);
	if(allowance<bridge_amount){ //allowance not enough, ask to approve
	
		pop_enable();
		return;
	}
	
	$('.go-convert-erc20').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
	await bridgeCont.methods.newBridgeRequest(bridge_raw_amount).send({from: account}, function(err, result){
		$('.go-convert-erc20 .mdi-loading').remove();
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
			  'TAD BEP20 will be sent to your address few minutes after the transaction is confirmed.<br /><br />'+result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}




var pop_enable = function(){
	
	$('#enable-form .val_coin_name').html('TADPOLE FINANCE');
	$('#enable-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_enable(); return false;');
	
	$.magnificPopup.open({
		items: {
			src: '#enable-form',
			type: 'inline'
		},
		showCloseBtn: false
	});
}

var go_enable = async function(){
	
	$('#enable-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	var raw_amount = 1000000*Math.pow(10, 18);
	var allowance = await tadCont.methods.approve(ENV.bridgeAddress, numberToString(raw_amount)).send({
		from: account,
		gas: gasLimitApprove
	}, function(err, result){
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
			  'Please wait the transaction to be confirmed, then you can start to swap token.<br /><br />'+result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var addTadToMetamask = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}

	await ethereum.request({
	method: 'wallet_watchAsset',
	params: {
	  type: 'ERC20', // Initially only supports ERC20, but eventually more!
	  options: {
		address: ENV.tadAddress, // The address that the token is at.
		symbol: 'TAD', // A ticker symbol or shorthand, up to 5 chars.
		decimals: 18, // The number of decimals in the token
		image: 'http://app.tadpole.finance/assets/images/new-logo/Logo-Tadpole-128x128px.png', // A string url of the token logo
	  },
	},
	});
}





var toMaxDecimal = function(num, max=8){
	if(typeof num=='float') num = num.toString();
	
	if(!num) return '0';
	num = num+"";
	
	var tmp = num.split('.');
	
	if(!tmp[1]){
		return tmp[0];
	}
	
	var decNow = tmp[1].length;
	
	if(decNow>max){
		num = tmp[0]+'.'+tmp[1].substring(0, max);
	}
	return num;
}




$(function(){
	init_bridge();

	setInterval(function(){
		init_bridge();
	}, 60000);
});