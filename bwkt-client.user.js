// ==UserScript==
// @name         BWKT Client
// @namespace    http://tampermonkey.net/
// @version      2025.02.25
// @description  Loads and displays custom translated subtitles for Brood War videos on YouTube. Also allows uploading your own subtitle file.
// @author       Gooseheaded
// @match        https://www.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let debugging = false;
    const subtitleServiceURL = 'https://script.google.com/macros/s/AKfycbwF7HSAbueL1x_N5kZTPUNVm0y7RrKL8GiRWYOqY1b_k8mfd4BDvS6Ez9tZ_utXtg4/exec?videoId=' + (new URLSearchParams(window.location.search).get('v'));

    let subtitleURL = '';
    let subtitleMissing = false;

    // Create and insert the "BWKT Subtitles" button (loads subtitles from the remote service)
    function createButton(parent) {
        const button = document.createElement('button');
        button.textContent = 'BWKT Subtitles';
        button.id = 'bwkt-button';
        button.style.zIndex = '1000';
        button.style.padding = '10px 20px';
        button.style.fontSize = '16px';
        button.style.backgroundColor = '#007bff';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', () => {
            button.remove(); // Remove the button after clicking
            debugging = typeof bwktDebug !== 'undefined';
            initializeSubtitles();
        });

        parent.appendChild(button);
    }

    // Create and insert the "Upload Subtitles" button (for user-uploaded subtitle files)
    function createUploadButton(parent) {
        const button = document.createElement('button');
        button.textContent = 'Upload Subtitles';
        button.id = 'upload-subtitles-button';
        button.style.zIndex = '1000';
        button.style.padding = '10px 20px';
        button.style.fontSize = '16px';
        button.style.backgroundColor = '#28a745';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.marginLeft = '10px';

        // Hidden file input to handle the upload
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.srt,.vtt,text/plain';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const subtitleText = e.target.result;
                    button.remove(); // Remove the upload button after file selection
                    // Wait for video elements to be available before displaying subtitles
                    const waitForPlayer = setInterval(() => {
                        const video = document.querySelector('video');
                        const playerContainer = document.querySelector('.html5-video-container');
                        const videoParent = document.querySelector('#above-the-fold');
                        if (video && playerContainer && videoParent) {
                            videoParent.prepend(addCustomSubtitleDisplayFromText(video, videoParent, subtitleText));
                            clearInterval(waitForPlayer);
                        }
                    }, 1000);
                };
                reader.readAsText(file);
            }
        });

        button.addEventListener('click', () => {
            fileInput.click();
        });

        parent.appendChild(button);
        parent.appendChild(fileInput);
    }

    // Initialize subtitle logic from remote URL
    function initializeSubtitles() {
        fetch(subtitleServiceURL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to load subtitles.');
                }
                if (debugging) console.log('Subtitle lookup complete.');
                return response.text();
            })
            .then((text) => {
                if (text === 'Error: URL not found.') {
                    subtitleMissing = true;
                    throw new Error(`No subtitles were found for this video.\n${subtitleServiceURL}\n${text}`);
                }
                subtitleURL = text;
                subtitleMissing = false;
                if (debugging) console.log(`Displaying subtitles from ${subtitleURL}`);
                startSubtitleLogic();
            })
            .catch((error) => {
                console.error('Error loading subtitles:', error);
            });
    }

    // Start the main subtitle logic from the remote URL
    function startSubtitleLogic() {
        const waitForPlayer = setInterval(() => {
            if (subtitleMissing) {
                clearInterval(waitForPlayer);
            }

            if (!subtitleURL) {
                return;
            }

            const video = document.querySelector('video');
            const playerContainer = document.querySelector('.html5-video-container');
            const videoParent = document.querySelector('#above-the-fold');

            if (video && playerContainer && videoParent) {
                videoParent.prepend(addCustomSubtitleDisplay(video, videoParent, subtitleURL));
                clearInterval(waitForPlayer);
            }
        }, 1000);
    }

    // Fetches subtitle file from a URL and displays the subtitles
    function addCustomSubtitleDisplay(video, videoParent, subtitleURL) {
        if (debugging) console.log('(addCustomSubtitleDisplay)');
        // Create a container for the custom subtitles
        const subtitleContainer = document.createElement('div');
        subtitleContainer.id = 'bwkt-teleprompter';
        subtitleContainer.style.border = 'solid red 1px';
        subtitleContainer.style.position = 'relative';
        subtitleContainer.style.marginTop = '10px';
        subtitleContainer.style.marginBottom = '10px';
        subtitleContainer.style.marginLeft = 'auto';
        subtitleContainer.style.marginRight = 'auto';
        subtitleContainer.style.height = '64px';
        subtitleContainer.style.fontSize = '24px';
        subtitleContainer.style.color = 'white';
        subtitleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        subtitleContainer.style.padding = '10px';
        subtitleContainer.style.textAlign = 'center';
        subtitleContainer.style.borderRadius = '5px';
        subtitleContainer.style.maxWidth = '800px';

        // Fetch and parse the subtitles
        fetch(subtitleURL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load subtitles. \n${response.status} - ${response.statusText}`);
                }
                if (debugging) console.log('(addCustomSubtitleDisplay) subtitles loaded successfully.');
                return response.text();
            })
            .then((text) => {
                // Determine parser: if text includes WEBVTT, use VTT; otherwise, assume SRT
                const cues = subtitleURL.endsWith('.srt') || !text.includes('WEBVTT') ? parseSRT(text) : parseVTT(text);
                if (debugging) console.log('(addCustomSubtitleDisplay) displaying subtitles now.');
                displaySubtitles(video, cues, subtitleContainer);
            })
            .catch((error) => {
                subtitleContainer.innerText = 'Error loading subtitles: \n' + error;
                console.error('Error loading subtitles:', error);
            });

        return subtitleContainer;
    }

    // Uses subtitle text from an uploaded file to display subtitles
    function addCustomSubtitleDisplayFromText(video, videoParent, subtitleText) {
        if (debugging) console.log('(addCustomSubtitleDisplayFromText)');
        // Create a container for the custom subtitles
        const subtitleContainer = document.createElement('div');
        subtitleContainer.id = 'bwkt-teleprompter';
        subtitleContainer.style.border = 'solid red 1px';
        subtitleContainer.style.position = 'relative';
        subtitleContainer.style.marginTop = '10px';
        subtitleContainer.style.marginBottom = '10px';
        subtitleContainer.style.marginLeft = 'auto';
        subtitleContainer.style.marginRight = 'auto';
        subtitleContainer.style.height = '64px';
        subtitleContainer.style.fontSize = '24px';
        subtitleContainer.style.color = 'white';
        subtitleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        subtitleContainer.style.padding = '10px';
        subtitleContainer.style.textAlign = 'center';
        subtitleContainer.style.borderRadius = '5px';
        subtitleContainer.style.maxWidth = '800px';

        try {
            // Use WEBVTT check to decide whether to parse as VTT or SRT
            const cues = subtitleText.includes('WEBVTT') ? parseVTT(subtitleText) : parseSRT(subtitleText);
            if (debugging) console.log('(addCustomSubtitleDisplayFromText) displaying subtitles now.');
            displaySubtitles(video, cues, subtitleContainer);
        } catch (error) {
            subtitleContainer.innerText = 'Error loading subtitles: \n' + error;
            console.error('Error loading subtitles:', error);
        }
        return subtitleContainer;
    }

    function parseVTT(vttText) {
        if (debugging) console.log('(parseVTT)');
        const cues = [];
        const lines = vttText.split(/\r?\n/);
        let currentCue = null;

        lines.forEach((line) => {
            if (line.trim() === '' || line.trim() === 'WEBVTT') {
                // Ignore empty lines and the "WEBVTT" header
                return;
            } else if (line.includes('-->')) {
                // Start of a new cue
                if (currentCue) {
                    cues.push(currentCue);
                }
                const [start, end] = line.split(' --> ').map(parseTimestamp);
                currentCue = { start, end, text: '' }; // Initialize a new cue
            } else {
                // Append text to the current cue
                if (currentCue) {
                    currentCue.text += line + '\n';
                } else {
                    console.error('Error: Orphaned text line found before a timestamp.');
                }
            }
        });

        // Add the last cue if it exists
        if (currentCue) {
            cues.push(currentCue);
        }

        return cues;
    }

    function parseSRT(srtText) {
        if (debugging) console.log('(parseSRT)');
        const cues = [];
        const lines = srtText.split(/\r?\n/);
        let currentCue = null;
        if (debugging) console.log('(parseSRT) Just before lines.forEach');

        lines.forEach((line) => {
            line = line.trim();
            if (debugging) console.log(`(parseSRT) Processing line: "${line}"`);
            if (line.match(/^\d+$/)) {
                if (debugging) console.log('(parseSRT) Cue line: ', line);
                // Start of a new cue
                if (currentCue) {
                    cues.push(currentCue);
                }
                currentCue = { start: 0, end: 0, text: '' };
            } else if (line.includes('-->')) {
                if (debugging) console.log('(parseSRT) Timestamp line: ', line);
                const [start, end] = line.split(' --> ').map(parseTimestamp);
                if (debugging) console.log('(parseSRT) Start and end are: ', start, end);
                currentCue.start = start;
                currentCue.end = end;
            } else if (line.trim()) {
                if (debugging) console.log('(parseSRT) Text line: ', line);
                currentCue.text += line + '\n';
            }
        });

        if (currentCue) {
            cues.push(currentCue);
        }

        return cues;
    }

    function parseTimestamp(timestamp) {
        if (debugging) console.log('(parseTimestamp)');
        if (timestamp.includes(':')) {
            if (debugging) console.log('(parseTimestamp) Timestamp is', timestamp);
            const [hours, minutes, seconds] = timestamp.replace(',','.').split(':').map(parseFloat);

            // This means the subtitles do not last longer than an hour, so the timestamp
            // is "missing" one part.
            if (!seconds) {
                if (debugging) console.log('(parseTimestamp) minutes is ', hours, '; seconds is ', minutes);
                return hours * 60 + minutes;
            }
            else {
                if (debugging) console.log('(parseTimestamp) hours is', hours, '; minutes is ', minutes, '; seconds is ', seconds);
                return hours * 3600 + minutes * 60 + seconds;
            }
        } else {
            return parseFloat(timestamp);
        }
    }

    function displaySubtitles(video, cues, container) {
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            const currentCue = cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end);

            if (currentCue) {
                container.textContent = currentCue.text.trim();
            } else {
                container.textContent = '';
            }
        });
    }

    // Add both buttons to the page once the container is available
    const waitForInit = setInterval(() => {
        const buttonParent = document.querySelector('div#top-level-buttons-computed');
        if (!buttonParent) {
            return;
        }

        createButton(buttonParent);
        createUploadButton(buttonParent);
        clearInterval(waitForInit);
    }, 1000);
})();
