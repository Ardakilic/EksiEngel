if (document.readyState == "complete") {
	// click to open the list of authors
  let dropDownListElement = document.getElementsByClassName("favorite-count")[1];
	dropDownListElement.click();
	
	let dropDownList;
	let values = [];
	
	try
	{
		// get list of authors
		dropDownList = document.getElementsByClassName("favorite-list-popup toggles-menu open")[0].firstChild.firstChild.getElementsByTagName("li");
		for(var i=0;i < dropDownList.length; i++) {
			if (dropDownList[i].innerText.length) { values.push((dropDownList[i].innerText.replace(/\s/g,''))); }
		}
		
		// delete '@' char from nicknames
		for(var i=0;i < values.length; i++) {
			values[i] = values[i].substr(1)
		}
		
		// 'çaylak' authors are not wanted
		if(values[values.length-1].substr(-6,6) === "çaylak")
			values.pop()
		
		let authorListString = values.join("\n");
		
		// save the list to local storage api
		chrome.storage.local.set({"userList": authorListString }, function(){
			if(!chrome.runtime.error){
				console.log("Author list saved into local storage");
				// send start msg to background.js
				chrome.runtime.sendMessage(null, "scriptScrapAuthorsFromEntry::start");
			}else{
				console.log("chrome.storage.local.set runtime error");
				alert("chrome.storage.local.set runtime error");
			}
		});
		
		console.log("number of authors obtained: " + len(authorListString));
	}
	catch
	{
		console.log("scriptScrapAuthorsFromEntry: Author list could not be obtained.");
	}
	
	// click to close the list of authors
	dropDownListElement.click();

}