var gasLimitStakeUniswap = 500000;
var stakes = [];
const startMiningBlocknum = 11250000;

var uniswap_getClaimableTad = async function(address){
	var stakingCont =  new web3.eth.Contract(uniswapMiningAbi, ENV.uniswapMiningAddress);
	var stakerIndex = await stakingCont.methods.stakerIndexes(address).call();
	var stakerPower = await stakingCont.methods.stakerPower(address).call();
	var currentBlock = await web3.eth.getBlockNumber();
	var miningState = await stakingCont.methods.getMiningState(currentBlock).call();
	
	var deltaIndex = (new BN(miningState[0])).sub(new BN(stakerIndex));
	var tadDelta = web3.utils.fromWei((new BN (deltaIndex)).mul(new BN(stakerPower)));
	
	tadDelta = tadDelta.replace(/\.[0-9]+$/, ''); //remove decimals
	
	return tadDelta;
	
}

var init_staking = async function(){
	
	var block = await web3.eth.getBlockNumber();
	if(block<startMiningBlocknum){
		$('.uniswap-total-stake').html('-');
		$('#stakes-loading').addClass('d-none');
		$('#no-active-stakes, .staking-not-started').removeClass('d-none');
		$('.my-stake').html('-');
		$('.tad-to-claim').html('-');
		$('.val_lp_balance').html('-');
		return;
	}
	
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	var lpCont =  new web3.eth.Contract(tadLpAbi, ENV.lpAddress);
	var stakingCont =  new web3.eth.Contract(uniswapMiningAbi, ENV.uniswapMiningAddress);
	//~ var wethCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.weth.address);
	
	//~ var total_tad_staked = await stakingCont.methods.totalStaked().call();
	//~ var total_tad_staked = web3.utils.fromWei(total_stake);
	
	//~ var total_eth_staked = await stakingCont.methods.totalStakedPower().call();
	//~ var total_eth_staked = web3.utils.fromWei(total_power);
	
	var miningStateBlock = await stakingCont.methods.miningStateBlock().call();
	var startMiningBlockNum = await stakingCont.methods.startMiningBlockNum().call();
	var totalStakingBlockNum = 2500000;
	var stakingProgressPercent = ((miningStateBlock-startMiningBlockNum)/totalStakingBlockNum*100).toFixed(2);
	
	var stakingPercentageString = stakingProgressPercent+"%";
	$('.staking-percentage').html(stakingPercentageString).css({width: stakingPercentageString}).attr('aria-valuenow', stakingProgressPercent).attr('aria-valuemin', stakingProgressPercent);
	$('.progress').attr('title', stakingPercentageString);
	
	
	var total_stake = web3.utils.fromWei(await stakingCont.methods.totalStaked().call());
	$('.uniswap-total-stake').html(toMaxDecimal(total_stake, 2));
	var totalStakedPower = web3.utils.fromWei(await stakingCont.methods.totalStakedPower().call());
	$('.totalStakedPower, .uniswap-totalStakedPower').html(toMaxDecimal(totalStakedPower, 2));
	
	
	var ethTadPrices = await getEthTadPrices();
	var uniswapLpSupply = web3.utils.fromWei(await lpCont.methods.totalSupply().call());
	var reserves = await lpCont.methods.getReserves().call();
	
	var reserveTad = web3.utils.fromWei(reserves._reserve0);
	var reserveEth = web3.utils.fromWei(reserves._reserve1);
	
	console.log(uniswapLpSupply, reserveTad, reserveEth);
	
	$('.reserveEth').html(toMaxDecimal(reserveEth, 2));
	$('.reserveTad').html(toMaxDecimal(reserveTad, 2));
	
	$('.lpSupply').html(toMaxDecimal(uniswapLpSupply, 2));
	
	$('.ethPrice').html(toMaxDecimal(ethTadPrices.ETH, 3));
	$('.tadPrice').html(toMaxDecimal(ethTadPrices.TAD, 3));
	
	//{TAD price} * {staking distribution} / ( {ETH reserve} * {ETH price} + {TAD reserve} * {TAD price} } * {LP Supply} / {Staked LP} * 100%
	var apy = ethTadPrices.TAD*200000 / (reserveEth * ethTadPrices.ETH +  reserveTad * ethTadPrices.TAD) * uniswapLpSupply / total_stake * 100;
	
	$('.apyStaking0').html(toMaxDecimal(apy*0.2, 2));
	$('.apyStaking30').html(toMaxDecimal(apy*0.4, 2));
	$('.apyStaking90').html(toMaxDecimal(apy*0.6, 2));
	$('.apyStaking180').html(toMaxDecimal(apy*0.8, 2));
	$('.apyStaking360').html(toMaxDecimal(apy, 2));
	
	if(account){
		var lpBalance = await lpCont.methods.balanceOf(account).call();
		var lpStake = await stakingCont.methods.stakeHolders(account).call();
		var stakerPower = await stakingCont.methods.stakerPower(account).call();
		
		var claimableTad = await uniswap_getClaimableTad(account);
		var stakeCount = await stakingCont.methods.stakeCount(account).call();
		
		var stakesHtml = '';
		
		if(stakeCount > 0){
			stakesHtml = '';
			stakes = [];
			for(var i = 0; i < stakeCount; i++){
				stakes[i] = await stakingCont.methods.stakes(account, i).call();
				
				if(!stakes[i].exists) continue;
				
				var html = $($('#stake-template').html());
				$(html).find('.stake-amount').html(toMaxDecimal(web3.utils.fromWei(stakes[i].amount)));
				
				var powerText = '';
				switch(stakes[i].lockPeriod){
					case '2592000':
						powerText = 'x2';
						break;
					case '7776000':
						powerText = 'x3';
						break;
					case '15552000':
						powerText = 'x4';
						break;
					case '31104000':
						powerText = 'x5';
						break;
					default:
						powerText = 'x1';
				}
				
				$(html).find('.stake-power').html(powerText);
				
				$(html).find('button').attr('onclick', 'uniswap_go_unstake('+i+', \''+stakes[i].amount+'\');');
				
				var statusText = '';
				var lockedUntil = stakes[i].lockedUntil;
				var now = Date.now() / 1000;
				
				if(stakes[i].lockPeriod>0){
					var lockedForSecond = lockedUntil - now;
					if(lockedForSecond<0){
						statusText = 'Unlocked';
					}
					else{
						$(html).find('.unstake-button-container').html('-');
						if(lockedForSecond<3600){
							var minutes = Math.ceil(lockedForSecond/60);
							statusText = 'Locked until '+minutes+' minutes';
						}
						else if(lockedForSecond<86400){
							var hours = Math.ceil(lockedForSecond/3600);
							statusText = 'Locked until '+hours+' hours';
						}
						else{
							var days = Math.ceil(lockedForSecond/86400);
							statusText = 'Locked until '+days+' days';
						}
					}
				}
				else{
					statusText = 'Unlocked';
				}
				
				$(html).find('.stake-status').html(statusText);
				
				stakesHtml += $(html).prop('outerHTML');
			}
			
			$('#stakes-items').html(stakesHtml);
				
			$('#stakes-loading').addClass('d-none');
			$('#stakes-box').removeClass('d-none');
			$('#no-active-stakes').addClass('d-none');
		}
		else{
			$('#stakes-loading').addClass('d-none');
			$('#no-active-stakes').removeClass('d-none');
		}
	
		$('.val_lp_balance').html(toMaxDecimal(web3.utils.fromWei(lpBalance)));
		$('.my-stake, .val_lp_stake').html(web3.utils.fromWei(lpStake));
		$('.stakerPower').html(toMaxDecimal(web3.utils.fromWei(stakerPower), 2));
		$('.tad-to-claim').html(toMaxDecimal(web3.utils.fromWei(claimableTad)));
		$('#val_tad_avail').val(toMaxDecimal(web3.utils.fromWei(claimableTad)));
		
	}
	else{
		$('.my-stake').html('-');
		$('.stakerPower').html('-');
		$('.tad-to-claim').html('-');
		$('.val_lp_balance').html('-');
		$('#no-active-stakes').removeClass('d-none');
		$('#stakes-loading').addClass('d-none');
	}
	
	
}

var uniswap_prepare_stake = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var block = await web3.eth.getBlockNumber();
	if(block<startMiningBlocknum){
		Swal.fire(
		  'Error',
		  'Staking period will be started at block #'+startMiningBlocknum,
		  'error'
		)
		return;
	}
	
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	var lpCont =  new web3.eth.Contract(erc20Abi, ENV.lpAddress);
	var miningCont =  new web3.eth.Contract(uniswapMiningAbi, ENV.uniswapMiningAddress);
	
	var stake_amount = $('#stake_amount').val();
	var stake_raw_amount = web3.utils.toWei(stake_amount);
	
	var lp_balance = await lpCont.methods.balanceOf(account).call();
	
	if(!stake_amount){
		Swal.fire(
		  'Failed',
		  'Invalid staking amount',
		  'error'
		);
		return;
	}
	
	if(stake_amount>web3.utils.fromWei(lp_balance)*1){
		Swal.fire(
		  'Failed',
		  'LP balance not enough',
		  'error'
		);
		return;
	}
	
	var valid_periods = ["0", "30", "90", "180", "360"];
	var locked_period = $('#locked_period').val();
	
	if(!valid_periods.includes(locked_period)){
		Swal.fire(
		  'Failed',
		  'Invalid locking period',
		  'error'
		);
		return;
	}
	
	var allowance = await lpCont.methods.allowance(account, ENV.uniswapMiningAddress).call();
	
	
	if(web3.utils.fromWei(allowance)*1<stake_amount){ //allowance not enough, ask to approve
		
	
		$('.go-stake').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
		var uintmax = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
		await lpCont.methods.approve(ENV.uniswapMiningAddress, uintmax).send({from: account, gas: gasLimitApprove}, function(err, result){
			$('.go-stake .mdi-loading').remove();
			if (err) {
				$.magnificPopup.close();
				Swal.fire(
				  'Failed',
				  err.message,
				  'error'
				)
			} else {
				uniswap_go_stake();
			}
		});
	}
	
	else{
		uniswap_go_stake();
	}
}

var uniswap_go_stake = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	var lpCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.ten.underlyingAddress);
	var miningCont =  new web3.eth.Contract(uniswapMiningAbi, ENV.uniswapMiningAddress);
	
	var stake_amount = $('#stake_amount').val();
	var stake_raw_amount = web3.utils.toWei(stake_amount);
	
	var locked_period = $('#locked_period').val();
	var locking_period_seconds = 0;
	switch(locked_period){
		case '30':
			locking_period_seconds = 30*86400;
			break;
		case '90':
			locking_period_seconds = 90*86400;
			break;
		case '180':
			locking_period_seconds = 180*86400;
			break;
		case '360':
			locking_period_seconds = 360*86400;
			break;
		default:
			locking_period_seconds = 0;
	}
	
	$('.go-stake').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
	await miningCont.methods.stake(stake_raw_amount, locking_period_seconds).send({from: account, gas: gasLimitStakeUniswap}, function(err, result){
		$('.go-stake .mdi-loading').remove();
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}

var uniswap_go_unstake = async function(i, amount){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var tadCont =  new web3.eth.Contract(erc20Abi, ENV.tadAddress);
	var lpCont =  new web3.eth.Contract(erc20Abi, ENV.lpAddress);
	var miningCont =  new web3.eth.Contract(uniswapMiningAbi, ENV.uniswapMiningAddress);
	
	await miningCont.methods.unstake(i, amount).send({from: account}, function(err, result){
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}

var uniswap_go_claim = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var block = await web3.eth.getBlockNumber();
	if(block<startMiningBlocknum){
		Swal.fire(
		  'Error',
		  'Staking period will be started at block #'+startMiningBlocknum,
		  'error'
		)
		return;
	}
	
	var miningCont =  new web3.eth.Contract(uniswapMiningAbi, ENV.uniswapMiningAddress);
	
	$('.go-claim').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
	await miningCont.methods.claimTad().send({from: account}, function(err, result){
		$('.go-claim .mdi-loading').remove();
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}


var addLpToMetamask = async function(){
	
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
		address: ENV.lpAddress, // The address that the token is at.
		symbol: 'LPTAD', // A ticker symbol or shorthand, up to 5 chars.
		decimals: 18, // The number of decimals in the token
		image: '', // A string url of the token logo
	  },
	},
	});
}

var getEthTadPrices = async function(){
	let data = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
	  },
	  body: JSON.stringify({query: "{ \
		  tokens(where: {id_in: [\"0x9f7229af0c4b9740e207ea283b9094983f78ba04\"]}) {\
			id derivedETH symbol\
			}\
		  bundle(id: \"1\"){ ethPrice }	  }"})
	})
	  .then(r => r.json())
	  .then(data => {return data;});
	  
	  var ethPrice = data.data.bundle.ethPrice;
	  var tadPrice = data.data.tokens[0].derivedETH * ethPrice;
	  
	  return {TAD: tadPrice, ETH: ethPrice};
}







$(function(){
	if(page=='staking'){
		init_staking();

		setInterval(function(){
			init_staking();
		}, 60000);
	}
});

$(function () {
  $('[data-toggle="tooltip"]').tooltip({
	delay: 0,
	animation: false  
  })
})