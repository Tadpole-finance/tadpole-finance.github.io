if (location.protocol !== 'https:' && location.hostname !== "localhost") { //force https
    location.replace(`https:${location.href.substring(location.protocol.length)}`);
}


  

var development_alert = function(){
	Swal.fire(
	  'Coming soon!',
	  '',
	  'info'
	)
}


$(function(){
	var canvs = document.getElementById("fishHolder");
	canvs.width = window.innerWidth;
	canvs.height = window.innerHeight;
	$('#fishHolder').fishAnimation();
	
	fetch("./header.html")
	  .then(response => {
		return response.text()
	  })
	  .then(data => {
		document.querySelector("header").innerHTML = data;
		if ( typeof hideMetamask !== 'undefined' && hideMetamask ) $('.metamask-container').remove();
	  });

	fetch("./footer.html")
	  .then(response => {
		return response.text()
	  })
	  .then(data => {
		document.querySelector("footer").innerHTML = data;
	  });
});