/**
 * Synchronizes PDFs from folder in Google Drive with Remarkable cloud.
 *
 * @rOneTimeCode {string} one time code from https://my.remarkable.com/connect/mobile.
 * @gdFolderSearchParams {string} google folder id or google drive search sdk string.
 * @rRootFolder {string} root folder on Remarkable to sync files to - must already exist. This can be a Remarkable GUID if you know it.
 * @syncMode {string} either "update" or "mirror". Mirroring removes files on device if they no longer exist in Google Drive.
 * @gdSkipFolders {array} list of names of Google Drive folders to skip syncing.
 */
function syncGoogleDriveWithRemarkableCloud(rOneTimeCode, gdFolderSearchParams, rRootFolder, syncMode="update", gdSkipFolders=[]) {
  let sync = new Synchronizer(rOneTimeCode, gdFolderSearchParams, rRootFolder, syncMode, gdSkipFolders);
  sync.run();
}


/**
 * Resets the device id and token forcing reinitialization of Remarkable Cloud authorization.
 */
function resetRemarkableDevice() {
  let userProps = PropertiesService.getUserProperties();
  userProps.deleteProperty(rDeviceTokenKey);
  userProps.deleteProperty(rDeviceIdKey);
}
