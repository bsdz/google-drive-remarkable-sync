const DEBUG = true;

const AUTH_LOC = "https://webapp-production-dot-remarkable-production.appspot.com";
const SERV_MAN_LOC = "https://service-manager-production-dot-remarkable-production.appspot.com";
const BLOB_STORAGE_LOC = "https://rm-blob-storage-prod.appspot.com"

const NEW_DEVICE_TOKEN_PATH = "/token/json/2/device/new";
const NEW_USER_TOKEN_PATH = "/token/json/2/user/new";

// default sync / 1.0
const STORAGE_10_DOCS_PATH = "/document-storage/json/2/docs";
const STORAGE_10_UPLOAD_REQ_PATH = "/document-storage/json/2/upload/request";
const STORAGE_10_UPLOAD_STAT_PATH = "/document-storage/json/2/upload/update-status";
const STORAGE_10_DELETE_PATH = "/document-storage/json/2/delete";

// tortoise sync / 1.5
const STORAGE_15_DOWNLOADS_PATH = "/api/v1/signed-urls/downloads";
const STORAGE_15_UPLOADS_PATH = "/api/v1/signed-urls/uploads";
const STORAGE_15_SYNC_COMP_PATH = "/api/v1/sync-complete";


// original from  https://www.labnol.org/code/json-web-token-201128

const parseJsonWebToken = (jsonWebToken, privateKeyForValidate = null) => {
  const [header, payload, signature] = jsonWebToken.split('.');

  const blob = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
  const { exp, ...data } = JSON.parse(blob);
  if (new Date(exp * 1000) < new Date()) {
    throw new Error('The token has expired');
  }

  if (privateKeyForValidate != null) {
    const signatureBytes = Utilities.computeHmacSha256Signature(`${header}.${payload}`, privateKeyForValidate);
    const validSignature = Utilities.base64EncodeWebSafe(signatureBytes);
    if (signature !== validSignature.replace(/=+$/, '')) {
      Logger.log('Invalid JWT Signature');
    }
  }

  return data;
};


class RemarkableAPI {

  constructor(deviceId = null, deviceToken = null, oneTimeCode = null) {
    // oneTimeCode from ${AUTH_LOC}/connect/mobile
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

    // try and determine api version
    const jwtData = parseJsonWebToken(this.userToken);
    if (DEBUG) {
      Logger.log(`JWT Data: ${JSON.stringify(jwtData)}`);
    }
    const scopes = jwtData["scopes"].split(" ");
    Logger.log(`Scopes: ${JSON.stringify(scopes)}`);

    if (scopes.includes("sync:default")) {
      Logger.log("Using Remarkable Storage API 1.0");
      this.storageAPI = new RemarkableStorage10API(this.userToken, this.storageHost);
    }
    else if (scopes.includes("sync:tortoise") || scopes.includes("sync:hare") || scopes.includes("sync:fox")) {
      Logger.log("Using Remarkable Storage API 1.5");
      this.storageAPI = new RemarkableStorage15API(this.userToken, this.storageHost);
    }
    else {
      throw new Error("Unsupported Remarkable API scope");
    }
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
    let response = UrlFetchApp.fetch(`${AUTH_LOC}${NEW_DEVICE_TOKEN_PATH}`, options);
    let deviceToken = response.getContentText()
    if (DEBUG) {
      Logger.log(`Received device token: ${deviceToken}`);
      Logger.log(`Received device token headers: ${JSON.stringify(response.getAllHeaders())}`);
    }
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
    let response = UrlFetchApp.fetch(`${AUTH_LOC}${NEW_USER_TOKEN_PATH}`, options);
    let userToken = response.getContentText()
    if (DEBUG) {
      Logger.log(`Received user token: ${userToken}`);
      Logger.log(`Received user token headers: ${JSON.stringify(response.getAllHeaders())}`);
    }
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
    //let response = UrlFetchApp.fetch(`${SERV_MAN_LOC}/service/json/1/document-storage?environment=production&group=auth0%7C5a68dc51cb30df3877a1d7c4&apiVer=2`, options);
    let response = UrlFetchApp.fetch(`${SERV_MAN_LOC}/service/json/1/document-storage?environment=production&apiVer=1`, options);
    let text = response.getContentText()
    let data = JSON.parse(text);
    if (DEBUG) {
      Logger.log(`Service Manager Data: ${JSON.stringify(data)}`);
    }
    if (data["Status"] == "OK") {
      Logger.log(`Remarkable cloud storage host: ${data["Host"]}`);
      return data["Host"];
    }
    else {
      return null;
    }
  }


  listDocs() {
    return this.storageAPI.listDocs();
  }

  uploadRequest(data) {
    return this.storageAPI.uploadRequest(data);
  }

  blobUpload(url, zipBlob) {
    return this.storageAPI.blobUpload(url, zipBlob);
  }

  uploadUpdateStatus(data) {
    return this.storageAPI.uploadUpdateStatus(data);
  }

  delete(data) {
    return this.storageAPI.delete(data);
  }

}


// https://github.com/splitbrain/ReMarkableAPI/wiki/Storage
class RemarkableStorage10API {
  constructor(userToken, storageHost) {
    this.userToken = userToken;
    this.storageHost = storageHost;
  }

  listDocs() {
    Logger.log("Fetching doc list from Remarkable cloud");

    let options = {
      'method': 'get',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      }
    };
    let response = UrlFetchApp.fetch(`https://${this.storageHost}${STORAGE_10_DOCS_PATH}`, options);
    let text = response.getContentText();
    let data = JSON.parse(text);

    return data;
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
    let response = UrlFetchApp.fetch(`https://${this.storageHost}${STORAGE_10_UPLOAD_REQ_PATH}`, options);
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
    let response = UrlFetchApp.fetch(`https://${this.storageHost}${STORAGE_10_UPLOAD_STAT_PATH}`, options);
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
    let response = UrlFetchApp.fetch(`https://${this.storageHost}${STORAGE_10_DELETE_PATH}`, options);
    let text = response.getContentText()
    let res = JSON.parse(text);
    Logger.log(res);
    return res;
  }
}

// https://docs.google.com/document/d/1peZh79C2BThlp2AC3sITzinAQKJccQ1gn9ppdCIWLl8/edit#heading=h.gixfe4nzlqxx

class RemarkableStorage15API {
  constructor(userToken, storageHost) {
    this.userToken = userToken;
    this.storageHost = storageHost;
    this.cache = new EnhancedCache(CacheService.getUserCache());
  }

  blobGet15(relativePath, useCache = true) {
    Logger.log(`blobGet: req path: ${relativePath}`);
    const cacheKey = `blobGet15_${relativePath}`;
    if (useCache) {
      let cached = this.cache.get(cacheKey);
      if (cached != null) {
        return [cached, null];
      }
    }
    let postOptions = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      },
      'payload': JSON.stringify({
        "method": "GET",
        "relative_path": relativePath
      })
    };
    let postResponse = UrlFetchApp.fetch(`${BLOB_STORAGE_LOC}${STORAGE_15_DOWNLOADS_PATH}`, postOptions);
    let postRespText = postResponse.getContentText();
    let postRespCode = postResponse.getResponseCode();
    if (DEBUG) {
      Logger.log(`blobGet: Response A: ${postRespCode}\nHeaders: ${JSON.stringify(postResponse.getAllHeaders())}\n${postRespText}`);
    }

    let postRespData = JSON.parse(postRespText);
    let getOptions = {
      'method': 'get',
      'contentType': 'application/json',
    };
    let getResponse = UrlFetchApp.fetch(postRespData["url"], getOptions);
    let getRespText = getResponse.getContentText();
    let getRespCode = getResponse.getResponseCode();
    let getRespHead = getResponse.getAllHeaders();
    if (DEBUG) {
      Logger.log(`blobGet: Response B: ${getRespCode}\nHeaders: ${JSON.stringify(getRespHead)}\n${getRespText}`);
    }
    this.cache.put(cacheKey, getRespText, 60 * 60);
    return [getRespText, getRespHead["x-goog-generation"]];
  }

  blobPut15(relativePath, putText, putGen = null) {
    Logger.log(`blobPut: req path: ${relativePath}`);
    let payload = {
      "method": "PUT",
      "relative_path": relativePath
    };
    if (putGen !== null) {
      payload["generation"] = putGen;
    }
    let postOptions = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      },
      'payload': JSON.stringify(payload)
    };
    Logger.log(JSON.stringify(postOptions));
    let postResponse = UrlFetchApp.fetch(`${BLOB_STORAGE_LOC}${STORAGE_15_UPLOADS_PATH}`, postOptions);
    let postRespText = postResponse.getContentText();
    let postRespCode = postResponse.getResponseCode();
    if (DEBUG) {
      Logger.log(`blobPut: Response A: ${postRespCode}\nHeaders: ${JSON.stringify(postResponse.getAllHeaders())}\n${postRespText}`);
    }

    let postRespData = JSON.parse(postRespText);
    let putOptions = {
      'method': 'put',
      'contentType': 'application/json',
      'payload': putText,
      'muteHttpExceptions': true
    };
    if (putGen !== null) {
      putOptions["headers"] = { "x-goog-if-generation-match": putGen };
    }
    let putResponse = UrlFetchApp.fetch(postRespData["url"], putOptions);
    let putRespText = putResponse.getContentText();
    let putRespCode = putResponse.getResponseCode();
    if (DEBUG) {
      Logger.log(`blobPut: Response B: ${putRespCode}\nHeaders: ${JSON.stringify(putResponse.getAllHeaders())}\n${putRespText}`);
    }
    return putRespText;
  }

  syncComplete15() {
    let postOptions = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'Authorization': `Bearer ${this.userToken}`
      }
    };
    let postResponse = UrlFetchApp.fetch(`${BLOB_STORAGE_LOC}${STORAGE_15_SYNC_COMP_PATH}`, postOptions);
    let postRespText = postResponse.getContentText();
    let postRespCode = postResponse.getResponseCode();
    if (DEBUG) {
      Logger.log(`syncComp: Response: ${postRespCode}\nHeaders: ${JSON.stringify(postResponse.getAllHeaders())}\n${postRespText}`);
    }
  }


  listDocs(useCache = true) {
    Logger.log("Fetching doc list from Remarkable cloud");

    const cacheKey = `listDocs15`;
    if (useCache) {
      let cached = this.cache.getObject(cacheKey);
      if (cached != null) {
        return cached;
      }
    }

    let data = [];

    let [root,] = this.blobGet15("root");
    let [rootIndex,] = this.blobGet15(root);
    //DriveApp.createFile('remarkableRootIndex.txt', rootIndex);

    let objs = rootIndex.trim().split("\n");
    objs.shift(); // TODO: assert this == 3
    Logger.log(`Found ${objs.length} items in Remarkable Cloud`);

    for (const [ix, obj] of objs.entries()) {
      let [gcsObjId, dummy1, uuid4, nEntries, dummy2] = obj.split(":");
      let [objIndex,] = this.blobGet15(gcsObjId);
      let recs = objIndex.trim().split("\n");
      recs.shift(); // TODO: assert this == 3
      //Logger.log(recs);
      for (const [ix, rec] of recs.entries()) {
        let [gcsRecId, dummy3, recFileName, dummy4, fileSize] = rec.split(":");
        if (recFileName.endsWith(".metadata")) {
          let [objMetaText,] = this.blobGet15(gcsRecId);
          let objMetaData = JSON.parse(objMetaText);
          data.push({
            "ID": uuid4,
            "Type": objMetaData["type"],
            "VissibleName": objMetaData["visibleName"],
            "Version": objMetaData["version"],
            "Parent": objMetaData["parent"],
          });
        }
      }
    }

    this.cache.putObject(cacheKey, data, 8 * 60 * 60);
    return data;
  }

  uploadRequest(data) {
    // TODO
  }

  blobUpload(url, zipBlob) {
    // TODO
  }

  uploadUpdateStatus(data) {
    // TODO
  }

  delete(data) {
    Logger.log(`Delete data: ${JSON.stringify(data)}`);

    // TODO: used cached rootIndex?
    let [root,] = this.blobGet15("root");
    let [rootIndex, genCode] = this.blobGet15(root, false); // no cache here
    //DriveApp.createFile('remarkableRootIndex.txt', rootIndex);

    let deletedUuids = data.map((r) => r["ID"]);

    // grep out the deleted IDs then upload again..
    let newObjs = [];
    let objs = rootIndex.trim().split("\n");
    newObjs.push(objs.shift()); // TODO: assert this == 3
    for (const [ix, obj] of objs.entries()) {
      let [gcsObjId, dummy1, uuid4, nEntries, dummy2] = obj.split(":");
      if (!deletedUuids.includes(uuid4)) {
        newObjs.push(obj);
      }
    }
    let newRootIndex = newObjs.join("\n");
    //DriveApp.createFile('remarkableRootIndex2.txt', newRootIndex);
    let resText = this.blobPut15("root", newRootIndex, genCode);
    this.syncComplete15();
    return resText;
  }

}

