/**
 * Synchronizes PDFs from folder in Google Drive with Remarkable cloud.
 *
 * @rOneTimeCode {string} one time code from https://my.remarkable.com/connect/mobile
 * @gdFolderSearchParams {string} google folder id or google drive search sdk string
 * @rRootFolder {string} root folder on Remarkable to sync files to - must already exist
 * @gdSkipFolders {array} list of names of google drive folders to skip syncing
 */
function syncGoogleDriveWithRemarkableCloud(rOneTimeCode, gdFolderSearchParams, rRootFolder, gdSkipFolders=[]) {
  let sync = new Synchronizer(rOneTimeCode, gdFolderSearchParams, rRootFolder, gdSkipFolders);
  sync.run();
}