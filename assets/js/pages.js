if (location.protocol !== 'https:' && location.hostname !== "localhost") { //force https
    location.replace(`https:${location.href.substring(location.protocol.length)}`);
}

fetch("./header.html")
  .then(response => {
    return response.text()
  })
  .then(data => {
    document.querySelector("header").innerHTML = data;
    if(hideMetamask) $('.metamask-container').remove();
  });

  const loadHtml = ((text, dest, replace = false) => {
		if (typeof dest == 'string') {
			dest = document.querySelector(dest);
		}
		const p = new DOMParser();
		const doc = p.parseFromString(text, 'text/html');
		const frag = document.createDocumentFragment();
		while (doc.body.firstChild) {
			frag.appendChild(doc.body.firstChild);
		}
		// handle script tags
		const ret = Promise.all(Array.from(frag.querySelectorAll('script'), script => new Promise(resolve => {
			const scriptParent = script.parentNode || frag;
			const newScript = document.createElement('script');
			if (script.src) {
				newScript.addEventListener('load', e => resolve({ src: script.src, loaded: true }));
				newScript.addEventListener('error', e => resolve({ src: script.src, loaded: false}));
				newScript.src = script.src;
			} else {
				newScript.textContent = script.textContent;
				resolve({ src: false, loaded: true });
			}
			scriptParent.replaceChild(newScript, script);
		})));
		if (replace) {
			dest.innerHTML = '';
		}
		dest.appendChild(frag);
		return ret;
	});
  
fetch("./footer.html")
  .then(response => {
    return response.text()
  })
  .then(data => {
    loadHtml(data, "footer")
  });
  

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
});