const axios = require('axios');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
    }

    try {
        const { url } = JSON.parse(event.body);
        if (!url) {
            throw new Error('No URL provided.');
        }

        // A more robust regex to extract video ID from various YouTube URL formats
        const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
        if (!videoIdMatch || !videoIdMatch[1]) {
            throw new Error('Could not extract a valid YouTube video ID from the URL.');
        }
        const videoId = videoIdMatch[1];
        
        const options = {
            method: 'GET',
            url: 'https://super-fast-youtube-to-mp3-and-mp4-converter.p.rapidapi.com/dl',
            params: { id: videoId },
            headers: {
                'x-rapidapi-host': 'super-fast-youtube-to-mp3-and-mp4-converter.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY // Security best practice
            }
        };

        const response = await axios.request(options);
        const data = response.data;

        // Check for a successful response from RapidAPI
        if (response.status !== 200 || !data.link) {
            throw new Error(data.msg || 'RapidAPI did not return a valid download link.');
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                url: data.link, // The direct MP3 download link
                title: data.title
            })
        };

    } catch (error) {
        console.error("Netlify Function Error:", error);
        // Provide a more informative error message to the client
        const errorMessage = error.response?.data?.msg || error.message || 'An unknown server error occurred.';
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false,
                message: `Server function failed: ${errorMessage}`
            })
        };
    }
};
