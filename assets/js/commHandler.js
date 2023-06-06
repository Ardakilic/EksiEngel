import {log} from './log.js';
import {config} from './config.js';
import * as enums from './enums.js';

class CommHandler 
{
	sendData = async (dataObj) =>
	{
		let dataToServerObj = {};
		
    // client_name
		if(config.sendClientName)
		{
			if(dataObj.client_name)
				dataToServerObj.client_name = dataObj.client_name;
			else
				dataToServerObj.client_name = config.erroneousText;
		}
		else
		{
			dataToServerObj.client_name = config.anonymouseClientName;
		}
    
    // user_agent
    if(dataObj.user_agent)
      dataToServerObj.user_agent = dataObj.user_agent;
    else
      dataToServerObj.user_agent = config.erroneousText;
    
    // ban_source
    dataToServerObj.ban_source = dataObj.ban_source;
    
    // ban_mode
    dataToServerObj.ban_mode = dataObj.ban_mode;

    // fav_entry_id
		if(dataObj.fav_entry_id)
			dataToServerObj.fav_entry_id = dataObj.fav_entry_id;
		else
			dataToServerObj.fav_entry_id = config.erroneousInt;
    
    // fav_author_name and fav_author_id
		if(dataObj.fav_author_name)
			dataToServerObj.fav_author_name = dataObj.fav_author_name;
		else
			dataToServerObj.fav_author_name = config.erroneousText;
		
		if(dataObj.fav_author_id)
			dataToServerObj.fav_author_id = dataObj.fav_author_id;
		else
			dataToServerObj.fav_author_id = config.erroneousInt;
    
    // fav_title_name and fav_title_id
		if(dataObj.fav_title_name)
			dataToServerObj.fav_title_name = dataObj.fav_title_name;
		else
			dataToServerObj.fav_title_name = config.erroneousText;

		if(dataObj.fav_title_id)
			dataToServerObj.fav_title_id = dataObj.fav_title_id;
		else
			dataToServerObj.fav_title_id = config.erroneousInt;
    
    // author_list_size
    dataToServerObj.author_list_size = dataObj.author_list_size;

    // author_name_list and author_id_list
    if(dataObj.author_name_list.join("").length >= 100000 || dataObj.author_id_list.join("").length >= 100000)
    {
      // db will not save this result so truncate, first 2000 value
      dataToServerObj.author_name_list = dataObj.author_name_list.splice(0,2000);
      dataToServerObj.author_id_list = dataObj.author_id_list.splice(0,2000);
      dataToServerObj.author_list_size = dataToServerObj.author_name_list.length;
      log.warn("commHandler: author list exceeds limit, truncated to " + dataToServerObj.author_list_size); 
    }
    else
    {
      dataToServerObj.author_name_list = dataObj.author_name_list;
      dataToServerObj.author_id_list = dataObj.author_id_list; 
    }

    // total_action and successful_action action
    dataToServerObj.total_action = dataObj.total_action;
    dataToServerObj.successful_action = dataObj.successful_action;
		
    // is_early_stopped
    dataToServerObj.is_early_stopped = dataObj.is_early_stopped;
    
    // log_level and log
		if(config.sendLog && log.isEnabled)
		{
			dataToServerObj.log_level = log.getLevel();
			dataToServerObj.log = log.getData();
		}
		else
		{
      dataToServerObj.log_level = "DISABLED";
			dataToServerObj.log = config.erroneousText;
		}
    
		try
		{
			const response = await fetch(config.serverURL, {
				method: 'POST',
				headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataToServerObj)
			});
      const responseText = await response.text();
			log.info("commHandler: response status: " + response.status); 
			log.info("commHandler: response : " + responseText); 
		}
		catch(err)
		{
			log.err("commHandler: err: " + err); 
		}
	}

  sendAnalyticsData = async (dataObj) =>
  {
    /*
    let dataToServerObj = {};
    
    // client_name
	  dataToServerObj.client_name = config.anonymouseClientName;
    
    // user_agent
    dataToServerObj.user_agent = "TODO fix";
    
    // client uid
    dataToServerObj.client_uid = 123456;
    
    // click type
    dataToServerObj.click_type = dataObj.click_type;
  
    try
    {
      const response = await fetch(config.serverAnalyticsURL, {
        method: 'POST',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToServerObj)
      });
      const responseText = await response.text();
      log.info("commHandler: response status: " + response.status); 
      log.info("commHandler: response : " + responseText); 
    }
    catch(err)
    {
      log.err("commHandler: err: " + err); 
    }
    */
  }
  
}

export let commHandler = new CommHandler();