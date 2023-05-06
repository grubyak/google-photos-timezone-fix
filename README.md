## google-photos-timezone-fix
This script iterates over photos in given Google Photos album and edits date/time/timezone of each photo in order to
fix their order.

## problem
Sometimes photos uploaded to Google Photos are arranged randomly and not based on the time/date that they were taken.
This happens due to the fact that timezone included in EXIF is not respected and usually GMT-5 is being used instead,
while timezone of the rest of the photos stays as orignally provided.

## workaround
1. Rearrange photos by hand (photos will again appear in wrong order if you will sort album) 
2. Select some/all photos and select "Edit date & time" option and then
- shift selected photos to another timezone - make sure to not shift photos with correct timezone
- set one date/time to all photos - your photo timeline will be flatten to one day and still order of the photos might not be correct

Both workarounds are not ideal which led me to implement this script which fixes date/time/timezone of each photo.

## prerequisites
- you need to edit script and set `EXPECTED_TZ` to desired timezone
- your photos needs to follow naming pattern `YYYYMMDD-HHMMSS-NR` or `YYYYMMDD_HHMMSS`, for example:
`20170414-204918-2042.jpg`, `20170414_204918.JPG` or `20170414_204918-2.DNG`
(there is an option to change timezone without changing time for photos that do not follow the pattern, see `SET_JUST_TZ_FOR_IMPROPERLY_NAMED`)
- you need to install *Tampermonkey* plugin in your browser (only Chrome was tested)

## how it works
- script iterates over photos of currently open album and executes following steps
- "Edit date & time" option is selected
- timezone setting is being checked
- date/time included in photo filename is being compared with values from the dialog
- an update is performed in case if timezone/date/time is incorrect
- changes (if any) are being saved
- script stops is case of error or when end of album is reached

## how to use it
- open *Tampermonkey* options and add google-photos-timezone-fix script
- set `EXPECTED_TZ` in script to desired timezone
- navigate to https://photos.google.com/ and open album which you want to edit
- open first photo and open photo details sidebar by clicking "info" icon
- open browser console and type
`window.fixAlbum()`
- observe log in browser console for additional info
- go back to album view and see if the order is corrected (you might need to sort entire album by opening it and selecting "Edit album" > Arrows icon: "Sort photos" > "Oldest first", this time photos will be properly sorted as date/time/timezone got corrected by the script)
