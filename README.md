# google-drive-remarkable-sync
Apps Script library for synchronising Google Drive folder with Remarkable cloud storage.

Files kept in Remarkable's cloud storage are automatically synchronised with your Remarkable device.

Thanks to splitbrain who did the [initial reverse engineering of Remarkable's cloud API](https://github.com/splitbrain/ReMarkableAPI/wiki).

# Installation

1. Go to https://script.google.com and click on "New Project".
Click in menu "File/Rename" and provide suitable name, eg "Sync Google Drive Books to Remarkable".

    1. Option 1 - Include library from Apps Script
Click in menu "Resources/Libraries" and in "Add a library" paste "1_ftsHelqnCqBXAwFAOv3U-WUUm_n3_nENg7n6BrDDzze7EekBD9vmf-0" without the double quotes. In version drop down choose "Stable - include epub and shortcuts" Then press "Save" button.

    2. Option 2 - Copy the code files from this repository into your Apps Script project being careful to rename the *.js files to *.gs files.

2. Create a folder at top level in your Remarkable device called "Google Drive".

3. In your Code.gs file paste the following code:

        function run_sync() {
          // one time code from https://my.remarkable.com/connect/mobile
          let rOneTimeCode = "abcdwxyz";
          let gdFolderSearchParams = "title = 'Books' and mimeType = 'application/vnd.google-apps.folder'";
          let syncMode = "mirror";
          RemarkableGoogleDriveSyncLib.syncGoogleDriveWithRemarkableCloud(rOneTimeCode, gdFolderSearchParams, "Google Drive", syncMode);
        }

    Change the rOneTimeCode to include a one time code obtained from https://my.remarkable.com/connect/mobile. Also change the name "Books" in gdFolderSearchParams to the name of your Google Drive folder that contains your relevant PDFs. You can also replace the gdFolderSearchParams with a Google Drive folder ID. syncMode can be either "update" or "mirror" with
    mirroring also deleting files from Remarkable device if not found in same location on Google Drive.

4. Click the menu "Run/Run function/run_sync"; you will be prompted for Authorization. Click Review Permissions and select your Google account. You will be prompted that the app isn't verified. Click the Advanced hyperlink and choose "Go to <Your project name> (unsafe)". Choose Allow to the permissions shown.

5. View the execution log of your project to check everything appears to be working.

6. Set up a regular trigger by click in menu "Edit/Current project's triggers". Click "+ Add Trigger" button. Choose run_sync function and select "Time-driver", "Hour timer", "Every hour" and "Notify me daily" then press Save.

That should be it!
