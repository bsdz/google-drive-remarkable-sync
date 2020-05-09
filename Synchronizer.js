// https://stackoverflow.com/questions/23013573/swap-key-with-value-json/54207992#54207992
const reverseDict = (o, r = {}) => Object.keys(o).map(x => r[o[x]] = x) && r;


// https://github.com/30-seconds/30-seconds-of-code/blob/master/snippets/chunk.md
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

// emulate python's pop
const dictPop = (obj, key, def) => {
  if (key in obj) {
    let val = obj[key];
    delete obj[key];
    return val;
  } else if (def !== undefined) {
    return def;
  } else {
    throw `key ${key} not in dictionary` 
  }
}

/*  Main work here. Walks Google Drive then uploads 
 folder and files to Remarkable cloud storage. Currently
 only uploads PDFs. There appears to be a limitation
 with Remarkable that files must be less than 50MB so
 files greater than this size are filtered out.

Arguments:

rOneTimeCode - One time pass code from Remarkable that can typically
               be generated at https://my.remarkable.com/connect/mobile.
gdFolderSearchParams - Google Drive search SDK string or folder id.
rRootFolderName - The root folder in Remarkable device. Currently this
                  must already exist on your device.
gdFolderSkipList - Optional list of folder names to skip from syncing
forceUpdateFunc - Optional function of obj dictionaries, the first generated
                  from Google Drive, the second from Remarkable storage. The
                  function returns true/false and determines whether you 
                  wish to bump up the version and force push.

*/
class Synchronizer {
  constructor(rOneTimeCode, gdFolderSearchParams, rRootFolderName, gdFolderSkipList = [], forceUpdateFunc=null) {
    
    // try finding google folder by id first
    try {
      this.gdFolder = DriveApp.getFolderById(gdFolderSearchParams);
    } catch (err) {
      let gdSearchFolders = DriveApp.searchFolders(gdFolderSearchParams);
      if (gdSearchFolders.hasNext()) {
        this.gdFolder = gdSearchFolders.next();
      } else {
        throw `Could not find Google Drive folder using search params: ${gdFolderSearchParams}`;
      }
    }
    
    this.rRootFolderName = rRootFolderName;
    this.gdFolderSkipList = gdFolderSkipList;
    this.forceUpdateFunc = forceUpdateFunc;

    // for limits see https://developers.google.com/apps-script/guides/services/quotas
    this.userProps = PropertiesService.getUserProperties();

    // these are read from and cached to this.userProps
    this.gdIdToUUID = this.userProps.getProperties();
    
    // pop off keys not used for storing id/uuid mappings
    const rDeviceTokenKey = "__REMARKABLE_DEVICE_TOKEN__";
    let rDeviceToken = dictPop(this.gdIdToUUID, rDeviceTokenKey, null)

    // for storing reverse map
    this.UUIDToGdId = reverseDict(this.gdIdToUUID);
    
    // initialize remarkable api
    if (rDeviceToken === null) {
      this.rApiClient = new RemarkableAPI(null, rOneTimeCode);
      this.userProps.setProperty(rDeviceTokenKey, this.rApiClient.deviceToken);
    } else {
      this.rApiClient = new RemarkableAPI(rDeviceToken);
    }
    
    // prep some common vars
    this.rDocList = this.rApiClient.listDocs();

    // for debugging - dump doc list as json in root google drive folder
    //DriveApp.createFile('remarkable_doc_list.txt', JSON.stringify(this.rDocList));
    
    // create reverse dictionary
    this.rDocId2Ent = {}
    for (const [ix, doc] of this.rDocList.entries()) {
      this.rDocId2Ent[doc["ID"]] = ix;
    }

    // find root folder id
    // TODO if can't find it, create folder at top level with rRootFolderName
    let filteredDocs = this.rDocList.filter((r) => r["VissibleName"] == rRootFolderName);
    if (filteredDocs.length > 0) {
      this.rRootFolderId = filteredDocs[0]["ID"];
    }
    else {
      throw `Cannot find root file '${rRootFolderName}'`;
    }

  }

  getUUID(gdId) {
    if (!(gdId in this.gdIdToUUID)) {
      let uuid = Utilities.getUuid();
      this.gdIdToUUID[gdId] = uuid;
      this.UUIDToGdId[uuid] = gdId;
    }
    return this.gdIdToUUID[gdId];
  }

  generateZipBlob(gdFileId) {
    let uuid = this.getUUID(gdFileId);
    let gdFileObj = DriveApp.getFileById(gdFileId);
    let gdFileMT = gdFileObj.getMimeType();
    
    let zipBlob = null;
    
    if (gdFileMT == MimeType.FOLDER) {
      let contentBlob = Utilities.newBlob(JSON.stringify({})).setName(`${uuid}.content`);
      zipBlob = Utilities.zip([contentBlob]);
    } else { 
      let gdFileExt = gdFileObj.getName().split('.').pop();
      let gdFileBlob = gdFileObj.getBlob().setName(`${uuid}.${gdFileExt}`);
      let pdBlob = Utilities.newBlob("").setName(`${uuid}.pagedata`);
      let contentData = {
        'extraMetadata': {},
        'fileType': 'pdf',
        'lastOpenedPage': 0,
        'lineHeight': -1,
        'margins': 100,
        'pageCount': 0, // we don't know this, but it seems the reMarkable can count
        'textScale': 1,
        'transform': {} // no idea how to fill this, but it seems optional
      }
      let contentBlob = Utilities.newBlob(JSON.stringify(contentData)).setName(`${uuid}.content`);
      zipBlob = Utilities.zip([gdFileBlob, pdBlob, contentBlob]);
    }
    
    //DriveApp.createFile(zipBlob.setName(`rem-${uuid}.zip`)); // to debug/examine
    return zipBlob;
  }

  _walk(top, rParentId) {
    if (this.gdFolderSkipList.includes(top.getName())) {
      Logger.log(`Skipping Google Drive sub folder '${top.getName()}'`)
      return;
    }
    Logger.log(`Scanning Google Drive sub folder '${top.getName()}'`)
    let topUUID = this.getUUID(top.getId());
    this.uploadDocList.push({
      "ID": topUUID,
      "Type": "CollectionType",
      "Parent": rParentId,
      "VissibleName": top.getName(),
      "Version": 1,
      "_gdId": top.getId(),
      "_gdSize": top.getSize(),
    });

    let files = top.getFiles();
    while (files.hasNext()) {
      let file = files.next();
      this.uploadDocList.push({
        "ID": this.getUUID(file.getId()),
        "Type": "DocumentType",
        "Parent": topUUID,
        "VissibleName": file.getName(),
        "Version": 1,
        "_gdId": file.getId(),
        "_gdSize": file.getSize(),
      });
    }

    let folders = top.getFolders();
    while (folders.hasNext()) {
      let folder = folders.next();
      this._walk(folder, topUUID);
    }

  }
  
 // filter for upload list
 _needsUpdate(r) {
   if (r["ID"] in this.rDocId2Ent) {
     // update if parent or name differs
     let ix =  this.rDocId2Ent[r["ID"]];
     let s = this.rDocList[ix];
     
     // force update
     if (this.forceUpdateFunc !== null && this.forceUpdateFunc(r, s)) {
       // bump up to server version 
       r["Version"] = s["Version"] + 1;
       return true;
     }  
     
     // verbose so can set breakpoints
     if (s["Parent"] != r["Parent"] || s["VissibleName"] != r["VissibleName"]) {
       // bump up to server version 
       r["Version"] = s["Version"] + 1;
       return true;
     } else {
       return false;
     }
   }
   else {
     // 50MB = 50 * 1024*1024 = 52428800
     if (r["Type"] == "DocumentType" && r["VissibleName"].endsWith("pdf") && r["_gdSize"] <= 52428800) {
      return true; 
     } else if (r["Type"] == "CollectionType") {
       return true;
     } else {
       return false;
     }
   }
}  

  run() {
    try {
      // store all objects in this
      this.uploadDocList = [];

      // generate list from google drive
      Logger.log(`Scanning Google Drive folder '${this.gdFolder.getName()}'..`)
      this._walk(this.gdFolder, this.rRootFolderId);

      // save new user properties
      this.userProps.setProperties(this.gdIdToUUID);
      
      // filter those that need update
      let updateDocList = this.uploadDocList.filter((r) => this._needsUpdate(r));
      Logger.log(`Updating ${updateDocList.length} documents and folders..`)

      // chunk into 5 files at a time a loop
      for (const uploadDocChunk of chunk(updateDocList, 5)) {
        Logger.info(`Processing chunk of size ${uploadDocChunk.length}..`)

        // extract data for registration
        let uploadRequestResults = this.rApiClient.uploadRequest(uploadDocChunk);

        // upload files
        let deleteDocList = [];
        for (const doc of uploadRequestResults) {
          if (doc["Success"]) {
            try {
              let gdFileId = this.UUIDToGdId[doc["ID"]];
              let gdFileObj = DriveApp.getFileById(gdFileId);
              Logger.log(`Attempting to upload '${gdFileObj.getName()}'; size ${gdFileObj.getSize()} bytes`);
              let gdFileBlob = this.generateZipBlob(gdFileId);
              Logger.log(`Generated Remarkable zip blob for '${gdFileObj.getName()}'`);
              this.rApiClient.blobUpload(doc["BlobURLPut"], gdFileBlob);
              Logger.log(`Uploaded '${gdFileObj.getName()}'`);
            }
            catch (err) {
              Logger.log(`Failed to upload '${doc["ID"]}': ${err}`);
              deleteDocList.push(doc);
            }
          }
        }

        // update metadata
        Logger.info("Updating meta data for chunk");
        let uploadUpdateStatusResults = this.rApiClient.uploadUpdateStatus(uploadDocChunk);
        for (const r of uploadUpdateStatusResults) {
          if (!r["Success"]) {
            let ix =  this.rDocId2Ent[r["ID"]];
            let s = this.rDocList[ix];
            Logger.log(`Failed to update status '${s["VissibleName"]}': ${r["Message"]}`)
          }
        }

        // delete failed uploads
        // do this after meta data update to ensure version matches.
        if (deleteDocList.length > 0) {
          Logger.log(`Deleting ${deleteDocList.length} docs that failed to upload`);
          this.rApiClient.delete(deleteDocList);
        }

        Logger.info("Finished processing chunk.");
      }

      Logger.info("Finished running!");
    }
    catch (err) {
      Logger.log(`Finished run with error: ${err}`);
    }
  }

}