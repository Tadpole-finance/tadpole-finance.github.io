
var bsc_url = 'https://bsc-dataseed1.defibit.io';


var web3 = new Web3(new Web3.providers.HttpProvider(bsc_url));

var account;

var connectMetamask = async function(){
	
	
	if (typeof window.ethereum == 'undefined' || !ethereum.isMetaMask) {
		
		if (/Mobi|Android/i.test(navigator.userAgent)) {
			Swal.fire(
			  '',
			  'From your phone, open this website from MetaMask application.<br /><br />To get Metamask: <a href="https://metamask.io/download.html" target="_blank">https://metamask.io/download.html</a>.',
			  'info'
			)
			return;
		}
		
		Swal.fire(
		  'Error',
		  'You need a MetaMask plugin in your browser.<br /><br />To get Metamask: <a href="https://metamask.io/download.html" target="_blank">https://metamask.io/download.html</a>.',
		  'error'
		)
		return;
	}
	
	var accounts = await ethereum.request({ method: 'eth_requestAccounts' });
	account = accounts[0];
	
	
	const eth_chainId = await ethereum.request({ method: 'eth_chainId' });
	
	//force bsc
	if(eth_chainId!='0x38'){ //bsc
		Swal.fire(
		  'Error',
		  'Saving and Lending app is only available on Binance Smart Chain network. Change your Metamask network to Binance Smart Chain to use this app.',
		  'error'
		);
		return;
	}
	
	web3 = new Web3(ethereum);
	
	if(!change_environment(eth_chainId)){
		console.log('eth_chainId', eth_chainId);
		return;
	}
	
	$('#btn_connect_metamask').html('Connected<span>: '+account.substring(0, 6)+'..'+account.substring(account.length-4, account.length)+'</span>');
	
}

ethereum.on('accountsChanged', async (accounts) => {
	
	eth_chainId = await ethereum.request({ method: 'eth_chainId' });
	
	//force bsc
	if(eth_chainId!='0x38'){ //bsc
		//~ Swal.fire(
		  //~ 'Error',
		  //~ 'Saving and Lending app is only available on Binance Smart Chain network. Change your Metamask network to Binance Smart Chain to use this app.',
		  //~ 'error'
		//~ );
		return;
	}
	
	
	account = accounts[0];
	
	web3 = new Web3(ethereum);
	
	$('#btn_connect_metamask').html('Connected<span>: '+account.substring(0, 6)+'..'+account.substring(account.length-4, account.length)+'</span>');
	
	change_environment(eth_chainId);
});

ethereum.on('networkChanged', async (chainId) => {
	
	//force bsc
	if(chainId!='0x38'){ //bsc
		//~ Swal.fire(
		  //~ 'Error',
		  //~ 'Saving and Lending app is only available on Binance Smart Chain network. Change your Metamask network to Binance Smart Chain to use this app.',
		  //~ 'error'
		//~ );
		return;
	}
	
	change_environment(chainId);
});

$(function(){
	if(typeof ethereum!== 'undefined'){
		//connectMetamask();
	}
});