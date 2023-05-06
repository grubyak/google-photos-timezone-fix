// ==UserScript==
// @name         google-photos-tz-fix
// @namespace    https://github.com/grubyak/
// @version      0.3
// @description  Fixes Date/Time/TZ of a photos in given Google Photos album
// @license      MIT
// @author       grubyak
// @match        https://photos.google.com/*
// @require      https://code.jquery.com/jquery-3.2.1.js
// @updateURL    https://raw.githubusercontent.com/grubyak/google-photos-timezone-fix/master/google-photos-tz-fix.js
// @downloadURL  https://raw.githubusercontent.com/grubyak/google-photos-timezone-fix/master/google-photos-tz-fix.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var EXPECTED_TZ = 'GMT+08:00';
    var nextPhotoTimeout = 5 * 1000;
    var updateTimeout = 8 * 1000;
    var savingTimeout = 10 * 1000;
    var dialogTimeout = 3 * 1000;

    var FILENAME_PATTERN = new RegExp(/^[0-9]{8}[-_][0-9]{6}[-_.]/);
    var FIELD_TZ = '[data-value][aria-hidden!="true"]';
    var FIELD_HOUR = 'input[aria-label="Hour"]';
    var FIELD_MINUTES = 'input[aria-label="Minutes"]';
    var FIELD_AMPM = 'input[aria-label="AM/PM"]';
    var FIELD_YEAR = 'input[aria-label="Year"]';
    var FIELD_MONTH = 'input[aria-label="Month"]';
    var FIELD_DAY = 'input[aria-label="Day"]';

    function notify(type, msg) {
        console.log('[' + type + ']', msg);
    }

    function rand(from, plus) {
        return from + Math.floor(Math.random() * plus);
    }

    function waitFor(name, deadline, task, condition) {
        if (new Date().getTime() > deadline) {
            task.reject();
            return;
        }

        if (condition()) {
            setTimeout(task.resolve, rand(200, 150));
        } else {
            notify(' ', 'waiting...' + name);
            requestAnimationFrame(waitFor.bind(null, name, deadline, task, condition));
        }
    }

    function openDialog() {
        var task = $.Deferred();
        var button = $('div[aria-label*="Date:"]:visible');

        if (button.length) {
            notify('+', 'opening edit dialog');
            setTimeout(function() { button.click(); }, rand(500, 150));

            var previousOffsets = [];
            var compareLast = 5;

            waitFor("Dialog appeared", new Date().getTime() + dialogTimeout, task, function() {
                var dialog = $('[role="dialog"]:visible');
                var fields = [ FIELD_HOUR, FIELD_MINUTES, FIELD_AMPM, FIELD_YEAR, FIELD_MONTH, FIELD_DAY ];
                var fieldsPopulated = fields.every(item => !!dialog.find(item).val());
                var tzPopulated = !!$(dialog).find(FIELD_TZ).attr('aria-label');
                var offset = dialog.offset();
                var fullyVisible = false;

                if (offset) {
                    previousOffsets.push(offset.top + ' ' + offset.left);

                    if (previousOffsets.length === compareLast) {
                        var needle = previousOffsets.shift();

                        fullyVisible = previousOffsets.filter(x => x === needle).length === (compareLast - 1);
                    }
                }

                return fieldsPopulated && tzPopulated && fullyVisible;
            });
        } else {
            notify('-', 'edit option not available');
            task.reject();
        }

        return task;
    }

    function applyChanges(task, changes, saveButton, needToSave) {
        var requestedUpdate = changes.shift();

        needToSave = needToSave || false;

        if (typeof requestedUpdate === 'undefined') {
            if (needToSave) {
                var progress = '';

                waitFor("Date changed notification", new Date().getTime() + savingTimeout, task, function() {
                    var notification = $(':contains("Date changed"):visible:last');
                    var position = notification.position() || { top: -1 };
                    var state = (position.top > 0) ? '1' : '0';

                    progress += (progress.slice(-1) === state) ? '' : state;

                    return (progress === '010');
                });

                notify('+', 'some fields got updated, saving changes');
                setTimeout(function() { saveButton.click(); }, rand(500, 150));
            } else {
                var cancelButton = $('[role="dialog"]:visible button:visible:contains("Cancel")');
                notify('+', 'closing dialog without saving - details are correct');

                setTimeout(function() { cancelButton.click(); }, rand(500, 150));

                waitFor("Dialog disappears", new Date().getTime() + dialogTimeout, task, function() {
                    return $('[role="dialog"]:visible').length === 0;
                });
            }
        } else {
            var updater = $.Deferred();
            var dialog = $('[role="dialog"]');
            var caption = dialog.find(':contains("Edit date & time"):last').text();

            var watchedFields = [ FIELD_YEAR, FIELD_MONTH, FIELD_DAY, FIELD_HOUR, FIELD_MINUTES, FIELD_AMPM ];
            var fieldDump = y => y.map(x => dialog.find(x).val()).join('');
            var previousValues = fieldDump(watchedFields);
            var needToUpdate = false;

            notify('+', 'processing ' + requestedUpdate.description + ' - ' + requestedUpdate.value);

            if (requestedUpdate.action && !requestedUpdate.verify()) {
                needToUpdate = true;
                notify(' ', 'updating');
                setTimeout(requestedUpdate.action, rand(1000, 500));
            } else {
                var field = dialog.find(requestedUpdate.field);
                var value = requestedUpdate.value;

                if (field.length && (field.val() !== value)) {
                    needToUpdate = true;
                    notify(' ', 'updating');

                    field.val(value);

                    var refresh = $('[role="dialog"]').find(FIELD_AMPM);
                    refresh.click();
                    refresh.click();
                }
            }

            if (needToUpdate) {
                needToSave = true;

                waitFor("Dialog updated", new Date().getTime() + updateTimeout, updater, function() {
                    var valueUpdated;
                    var formUpdated = previousValues !== fieldDump(watchedFields);
                    var captionUpdated = caption !== dialog.find(':contains("Edit date & time"):last').text();

                    if (requestedUpdate.action) {
                        valueUpdated = requestedUpdate.verify();
                    } else {
                        valueUpdated = dialog.find(requestedUpdate.field).val() === requestedUpdate.value;
                    }

                    return valueUpdated && formUpdated && captionUpdated;
                });
            } else {
                updater.resolve();
            }

            updater
                .fail(function() {
                    notify('-', 'looks like requested value was not set');
                    task.reject();
                })
                .done(function() {
                    applyChanges(task, changes, saveButton, needToSave);
                });
        }
    }

    function performUpdate(task) {
        var details = getPhotoDetails();

        notify('+', 'working on photo: ' + details.filename);

        openDialog()
            .fail(function() {
                notify('-', 'unable to open edit dialog');
                task.reject();
            })
            .done(function() {
                var dialog = $('[role="dialog"]');
                var saveButton = $(dialog).find('button:visible:contains("Save")');
                var changes = [
                    {
                        description: 'timezone',
                        action: function() {
                            var updater = $.Deferred();

                            $(dialog).find(FIELD_TZ).closest('[role="presentation"]').click();

                            waitFor("find TZ field", new Date().getTime() + updateTimeout, updater, function() {
                                return $(dialog).find(FIELD_TZ).length > 1;
                            });

                            updater
                                .fail(function() {
                                    notify('-', 'timezone list box not available');
                                })
                                .done(function() {
                                    setTimeout(function() {
                                        $(dialog).find(FIELD_TZ).filter(':contains("' + EXPECTED_TZ + '")').last().click();
                                    }, rand(800, 500));
                                });
                        },
                        verify: function() {
                            return ($(dialog).find(FIELD_TZ).filter('[aria-selected="true"]').attr('aria-label') || '').indexOf(EXPECTED_TZ) !== -1;
                        },
                        value: EXPECTED_TZ
                    },
                    {
                        description: 'hour',
                        field: FIELD_HOUR,
                        value: details.hour
                    },
                    {
                        description: 'minutes',
                        field: FIELD_MINUTES,
                        value: details.minutes
                    },
                    {
                        description: 'am/pm',
                        field: FIELD_AMPM,
                        value: details.timeAmPm
                    },
                    {
                        description: 'year',
                        field: FIELD_YEAR,
                        value: details.year
                    },
                    {
                        description: 'month',
                        field: FIELD_MONTH,
                        value: details.month
                    },
                    {
                        description: 'day',
                        field: FIELD_DAY,
                        value: details.day
                    }
                ];

                notify('+', 'editing photo details');
                applyChanges(task, changes, saveButton);
            });
    }

    function fixCurrentPhoto() {
        var task = $.Deferred();
        var details = getPhotoDetails();

        if (details) {
            if (details.skip) {
                notify('-', 'skipping current photo (' + details.reason + ')');
                task.resolve();
            } else {
                performUpdate(task);
            }
        } else {
            notify('-', 'unable to find photo details');
            task.reject();
        }

        return task;
    }

    function getPhotoDetails() {
        var info = $('div[aria-label*="Filename:"]:visible').text();
        var details = null;

        if (!FILENAME_PATTERN.test(info)) {
            return {
                filename: info,
                skip: true,
                reason: 'filename pattern mismatch: ' + info
            };
        }

        if (info.length) {
            var chunks = info.split(/[-_]/);
            var date = chunks.shift();
            var time = chunks.shift();

            if (date && time) {
                details = {};
                details.filename = info;
                details.year = date.slice(0, 4);
                details.month = date.slice(4, 6);
                details.day = date.slice(6, 8);
                details.hour = time.slice(0, 2);
                details.minutes = time.slice(2, 4);

                var hour12h = Number(details.hour);

                if (hour12h < 12) {
                    if (hour12h === 0) {
                        hour12h = 12;
                    }

                    details.timeAmPm = 'AM';
                } else {
                    if (hour12h > 12) {
                        hour12h -= 12;
                    }

                    details.timeAmPm = 'PM';
                }

                details.hour = ('0' + hour12h).slice(-2);
                details.everything = JSON.stringify(details);
            }
        }

        return details;
    }

    function requestNextPhoto() {
        var task = $.Deferred();
        var previous = getPhotoDetails();
        var button = $('[aria-label="View next photo"]:visible');

        if (button.length) {
            setTimeout(function() { button.click(); }, rand(500, 150));

            waitFor("next photo loaded", new Date().getTime() + nextPhotoTimeout, task, function() {
                var current = getPhotoDetails();

                return previous && current && (previous.filename !== current.filename);
            });
        } else {
            task.reject();
        }

        return task;
    }

    function traverseAlbum(task) {
        fixCurrentPhoto()
            .fail(function() {
                notify('-', 'unable to fix current photo, stopping');
                task.reject();
            })
            .done(function() {
                notify('+', 'requesting next photo');

                requestNextPhoto()
                    .fail(function() {
                        notify(' ', 'reached end of the album');
                        task.resolve();
                     })
                    .done(traverseAlbum.bind(null, task));
            });
    }

    window.fixAlbum = function() {
        var task = $.Deferred();

        traverseAlbum(task);

        task
            .fail(notify.bind(null, '-', 'not all photos fixed'))
            .done(notify.bind(null, '+', 'everything is done :)'));
    };

})();
