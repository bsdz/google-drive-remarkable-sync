AUTH_HOST = "https://webapp-production-dot-remarkable-production.appspot.com";

class RemarkableAPI {

  constructor(deviceId = null, deviceToken = null, oneTimeCode = null) {
    // oneTimeCode from ${AUTH_HOST}/connect/mobile
    if (deviceToken === null && oneTimeCode === null) {
      throw "Need at least either device-token or one-time-code";
    }

    if (deviceId === null) {
      Logger.log("Creating new Remarkable device id..");
      this.deviceId = Utilities.getUuid();
    }
    else {
      Logger.log("Using existing Remarkable device id..");
      this.deviceId = deviceId;
    }    
    
    if (deviceToken === null) {
      Logger.log("Requesting new Remarkable device token from one time code..");
      this.deviceToken = this.constructor._getDeviceToken(this.deviceId, oneTimeCode);
    }
    else {
      Logger.log("Using existing Remarkable device token..");
      this.deviceToken = deviceToken;
    }
    
    this.userToken = this.constructor._getUserToken(this.deviceToken);
    this.storageHost = this.constructor._getStorageHost(this.userToken);
  }


  // https://github.com/splitbrain/ReMarkableAPI/wiki/Authentication

  static _getDeviceToken(deviceId, oneTimeCode) {
    let data = {
      "code": oneTimeCode, // one-time code from website
      "deviceDesc": "desktop-windows",
      "deviceID": deviceId
    };
    let options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(data)
    };
    // https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
    let response = UrlFetchApp.fetch(`${AUTH_HOST}/token/json/2/device/new`, options);
    let deviceToken = response.getContentText()
    //Logger.log(`Received device token: ${deviceToken}`);
    return deviceToken;
  }

  static _getUserToken(deviceToken) {
    let options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify({}),
      'headers': {
        'Authorization': `Bearer ${deviceToken}`
      }
    };
    let response = UrlFetchApp.fetch(`${AUTH_HOST}/token/json/2/user/new`, options);
    let userToken = response.getContentText()
    //Logger.log(`Received user Token: ${userToken}`);
    return userToken;
  }

  // https://github.com/splitbrain/ReMarkableAPI/wiki/Service-Discovery

  static _getStorageHost(userToken) {
    let options = {
      'method': 'get',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${userToken}`
      }
    };
    let response = UrlFetchApp.fetch('https://service-manager-production-dot-remarkable-production.appspot.com/service/json/1/document-storage?environment=production&group=auth0%7C5a68dc51cb30df3877a1d7c4&apiVer=2', options);
    let text = response.getContentText()
    let data = JSON.parse(text);
    if (data["Status"] == "OK") {
      Logger.log(`Remarkable cloud storage host: ${data["Host"]}`);
      return data["Host"];
    }
    else {
      return null;
    }
  }
  
  // https://github.com/splitbrain/ReMarkableAPI/wiki/Storage

  listDocs(docUuid4 = null, withBlob = null) {
    Logger.log("Fetching doc list from Remarkable cloud");
    let options = {
      'method': 'get',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      }
    };
    let params = [];
    if (docUuid4 !== null) {
      params.push(`doc=${docUuid4}`);
    }
    if (withBlob !== null) {
      params.push(`withBlob=1`);
    }
    let urlParams = "";
    if (params.length > 0) {
       urlParams = "?" + params.join("&");
    }
    let response = UrlFetchApp.fetch(`https://${this.storageHost}/document-storage/json/2/docs${urlParams}`, options);
    let text = response.getContentText();
    let data = JSON.parse(text);
    return data;
  }

  findDocUUID(name) {
    // TODO: should accept a path
    let allDocs = this.listDocs();
    let filteredDocs = allDocs.filter((r) => r["VissibleName"] == name);
    if (filteredDocs.length > 0) {
      return filteredDocs[0]["ID"];
    }
    else {
      return null;
    }
  }

  uploadRequest(data) {
    let payloadData = data.map((r) => (
      ({ ID, Type, Version }) => ({ ID, Type, Version }))(r));

    let options = {
      'method': 'put',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      },
      'payload': JSON.stringify(payloadData)
    };
    let response = UrlFetchApp.fetch(`https://${this.storageHost}/document-storage/json/2/upload/request`, options);
    let text = response.getContentText()
    let res = JSON.parse(text);
    return res;
  }

  blobUpload(url, zipBlob) {
    let bytes = zipBlob.getBytes();
    let options = {
      'method': 'put',
      'contentType': "", // needs to blank!
      'contentLength': bytes.length,
      //'payload': bytes,
      'payload': zipBlob,
      //'muteHttpExceptions': true // for debugging
    };
    let response = UrlFetchApp.fetch(url, options);
    //let response = UrlFetchApp.getRequest(url, options);

    if (response.getResponseCode() != 200) {
     throw "Blob upload failed."; 
    }
  }

  uploadUpdateStatus(data) {
    let payloadData = data.map((r) => (
      ({ ID, Type, Version, Parent, VissibleName }) => ({ ID, Type, Version, Parent, VissibleName }))(r));

    let options = {
      'method': 'put',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      },
      'payload': JSON.stringify(payloadData)
    };
    let response = UrlFetchApp.fetch(`https://${this.storageHost}/document-storage/json/2/upload/update-status`, options);
    let text = response.getContentText()
    let res = JSON.parse(text);
    return res;
  }

  delete(data) {
    let payloadData = data.map((r) => (
      ({ ID, Version }) => ({ ID, Version }))(r));

    let options = {
      'method': 'put',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      },
      'payload': JSON.stringify(payloadData)
    };
    let response = UrlFetchApp.fetch(`https://${this.storageHost}/document-storage/json/2/delete`, options);
    let text = response.getContentText()
    let res = JSON.parse(text);
    Logger.log(res);
    return res;
  }

}
