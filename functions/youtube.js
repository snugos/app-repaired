const ytdl = require('ytdl-core');

// Vercel serverless function format
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { url } = request.body;
        if (!url || !ytdl.validateURL(url)) {
            throw new Error('A valid YouTube URL was not provided.');
        }

        // Get video information and find the best audio-only format
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

        if (!format) {
            throw new Error('No suitable audio-only format could be found for this video.');
        }

        // Create a promise to handle the stream and convert it to a buffer
        const getAudioBuffer = () => {
            return new Promise((resolve, reject) => {
                const audioStream = ytdl.downloadFromInfo(info, { format: format });
                const chunks = [];
                audioStream.on('data', (chunk) => chunks.push(chunk));
                audioStream.on('end', () => resolve(Buffer.concat(chunks)));
                audioStream.on('error', (err) => reject(err));
            });
        };

        const audioBuffer = await getAudioBuffer();

        // Respond with the audio data encoded in Base64
        return response.status(200).json({
            success: true,
            title: info.videoDetails.title,
            base64: audioBuffer.toString('base64'),
        });

    } catch (error) {
        console.error("Vercel Function Error:", error);
        return response.status(500).json({
            success: false,
            message: `Server function failed: ${error.message}`
        });
    }
}
