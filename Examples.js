function example_run_sync() {
  // one time code from https://my.remarkable.com/connect/mobile
  let rOneTimeCode = "abcdwxyz";
  
  // can select google folder by id or using search sdk string
  //let gdFolderSearchParams = "0Xxx_0XxxxX1XXX1xXXxxXXxxx0X";
  let gdFolderSearchParams = "title = 'Books' and mimeType = 'application/vnd.google-apps.folder'"
  
  let sync = new Synchronizer(rOneTimeCode, gdFolderSearchParams, "Google Drive", "update", ["SkipFolder1", "SkipFolder2"]);
  sync.run();
}

function example_force_sync() {
  // one time code from https://my.remarkable.com/connect/mobile
  let rOneTimeCode = "abcdwxyz";
  
  // can select google folder by id or using search sdk string
  //let gdFolderSearchParams = "0Xxx_0XxxxX1XXX1xXXxxXXxxx0X";
  let gdFolderSearchParams = "title = 'Books' and mimeType = 'application/vnd.google-apps.folder'"
  
  const IDS_TO_FORCE = [
    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx1",
    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx2",
    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx3",
  ];
    
  const forceFunc = (r, s) => IDS_TO_FORCE.includes(r["ID"]);
//  const forceFunc = (r, s) => s["Type"] == "CollectionType";
//  const forceFunc = (r, s) => r["VissibleName"] == "needs_force_push.pdf";
//  const forceFunc = (r, s) => s["Version"] == 1;
  
  let sync = new Synchronizer(rOneTimeCode, gdFolderSearchParams, "Google Drive", "update", [], forceFunc);
  sync.run();
}

function example_get_document_info() {
  // To re-use a cached device token initialize like this
  // let sync = new Synchronizer(rOneTimeCode, gdFolderSearchParams, "Google Drive");
  // let rapi = sync.rApiClient;
  // otherwise use one time code from https://my.remarkable.com/connect/mobile
  let rOneTimeCode = "abcdwxyz"; 
  let rapi = new RemarkableAPI(null, null, rOneTimeCode);
  // example doc with uuid
  let docs = rapi.listDocs('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true);
}
  
function example_delete_all_documents() {
  // To re-use a cached device token initialize like this
  // let sync = new Synchronizer(rOneTimeCode, gdFolderSearchParams, "Google Drive");
  // let rapi = sync.rApiClient;
  // otherwise use one time code from https://my.remarkable.com/connect/mobile
  let rOneTimeCode = "abcdwxyz"; 
  let rapi = new RemarkableAPI(null, null, rOneTimeCode);
  let allDocs = rapi.listDocs();
  // delete all except at top level
  let deleteDocs = allDocs.filter((r) => r["Parent"] != "");
  rapi.delete(deleteDocs); 
}
  
