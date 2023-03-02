import * as enums from './enums.js';
import * as utils from './utils.js';

export let config = 
{
	"serverURL": 				"https://eksiengel.hesimsek.com/client_data_collector/upload",
	"sendData": 				true,														  /* send data to server */
		"sendClientName": true,															/* send client name to server */
		"sendLog": 				true,															/* send log data to server */
	
	"enableLog": 				true,														  /* enable/disable logger */
		"logConsole": 		true, 														/* log into console as well */
    
  "enableNoobBan":    false,                            /* enable/disable noob author scraping for FAV */
  "enableMute":       false,                            /* enable/disable TargetType.MUTE operations */
	
	"anonymouseClientName": "anonymouse",									/* client name if sendClientName false */
	"erroneousText": 				"",											      /* default text if smt goes wrong */
	"erroneousInt": 				"0", 													/* default int if smt goes wrong */
};

export async function getConfig()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("config", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined && items.config != undefined && Object.keys(items.config).length !== 0)
        {
          resolve(items.config);  
        }
        else 
        {
          resolve(false);
        }
      }
      else 
      {
        resolve(false);
      }
    }); 
  });
}

export async function saveConfig(config)
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ "config": config }, function(){
      if(!chrome.runtime.error){
        resolve(true);
      }else{
        resolve(false);
      }
    });
  });
}

// load config from storage, if not exist save default config storage
export async function handleConfig()
{
  let c = await getConfig();
  if(c)
  {
    config = c;
  }
  else
  {
    saveConfig(config);
  }
}

// listen to update config from settings
chrome.runtime.onMessage.addListener(async function messageListener_Faq(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "config");
	if(obj.resultType === enums.ResultType.FAIL)
		return;
  
  // config in storage updated by settings, load it.
  await handleConfig();
});