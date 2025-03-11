// static/script.js

// --- Speech-to-Text ---

const recordButton = document.getElementById('record-button');
const stopButton = document.getElementById('stop-button');
const sttResult = document.getElementById('stt-result');
const sttLanguageSelect = document.getElementById('stt-language');
const audioPlayback = document.getElementById('audio-playback');

let mediaRecorder;
let audioChunks = [];

// Language options (Speech-to-Text)
const sttLanguages = {
    "en-US": "English (US)",
    "en-GB": "English (UK)",
    "es-ES": "Spanish (Spain)",
    "es-MX": "Spanish (Mexico)",
    "fr-FR": "French (France)",
    "de-DE": "German (Germany)",
    "it-IT": "Italian (Italy)",
    "ja-JP": "Japanese (Japan)",
    "ko-KR": "Korean (South Korea)",
    "zh-CN": "Chinese (Mandarin, Simplified)",
    "zh-TW": "Chinese (Mandarin, Traditional)",
    "ru-RU": "Russian (Russia)",
    "hi-IN": "Hindi (India)",
    "pt-BR": "Portuguese (Brazil)",
    "pt-PT": "Portuguese (Portugal)",
    "ar-SA": "Arabic (Saudi Arabia)",
    "nl-NL": "Dutch (Netherlands)",
    "sv-SE": "Swedish (Sweden)",
    "mr-IN": "Marathi (India)"
};

for (const [code, name] of Object.entries(sttLanguages)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    sttLanguageSelect.appendChild(option);
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                audioChunks = [];
                const audioURL = URL.createObjectURL(audioBlob);
                audioPlayback.src = audioURL;
                audioPlayback.style.display = 'block';

                const formData = new FormData();
                formData.append('audio_data', audioBlob);
                formData.append('language', sttLanguageSelect.value);

                const response = await fetch('/speech-to-text', { method: 'POST', body: formData });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Speech-to-text failed');
                }
                const data = await response.json();
                sttResult.textContent = data.text;
                recordButton.disabled = false;
                stopButton.disabled = true;
            } catch (error) {
                console.error('Error during onstop:', error);
                sttResult.textContent = 'Error: ' + error.message;
                recordButton.disabled = false;
                stopButton.disabled = true;
            }
        };
        mediaRecorder.start();
        recordButton.disabled = true;
        stopButton.disabled = false;
        sttResult.textContent = "Recording...";
    } catch (error) {
        console.error('Error accessing microphone:', error);
        sttResult.textContent = 'Error: Could not access microphone.';
        recordButton.disabled = false;
        stopButton.disabled = true;
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        sttResult.textContent = "Processing...";
    }
}

recordButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);


// --- Text-to-Speech ---

const ttsInput = document.getElementById('tts-input');
const speakButton = document.getElementById('speak-button');
const ttsStopButton = document.getElementById('tts-stop-button'); // TTS Stop Button
const ttsLanguageSelect = document.getElementById('tts-language');
const ttsTldSelect = document.getElementById('tts-tld');
const fileUpload = document.getElementById('file-upload');
const uploadButton = document.getElementById('upload-button');
const fileUploadResult = document.getElementById('file-upload-result');

let currentAudio = null; // Global variable to store the current audio object

// Language options (Text-to-Speech)
const ttsLanguages = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh-CN": "Chinese (Mandarin)",
    "ru": "Russian",
    "hi": "Hindi",
    "pt": "Portuguese",
    "ar": "Arabic",
    "nl": "Dutch",
    "sv": "Swedish",
    "mr": "Marathi"
};

const tlds = {
    "en": {
        "com": "English (US)",
        "co.uk": "English (UK)",
        "com.au": "English (Australia)",
        "ca": "English (Canada)",
        "co.in": "English (India)",
    },
    "fr": {
        "fr": "French (France)",
        "ca": "French (Canada)",
    },
    "es": {
        "es": "Spanish (Spain)",
        "com.mx": "Spanish (Mexico)",
    },
    "pt": {
        "com.br": "Portuguese (Brazil)",
        "pt": "Portuguese (Portugal)",
    },
    "ar": {
        "com.sa": "Arabic (Saudi Arabia)"
    }
};

for (const [code, name] of Object.entries(ttsLanguages)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    ttsLanguageSelect.appendChild(option);
}

function updateTldOptions() {
    const selectedLanguage = ttsLanguageSelect.value;
    const tldOptions = tlds[selectedLanguage] || {};
    ttsTldSelect.innerHTML = '';
    if (Object.keys(tldOptions).length === 0) {
        const defaultOption = document.createElement('option');
        defaultOption.value = "com";
        defaultOption.textContent = "Default";
        ttsTldSelect.appendChild(defaultOption);
        return;
    }
    for (const [tld, name] of Object.entries(tldOptions)) {
        const option = document.createElement('option');
        option.value = tld;
        option.textContent = name;
        ttsTldSelect.appendChild(option);
    }
}

updateTldOptions();
ttsLanguageSelect.addEventListener('change', updateTldOptions);

function stopSpeaking() {
    if (currentAudio) {
        currentAudio.pause();  // Pause the audio
        currentAudio.currentTime = 0; // Reset playback to the beginning
        currentAudio = null; // Clear the current audio
        speakButton.disabled = false; // Re-enable speak
        uploadButton.disabled = false; //Re-enable upload button
        ttsStopButton.disabled = true; // Disable stop
    }
}

async function speakText(text) {
    const language = ttsLanguageSelect.value;
    const tld = ttsTldSelect.value;

    if (!text) {
        alert('Please enter text to speak or upload a file.');
        return;
    }
    speakButton.disabled = true;
    ttsStopButton.disabled = false; // Enable Stop button
     uploadButton.disabled = true;


    try {
        const response = await fetch('/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ text, language, tld }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Text-to-speech failed');
        }

        const data = await response.json();
        currentAudio = new Audio('data:audio/mp3;base64,' + data.audio); // Set currentAudio
        currentAudio.play();
        currentAudio.onended = () => {
            speakButton.disabled = false;
            ttsStopButton.disabled = true; // Disable on end
             uploadButton.disabled = false;

        };

    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
        speakButton.disabled = false;
        ttsStopButton.disabled = true; // Disable on error too
         uploadButton.disabled = false;
    }
}

async function handleFileUpload() {
    const file = fileUpload.files[0];
    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    uploadButton.disabled = true;
    ttsStopButton.disabled = false; // Enable Stop button

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', ttsLanguageSelect.value);
    formData.append('tld', ttsTldSelect.value);

    try {
        const response = await fetch('/text-to-speech', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'File upload and TTS failed');
        }

        const data = await response.json();
        fileUploadResult.textContent = "Uploaded Text: " + data.text;

        currentAudio = new Audio('data:audio/mp3;base64,' + data.audio); // Set currentAudio
        currentAudio.play();
        currentAudio.onended = () => {
            uploadButton.disabled = false;
            ttsStopButton.disabled = true; // Disable on end

        };
    } catch (error) {
        console.error('Error during file upload:', error);
        fileUploadResult.textContent = 'Error: ' + error.message;
         uploadButton.disabled = false;
         ttsStopButton.disabled = true;//Disable on error too
    }
}

speakButton.addEventListener('click', () => { speakText(ttsInput.value); });
uploadButton.addEventListener('click', handleFileUpload);
ttsStopButton.addEventListener('click', stopSpeaking); // Add event listener for stop button