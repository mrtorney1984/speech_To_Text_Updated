from flask import Flask, render_template, request, jsonify
import speech_recognition as sr
import gtts
import io
import base64
import os
import tempfile
import docx  # python-docx
from pypdf import PdfReader  # Changed to pypdf

app = Flask(__name__)

# --- Helper Functions ---

def speech_to_text(audio_data, language="en-US"):
    """Converts speech in audio data to text."""
    r = sr.Recognizer()
    try:
        with sr.AudioFile(audio_data) as source:
            audio = r.record(source)
        text = r.recognize_google(audio, language=language)
        return text, None
    except sr.UnknownValueError:
        return None, "Could not understand audio"
    except sr.RequestError as e:
        return None, f"Could not request results: {e}"
    except Exception as e:
        return None, f"An unexpected error occurred: {e}"

def text_to_speech(text, language="en", tld="com"):
    """Converts text to speech and returns base64 encoded audio."""
    try:
        tts = gtts.gTTS(text=text, lang=language, tld=tld, slow=False)
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return base64.b64encode(mp3_fp.read()).decode('utf-8'), None  # Encode to base64 string
    except Exception as e:
        return None, f"Error generating speech: {e}"

def extract_text_from_docx(docx_path):
    """Extracts text from a .docx file."""
    doc = docx.Document(docx_path)
    full_text = []
    for paragraph in doc.paragraphs:
        full_text.append(paragraph.text)
    return '\n'.join(full_text)

def extract_text_from_doc(doc_path):
    """Extracts text from a .doc file (using antiword, if available)."""
    try:
        # More robust method using textract (handles .doc and .docx)
        import textract
        text = textract.process(doc_path)
        return text.decode('utf-8')
    except Exception as e:
        return f"Error extracting text from .doc: {e} (Try installing antiword or textract)"
        # You could add a fallback here using subprocess and antiword if textract fails.

def extract_text_from_pdf(pdf_path):
    """Extracts text from a PDF file."""
    try:
        with open(pdf_path, "rb") as file:
            reader = PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text
    except Exception as e:
        return f"Error extracting text from PDF: {e}"


# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/speech-to-text', methods=['POST'])
def handle_speech_to_text():
    if 'audio_data' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio_data']
    language = request.form.get('language', 'en-US')

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        audio_file.save(temp_audio.name)
        audio_file_path = temp_audio.name

    text, error = speech_to_text(temp_audio, language=language)
    os.remove(audio_file_path)

    if error:
        return jsonify({'error': error}), 400
    else:
        return jsonify({'text': text}), 200


@app.route('/text-to-speech', methods=['POST'])
def handle_text_to_speech():
    language = request.form.get('language', 'en')
    tld = request.form.get('tld', 'com')

    file_handlers = {
        '.docx': extract_text_from_docx,
        '.doc': extract_text_from_doc,
        '.pdf': extract_text_from_pdf,
        # Add more handlers as needed
    }

    if 'text' in request.form:  # Handle direct text input
        text = request.form['text']

    elif 'file' in request.files:  # Handle file upload
        uploaded_file = request.files['file']

        # *** MOST ROBUST CHECKS ***
        if not uploaded_file or uploaded_file.filename == '':
            return jsonify({'error': 'No file selected or invalid file'}), 400

        temp_file_path = None  # Initialize to None
        try:
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                uploaded_file.save(temp_file.name)
                temp_file_path = temp_file.name

            file_extension = os.path.splitext(uploaded_file.filename)[1].lower()
            handler = file_handlers.get(file_extension)

            if handler:
                text = handler(temp_file_path)
            else:
                return jsonify({'error': 'Unsupported file format'}), 400

        except Exception as e:
            return jsonify({'error': f'Error processing file: {e}'}), 500
        finally:
            if temp_file_path:  # Only try to remove if it was created
                os.remove(temp_file_path)

    else:  # Neither text nor file was provided.
        return jsonify({'error': 'No text or file provided'}), 400

    audio_base64, error = text_to_speech(text, language, tld)

    if error:
        return jsonify({'error': error}), 400
    else:
        return jsonify({'audio': audio_base64, 'text': text}), 200

if __name__ == '__main__':
    app.run(debug=True)