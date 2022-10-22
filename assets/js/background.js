'use strict';

try {
  importScripts("enums.js", "config.js", "log.js");
} catch (error) {
  console.error(error);
}

// log.js will be imported first, so others can use logger
let log = new Log();
log.setEnableStatus = config.enableLog;
log.setLogConsole = config.logConsole;
log.setlevel = Log.Levels.INFO;
log.info("bg: init");

try {
	importScripts("redirectHandler.js", "commHandler.js", "utils.js", "backgroundUndobanAll.js");
} catch (error) {
	console.error(error);
}

let redirectHandler = new RedirectHandler();
let commHandler = new CommHandler(log);

let g_isProgramActive = false;        // to prevent multiple starts from gui
let g_earlyStopCommand = false;       // early stop command might be recevied from gui to stop program execution
let g_tabId = -1;                     // tab id of the new tab (will be assigned by browser)

let g_counter = 0;                    // number of times the page is loaded (for every author's page)
let g_latestContentScriptInfo = "";   // JSON Obj, info about latest executed content script
let g_url = "";                       // target url
let g_isTabClosedByUser = false;      // user might close the tab before program finished
let g_isBanUserSuccessfull = false;   // is target user banned successfully
let g_isBanTitleSuccessfull = false;  // is target user's titles banned succesfully
let g_resolveSelectiveBanProcess;     // function, resolve function of process_SelectiveBan's promise
let g_rejectSelectiveBanProcess;      // function, reject function of process_SelectiveBan's promise
let g_isFirstAuthor = true;           // is the program tries to ban the first user in list
let g_clientName = "";                // client's author name
let g_banMode = "mode::ban";		    	// mode of the program, will ban or undoban
    
chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	if(g_isProgramActive)
	{
		log.info("bg: another start attempt from " + message);
	}
	else 
	{
		g_isProgramActive = true; // prevent multiple starts
		
		if(message === 'scrapeAuthors::start')
		{
			// list is exist in storage
			await processHandler_SelectiveBan(BanSource.FAV, "mode::ban");
		}
    else if(message === 'authorListPage::ban')
    {
      // list is exist in storage
			await processHandler_SelectiveBan(BanSource.LIST, "mode::ban");
    }
		else if(message === 'authorListPage::undoban')
		{
			// list is exist in storage
			await processHandler_SelectiveBan(BanSource.LIST, "mode::undoban");
		}
		else if(message === 'popup::undobanAll')
		{
			await processHandler_UndobanAll();
		}
		
		g_isProgramActive = false; // program can be started again
	}
});

async function processHandler_SelectiveBan(banSource, mode="mode::ban")
{
  log.info("Program has been started with mode: " + mode);
  
  let userListArray = await getUserList();
  log.info("number of user to ban (before cleaning): " + userListArray.length);
  cleanUserList(userListArray);
  log.useful("number of user to ban (after cleaning): " + userListArray.length);
  
  if(userListArray.length == 0){
    makeNotification("Programı kullanmak için yazar ekleyin.");
    log.err("Program has been finished (getUserList function failed)");
  }
  else{
    // register function to call every time a page is closed
    chrome.tabs.onRemoved.addListener(pageCloseListener);
    
    // register function to call every time the page is updated
    // Note: chrome.tabs.onUpdated doesn't work properly
    chrome.webNavigation.onDOMContentLoaded.addListener(DOMContentLoadedListener)
    
    // register function to call every time a content script sends a message
    chrome.runtime.onMessage.addListener(contentScriptMessageListener);
    
    RedirectHandler.prepareHandler();
    g_tabId = -1; // clear variable
    g_isFirstAuthor = true;
		g_banMode = mode;
    
    let successfullBans = 0;
    let pageResult;
    for(let i = 0; i < userListArray.length; i++) {
      
      pageResult = await process_SelectiveBan(userListArray[i]); // navigate to next url
      
      if(pageResult.result === "promise::success"){
        successfullBans++;
        log.info("page result: success (" + userListArray[i] +")");
      } else {
        log.info("page result: fail (" + userListArray[i] +")");
      }
      
      // early stop mechanism
      if(g_earlyStopCommand) {
        g_earlyStopCommand = false; // clear to reuse this variable
        break;
      }
    }
    
    log.info("contentScriptMessageListener removed.");
    chrome.runtime.onMessage.removeListener(contentScriptMessageListener);
    
    log.info("DOMContentLoadedListener removed.");
    chrome.tabs.onUpdated.removeListener(DOMContentLoadedListener);
    
    log.info("pageCloseListener removed.");
    chrome.tabs.onRemoved.removeListener(pageCloseListener);

		if(mode === "mode::ban")
		{
			makeNotification(userListArray.length + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
			log.useful("Program has been finished (banned:" + successfullBans + ", total:" + userListArray.length + ")");
		}
		else if(mode === "mode::undoban")
		{
			makeNotification(userListArray.length + ' kisilik listedeki ' + successfullBans + ' kisinin engeli kaldirildi.');
			log.useful("Program has been finished (unbanned:" + successfullBans + ", total:" + userListArray.length + ")");
		}
    
		if(config.sendData)
      // TODO: "BAN" will be replaced with variable
			await commHandler.sendData(config, g_clientName, banSource, "BAN", userListArray)
		
		await closeLastTab(pageResult.tabID);
  }  
}

// this function will be called every time any page is closed (iframes will call as well)
function pageCloseListener(tabid, removeInfo)
{
  if(g_tabId === tabid && !g_isTabClosedByUser)
  {
    // this is required because chrome.tabs.onRemoved fired multiple times
    // each by main page and iframes
    g_isTabClosedByUser = true;
    
    log.info("tab " + tabid + " closed by user");
    log.info("automatically early stop command was generated to stop the process.")
    g_earlyStopCommand = true;
      
    // resolve Promise after content script has executed
    g_resolveSelectiveBanProcess({result:"promise::fail", tabID: g_tabId});
  }
}

// this function will be called every time any page is updated (when domcontent loaded)
function DOMContentLoadedListener(details) 
{
  // filter other page updates by using tab id
  if(details.tabId === g_tabId && decodeURIComponentForEksi(details.url) === g_url) {
    g_counter++;
    log.info("g_counter: " + g_counter + " tab id: "+ details.tabId + " frame id: " + details.frameId + " url: " + details.url);
    
    // saved values from latest executed content script
    let res = g_latestContentScriptInfo.res;
    let op = g_latestContentScriptInfo.op;
    //let mode = g_latestContentScriptInfo.mode;
    let target = g_latestContentScriptInfo.target;
    
    // outgoing values to content script
    let executeOp = "";
    let executeTarget = "";
    
    if(g_counter === 1){
      RedirectHandler.stopRedirectTimer();
			if(g_isFirstAuthor)
			{
				g_isFirstAuthor = false;
				chrome.scripting.executeScript({
					target: {tabId: g_tabId, frameIds: [0]}, // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
					files: ["assets/js/contentScript_ScrapeClientName.js"]},
					()=>
					{
						log.info("contentScript_ScrapeClientName.js has been executed.");
						// execute content script to ban user
						executeOp = "op::action";
						executeTarget = "target::user";
						executeContentScript(executeOp, g_banMode, executeTarget);
					}
				);
			}
			else
			{
				// execute content script to ban user
				executeOp = "op::action";
				executeTarget = "target::user";
				executeContentScript(executeOp, g_banMode, executeTarget);
			}
    }
    else if(op === "op::action" && target === "target::user" && res === "res::success"){
      // res::fail will be handled by contentScriptMessageListener
      executeOp = "op::control";
      executeTarget = "target::user";
      executeContentScript(executeOp, g_banMode, executeTarget);
    }
    else if(op === "op::action" && target === "target::title" && res === "res::success"){
      // res::fail will be handled by contentScriptMessageListener
      executeOp = "op::control";
      executeTarget = "target::title";
      executeContentScript(executeOp, g_banMode, executeTarget);
    }
    else{
      log.info("DOMContentLoadedListener: unhandled g_latestContentScriptInfo: " + JSON.stringify(g_latestContentScriptInfo));
    }
  }
}

// this function will be called every time a content script sends a message
function contentScriptMessageListener(message, sender, sendResponse) 
{
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
  
  //log.info("contentScriptMessageListener:: incoming msg: " + message);
  
  // incoming values from content script
  let incomingObj;
  try
  {
    incomingObj = JSON.parse(message);
  }
  catch(e)
  {
    log.info("contentScriptMessageListener:: parse err: " + e);
    return;
  }
	
	if(incomingObj.clientName)
	{
		g_clientName = incomingObj.clientName;
		log.useful("contentScriptMessageListener:: client name: " + g_clientName);
		return;
	}
	
  let res = incomingObj.res;
  let op = incomingObj.op;
  // let mode = incomingObj.mode;
  let target = incomingObj.target;
  
  // outgoing values to content script
  let executeOp = "";
  let executeTarget = "";
  
  // update status to track (it should be filtered, because popup messages interferes)
  if(res && op && target)
    g_latestContentScriptInfo = JSON.parse(message); 
  
  if(op === "op::action" && target === "target::user" && res === "res::fail"){
    // res::success will be handled by DOMContentLoadedListener
    executeOp = "op::control";
    executeTarget = "target::user";
    executeContentScript(executeOp, g_banMode, executeTarget);
  }
  else if(op === "op::control" && target === "target::user"){
    g_isBanUserSuccessfull = res === "res::success";
    // execute content to ban title after banning user and controlling is user banned
    executeOp = "op::action";
    executeTarget = "target::title";
    executeContentScript(executeOp, g_banMode, executeTarget);
  }
  else if(op === "op::action" && target === "target::title" && res === "res::fail"){
    // res::success will be handled by DOMContentLoadedListener
    // execute content script to check if banning the title was successfull
    executeOp = "op::control";
    executeTarget = "target::title";
    executeContentScript(executeOp, g_banMode, executeTarget);
  }
  else if(op === "op::control" && target === "target::title"){
    //all actions have been completed.
    
    g_isBanTitleSuccessfull = res === "res::success"; 
      
    // resolve Promise after content script has executed
    if(g_isBanUserSuccessfull && g_isBanTitleSuccessfull){
      g_resolveSelectiveBanProcess({result:"promise::success", tabID: g_tabId});
    }
    else {
      g_resolveSelectiveBanProcess({result:"promise::fail", tabID: g_tabId});
    }
    
  }
  else {
    log.info("contentScriptMessageListener:: unhandled msg: " + message);
  }  
}

async function process_SelectiveBan(userName) 
{
  return new Promise(async function(resolve, reject) {
    g_resolveSelectiveBanProcess = resolve;
    g_rejectSelectiveBanProcess = reject;
    
		g_url = "https://eksisozluk.com/biri/" + userName;
    log.info("page processing started for " + g_url);
    
    g_counter = 0; // reset
    g_latestContentScriptInfo = ""; // reset
    g_isBanUserSuccessfull = false;
    g_isBanTitleSuccessfull = false;
    g_isTabClosedByUser = false;
    
    g_tabId = await RedirectHandler.handleTabOperations(g_url);
  });
}

async function executeContentScript(op, mode, target)
{
  return new Promise(async (resolve, reject) => {
    let configText = op + " " + mode + " " + target;
    log.info("content script will be exed " + configText);
    
    let isTabExist = await isTargetTabExist(g_tabId);
    if(!isTabExist)
    {
      log.err("content script could not be executed. target tab is not exist. tab: " + g_tabId + " content: " + configText);
      return resolve(false);
    }
    
    // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
    chrome.scripting.executeScript(
      {
        // firstly this code will be executed
        target: {tabId: g_tabId, frameIds: [0]}, 
        func: (_op, _mode, _target)=>
        {
          window.configEksiEngelOp = _op;
          window.configEksiEngelMode = _mode;
          window.configEksiEngelTarget = _target;
        },
        args: [op, mode, target]
      }, 
      ()=>
      {
        if(chrome.runtime.lastError) 
        {
          log.err("content script could not be executed(part1), content: " + configText + " err: " + chrome.runtime.lastError.message);
          return resolve(false); // parent function will continue executing
        }
        
        // secondly this file will be executed
        chrome.scripting.executeScript(
          {
            target: {tabId: g_tabId, frameIds: [0]},
            files: ["assets/js/contentScript_SelectiveBan.js"]
          }, 
          ()=>
          {
            if(chrome.runtime.lastError) 
            {
              log.err("content script could not be executed(part2), content: " + configText + " err: " + chrome.runtime.lastError.message);
              return resolve(false); // parent functions will continue executing
            } 
            else 
            {
              log.info("content script has been executed, content: " + configText);
              return resolve(true); // parent functions will continue executing
            }
          }
        );
      }
    );
  });
}